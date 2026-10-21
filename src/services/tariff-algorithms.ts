import type { TariffAlgorithmInput, TariffAlgorithmPage } from "@/lib/tariff-algorithms";
import type { AccessView } from "@/server/authz/resolve-access";
import { audit } from "@/server/authz/resolve-access";
import { db } from "@/services/db";

export class TariffAlgorithmError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TariffAlgorithmError";
    }
}

export async function getTariffAlgorithmSettings(): Promise<TariffAlgorithmPage> {
    const algorithms = await db.query<{ code: string; title: string; salesShareWeight: number; priceShareWeight: number }>(
        `
        SELECT code,
               title,
               sales_share_weight AS "salesShareWeight",
               price_share_weight AS "priceShareWeight"
        FROM tariff_algorithms
        ORDER BY sort_order, title
        `,
    );
    const grants = await db.query<{ algorithmCode: string; territoryUuid: string }>(
        `
        SELECT algorithm_code AS "algorithmCode",
               territory_uuid::text AS "territoryUuid"
        FROM tariff_algorithm_weight_grants
        `,
    );
    const referenceGrants = await db.query<{ algorithmCode: string; territoryUuid: string }>(
        `
        SELECT algorithm_code AS "algorithmCode",
               territory_uuid::text AS "territoryUuid"
        FROM tariff_algorithm_reference_grants
        `,
    );
    const territories = await db.query<{ uuid: string; code: string; name: string }>(
        `
        SELECT territory.uuid::text AS uuid, territory.code, territory.name
        FROM territories territory
        WHERE NOT territory.deleted
           OR EXISTS (
               SELECT 1
               FROM tariff_algorithm_weight_grants weight_grant
               WHERE weight_grant.territory_uuid = territory.uuid
           )
           OR EXISTS (
               SELECT 1
               FROM tariff_algorithm_reference_grants reference_grant
               WHERE reference_grant.territory_uuid = territory.uuid
           )
        ORDER BY territory.name
        `,
    );
    const enabled = await db.query<{ axis: string; id: number; name: string; versionId: number; versionNo: number; versionName: string; status: "draft" | "test" | "working" | "off" }>(
        `
        SELECT version.tariff_axis AS axis,
               basket.id,
               basket.name,
               version.id AS "versionId",
               version.version_no AS "versionNo",
               version.name AS "versionName",
               version.status
        FROM basket_versions version
        JOIN baskets basket ON basket.id = version.basket_id
        WHERE version.status IN ('test', 'working')
          AND version.tariff_axis IS NOT NULL
          AND basket.status = 'active'
        ORDER BY basket.name, version.version_no
        `,
    );
    const byAlgorithm = grantIndex(grants);
    const referenceByAlgorithm = grantIndex(referenceGrants);
    const basketsByAlgorithm = new Map<string, { id: number; name: string; versionId: number; versionNo: number; versionName: string; status: "draft" | "test" | "working" | "off" }[]>();
    for (const row of enabled) {
        const list = basketsByAlgorithm.get(row.axis) ?? [];
        list.push({
            id: row.id,
            name: row.name,
            versionId: row.versionId,
            versionNo: row.versionNo,
            versionName: row.versionName,
            status: row.status,
        });
        basketsByAlgorithm.set(row.axis, list);
    }
    return {
        territories,
        algorithms: algorithms.map((algorithm) => ({
            code: algorithm.code,
            title: algorithm.title,
            salesShareWeight: Number(algorithm.salesShareWeight),
            priceShareWeight: Number(algorithm.priceShareWeight),
            territoryUuids: (byAlgorithm.get(algorithm.code) ?? []).sort(),
            referenceTerritoryUuids: (referenceByAlgorithm.get(algorithm.code) ?? []).sort(),
            baskets: basketsByAlgorithm.get(algorithm.code) ?? [],
        })),
    };
}

export async function saveTariffAlgorithmSettings(access: AccessView, items: TariffAlgorithmInput[]): Promise<TariffAlgorithmPage> {
    const current = await getTariffAlgorithmSettings();
    const codes = new Set(current.algorithms.map((algorithm) => algorithm.code));
    if (items.length !== codes.size || items.some((item) => !codes.has(item.code))) {
        throw new TariffAlgorithmError("Список алгоритмов не совпадает с настройками");
    }
    const knownTerritories = new Set(current.territories.map((territory) => territory.uuid));
    const requested = [...new Set(items.flatMap((item) => [...item.territoryUuids, ...item.referenceTerritoryUuids]))];
    const markedRows = requested.length === 0
        ? []
        : await db.query<{ uuid: string }>(
            `
            SELECT uuid::text AS uuid
            FROM territories
            WHERE uuid = ANY($1::uuid[])
              AND deleted
            `,
            [requested],
        );
    const markedIds = new Set(markedRows.map((row) => row.uuid.toLowerCase()));
    for (const item of items) {
        if ([...item.territoryUuids, ...item.referenceTerritoryUuids].some((uuid) => !knownTerritories.has(uuid))) {
            throw new TariffAlgorithmError("В списке есть территория, которой нет в справочнике");
        }
        const algorithm = current.algorithms.find((row) => row.code === item.code);
        const previousWeight = new Set((algorithm?.territoryUuids ?? []).map((uuid) => uuid.toLowerCase()));
        const previousReference = new Set((algorithm?.referenceTerritoryUuids ?? []).map((uuid) => uuid.toLowerCase()));
        const connectsRemoved = item.territoryUuids.some((uuid) => markedIds.has(uuid.toLowerCase()) && !previousWeight.has(uuid.toLowerCase()))
            || item.referenceTerritoryUuids.some((uuid) => markedIds.has(uuid.toLowerCase()) && !previousReference.has(uuid.toLowerCase()));
        if (connectsRemoved) {
            throw new TariffAlgorithmError("Территория помечена на удаление, подключить её нельзя");
        }
    }
    await db.transaction(async (query) => {
        for (const item of items) {
            await query(
                `
                UPDATE tariff_algorithms
                SET sales_share_weight = $2,
                    price_share_weight = $3
                WHERE code = $1
                `,
                [item.code, item.salesShareWeight, item.priceShareWeight],
            );
            await query(`DELETE FROM tariff_algorithm_weight_grants WHERE algorithm_code = $1`, [item.code]);
            for (const territoryUuid of item.territoryUuids) {
                await query(
                    `
                    INSERT INTO tariff_algorithm_weight_grants (algorithm_code, territory_uuid)
                    VALUES ($1, $2::uuid)
                    `,
                    [item.code, territoryUuid],
                );
            }
            await query(`DELETE FROM tariff_algorithm_reference_grants WHERE algorithm_code = $1`, [item.code]);
            for (const territoryUuid of item.referenceTerritoryUuids) {
                await query(
                    `
                    INSERT INTO tariff_algorithm_reference_grants (algorithm_code, territory_uuid)
                    VALUES ($1, $2::uuid)
                    `,
                    [item.code, territoryUuid],
                );
            }
        }
    });
    await audit(access.username, "tariff-algorithms.save", items.map((item) => `${item.code}:${item.salesShareWeight}/${item.priceShareWeight}:вес ${item.territoryUuids.length}, опора ${item.referenceTerritoryUuids.length}`).join("; "));
    return getTariffAlgorithmSettings();
}

function grantIndex(grants: Array<{ algorithmCode: string; territoryUuid: string }>): Map<string, string[]> {
    const byAlgorithm = new Map<string, string[]>();
    for (const grant of grants) {
        const list = byAlgorithm.get(grant.algorithmCode) ?? [];
        list.push(grant.territoryUuid);
        byAlgorithm.set(grant.algorithmCode, list);
    }
    return byAlgorithm;
}
