import { readVersionSettings, type BasketCoefficient } from "@/lib/baskets";
import { coefficientValueIssue } from "@/lib/coefficient-value";
import { buildChangeEvents, snapshotsFromRows, type StoredChangeRow } from "@/lib/field-changes";
import { closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { RrsCoefficientPage, RrsCoefficientValue, RrsFieldChangeEvent } from "@/lib/rrs";
import { getRrsCard, getRrsMonth, RrsRuleError } from "@/services/basket-connections";
import { listEnabledBranchUuids } from "@/services/branch-motivation";
import { db } from "@/services/db";
import { branchListedInPeriod } from "@/services/directory-visibility";
import type { AccessView } from "@/server/authz/resolve-access";

export async function getBranchCoefficients(
    access: AccessView,
    territoryUuid: string,
    requestedPeriod: string | null,
): Promise<RrsCoefficientPage> {
    const card = await getRrsCard(access, territoryUuid, null);
    const savedPeriods = card.savedPeriods.map((item) => item.period);
    const period = requestedPeriod ?? card.period;
    const month = await getRrsMonth(access, territoryUuid, period);
    const connectedIds = month.connections.flatMap((item) => item.versionId === null ? [] : [item.versionId]);
    const versionRows = connectedIds.length === 0
        ? []
        : await db.query<{
            id: number;
            basketId: number;
            basketName: string;
            indicatorName: string;
            versionNo: number;
            versionName: string;
            settings: unknown;
            sortOrder: number;
        }>(
            `
            SELECT v.id,
                   b.id AS "basketId",
                   b.name AS "basketName",
                   i.name AS "indicatorName",
                   b.sort_order AS "sortOrder",
                   v.version_no AS "versionNo",
                   v.name AS "versionName",
                   v.settings
            FROM basket_versions v
            JOIN baskets b ON b.id = v.basket_id
            JOIN indicators i ON i.id = b.indicator_id
            WHERE v.id = ANY($1::int[])
            `,
            [connectedIds],
        );
    const baskets = versionRows
        .map((row) => ({
            id: row.basketId,
            name: row.basketName,
            indicatorName: row.indicatorName,
            versionId: row.id,
            versionNo: row.versionNo,
            versionName: row.versionName,
            sortOrder: row.sortOrder,
            coefficients: readVersionSettings(row.settings).coefficients.map((coefficient) => ({
                ...coefficient,
                description: coefficient.description ?? "",
            })),
        }))
        .filter((basket) => basket.coefficients.length > 0)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ru"))
        .map(({ sortOrder: _sortOrder, ...basket }) => basket);

    const enabledBranches = await listEnabledBranchUuids(territoryUuid, period);
    const branches = await db.query<{ uuid: string; code: string; name: string }>(
        `
        SELECT branch.uuid::text AS uuid, branch.code, branch.name
        FROM branches branch
        WHERE branch.territory_uuid = $1
          AND ${branchListedInPeriod("branch", "$2")}
        ORDER BY branch.name
        `,
        [territoryUuid, period],
    );
    const connectionRows = await db.query<{ basketId: number; versionId: number; period: string }>(
        `
        SELECT basket_id AS "basketId",
               version_id AS "versionId",
               to_char(period, 'YYYY-MM-DD') AS period
        FROM basket_connections
        WHERE territory_uuid = $1
          AND period <= $2::date
          AND version_id IS NOT NULL
        ORDER BY basket_id, period DESC
        `,
        [territoryUuid, period],
    );
    const versionStart = versionStartByBasket(connectionRows);
    const values = await db.query<{ branchUuid: string; basketId: number; key: string; value: string; period: string }>(
        `
        SELECT DISTINCT ON (branch_uuid, basket_id, coefficient_key)
               branch_uuid::text AS "branchUuid",
               basket_id AS "basketId",
               coefficient_key AS key,
               value::text AS value,
               to_char(period, 'YYYY-MM-DD') AS period
        FROM basket_branch_coefficients
        WHERE territory_uuid = $1
          AND period <= $2::date
        ORDER BY branch_uuid, basket_id, coefficient_key, period DESC
        `,
        [territoryUuid, period],
    );
    const allowed = new Set(baskets.flatMap((basket) => basket.coefficients.map((item) => `${basket.id}:${item.key}`)));
    return {
        territory: card.territory,
        period,
        editable: monthIsOpen(period.slice(0, 7), card.editPolicy),
        branches: branches
            .map((branch) => ({ ...branch, uuid: branch.uuid.toLowerCase() }))
            .filter((branch) => enabledBranches.has(branch.uuid)),
        baskets,
        values: values
            .filter((item) => {
                const start = versionStart.get(item.basketId);
                return enabledBranches.has(item.branchUuid.toLowerCase())
                    && start !== undefined
                    && item.period >= start
                    && allowed.has(`${item.basketId}:${item.key}`);
            })
            .map((item) => ({ branchUuid: item.branchUuid.toLowerCase(), basketId: item.basketId, key: item.key, value: item.value })),
        savedPeriods,
        appliedPeriod: card.appliedPeriod,
        editPolicy: card.editPolicy,
    };
}

export async function saveBranchCoefficients(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: RrsCoefficientValue[],
): Promise<void> {
    const page = await getBranchCoefficients(access, territoryUuid, period);
    if (!page.editable) {
        throw new RrsRuleError(400, closedPeriodMessage(page.editPolicy));
    }
    const branchIds = new Set(page.branches.map((branch) => branch.uuid));
    const coefficients = new Map<string, { basketName: string; coefficient: BasketCoefficient }>();
    for (const basket of page.baskets) {
        for (const coefficient of basket.coefficients) {
            coefficients.set(`${basket.id}:${coefficient.key}`, { basketName: basket.name, coefficient });
        }
    }
    const prepared: { branchUuid: string; basketId: number; key: string; value: number }[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const branchUuid = item.branchUuid.toLowerCase();
        if (!branchIds.has(branchUuid)) {
            throw new RrsRuleError(400, "Филиал не включён в мотивацию на выбранный месяц");
        }
        const found = coefficients.get(`${item.basketId}:${item.key}`);
        if (!found) {
            throw new RrsRuleError(400, "Коэффициент не задан у подключённой версии");
        }
        const identity = `${branchUuid}:${item.basketId}:${item.key}`;
        if (seen.has(identity)) {
            throw new RrsRuleError(400, "Коэффициент филиала указан дважды");
        }
        seen.add(identity);
        const value = parseCoefficientValue(item.value, found.coefficient, found.basketName);
        prepared.push({ branchUuid, basketId: item.basketId, key: item.key, value });
    }

    await db.transaction(async (query) => {
        await query(
            `
            INSERT INTO basket_branch_coefficients_log (
                territory_uuid, basket_id, period, branch_uuid, coefficient_key, value, set_at, set_by, recorded_by
            )
            SELECT territory_uuid, basket_id, period, branch_uuid, coefficient_key, value, set_at, set_by, $3
            FROM basket_branch_coefficients
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period, access.username],
        );
        await query(
            `
            DELETE FROM basket_branch_coefficients AS coefficient
            WHERE coefficient.territory_uuid = $1
              AND coefficient.period = $2::date
              AND (
                  coefficient.branch_uuid = ANY($3::uuid[])
                  OR NOT EXISTS (
                      SELECT 1
                      FROM branches AS branch
                      WHERE branch.uuid = coefficient.branch_uuid
                        AND branch.deleted
                  )
              )
            `,
            [territoryUuid, page.period, [...new Set(prepared.map((item) => item.branchUuid)), "00000000-0000-0000-0000-000000000000"]],
        );
        for (const item of prepared) {
            await query(
                `
                INSERT INTO basket_branch_coefficients (
                    territory_uuid, basket_id, period, branch_uuid, coefficient_key, value, set_by
                )
                VALUES ($1, $2, $3::date, $4::uuid, $5, $6, $7)
                `,
                [territoryUuid, item.basketId, page.period, item.branchUuid, item.key, item.value, access.username],
            );
        }
    });
}

const DEFAULT_COEFFICIENT = "1";

export async function listCoefficientHistory(
    access: AccessView,
    territoryUuid: string,
    period: string,
): Promise<RrsFieldChangeEvent[]> {
    const page = await getBranchCoefficients(access, territoryUuid, period);
    const [branches, current, archived] = await Promise.all([
        db.query<{ uuid: string; name: string }>(
            `
            SELECT uuid::text AS uuid, name
            FROM branches
            WHERE territory_uuid = $1
            `,
            [territoryUuid],
        ),
        db.query<CoefficientHistoryRow>(
            `
            SELECT branch_uuid::text AS "branchUuid",
                   basket_id AS "basketId",
                   coefficient_key AS key,
                   value::text AS value,
                   set_at AS "setAt",
                   set_by AS "setBy"
            FROM basket_branch_coefficients
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period],
        ),
        db.query<CoefficientHistoryRow & { recordedAt: Date; recordedBy: string }>(
            `
            SELECT branch_uuid::text AS "branchUuid",
                   basket_id AS "basketId",
                   coefficient_key AS key,
                   value::text AS value,
                   set_at AS "setAt",
                   set_by AS "setBy",
                   recorded_at AS "recordedAt",
                   recorded_by AS "recordedBy"
            FROM basket_branch_coefficients_log
            WHERE territory_uuid = $1 AND period = $2::date
            `,
            [territoryUuid, page.period],
        ),
    ]);
    const branchNames = new Map(branches.map((branch) => [branch.uuid.toLowerCase(), branch.name]));
    const basketIds = [...new Set([...current, ...archived].map((row) => row.basketId))];
    const baskets = basketIds.length === 0
        ? []
        : await db.query<{ id: number; name: string; indicatorName: string }>(
            `
            SELECT b.id, b.name, i.name AS "indicatorName"
            FROM baskets b
            JOIN indicators i ON i.id = b.indicator_id
            WHERE b.id = ANY($1::int[])
            `,
            [basketIds],
        );
    const basketLabels = new Map(baskets.map((basket) => [basket.id, basket.indicatorName || basket.name]));
    const coefficientTitles = new Map<string, string>();
    for (const basket of page.baskets) {
        for (const coefficient of basket.coefficients) {
            coefficientTitles.set(`${basket.id}:${coefficient.key}`, coefficient.title);
        }
    }
    if (basketIds.length > 0) {
        const versions = await db.query<{ basketId: number; settings: unknown }>(
            `
            SELECT basket_id AS "basketId", settings
            FROM basket_versions
            WHERE basket_id = ANY($1::int[])
            `,
            [basketIds],
        );
        for (const version of versions) {
            for (const coefficient of readVersionSettings(version.settings).coefficients) {
                const id = `${version.basketId}:${coefficient.key}`;
                if (!coefficientTitles.has(id)) {
                    coefficientTitles.set(id, coefficient.title);
                }
            }
        }
    }
    const titles = new Map<string, string>();
    const toRow = (row: CoefficientHistoryRow & { recordedAt?: Date; recordedBy?: string }): StoredChangeRow<string> => {
        const branchUuid = row.branchUuid.toLowerCase();
        const id = `${branchUuid}:${row.basketId}:${row.key}`;
        if (!titles.has(id)) {
            const branchName = branchNames.get(branchUuid) ?? `Удалённый филиал ${branchUuid.slice(0, 8)}`;
            const basketName = basketLabels.get(row.basketId) ?? "Корзина";
            const coefficientTitle = coefficientTitles.get(`${row.basketId}:${row.key}`) ?? row.key;
            titles.set(id, `${branchName} · ${basketName} · ${coefficientTitle}`);
        }
        return {
            id,
            value: canonicalCoefficient(row.value),
            setAt: row.setAt,
            setBy: row.setBy,
            recordedAt: row.recordedAt,
            recordedBy: row.recordedBy,
        };
    };
    const snapshots = snapshotsFromRows(current.map(toRow), archived.map(toRow));
    const keys = [...titles.entries()].map(([id, title]) => ({ id, title }));
    return buildChangeEvents(
        snapshots,
        keys,
        DEFAULT_COEFFICIENT,
        formatCoefficient,
        (left, right) => left === right,
    );
}

interface CoefficientHistoryRow {
    branchUuid: string;
    basketId: number;
    key: string;
    value: string;
    setAt: Date;
    setBy: string;
}

function canonicalCoefficient(raw: string): string {
    const value = Number(raw.trim().replace(",", "."));
    if (!Number.isFinite(value)) {
        return raw.trim() || DEFAULT_COEFFICIENT;
    }
    return Object.is(value, -0) ? "0" : String(value);
}

function formatCoefficient(canonical: string): string {
    const value = Number(canonical);
    if (!Number.isFinite(value)) {
        return canonical;
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(value);
}

function versionStartByBasket(rows: { basketId: number; versionId: number; period: string }[]): Map<number, string> {
    const start = new Map<number, string>();
    const currentVersion = new Map<number, number>();
    const closed = new Set<number>();
    for (const row of rows) {
        if (closed.has(row.basketId)) {
            continue;
        }
        const version = currentVersion.get(row.basketId);
        if (version === undefined) {
            currentVersion.set(row.basketId, row.versionId);
            start.set(row.basketId, row.period);
            continue;
        }
        if (row.versionId !== version) {
            closed.add(row.basketId);
            continue;
        }
        start.set(row.basketId, row.period);
    }
    return start;
}

function parseCoefficientValue(raw: string, coefficient: BasketCoefficient, basketName: string): number {
    const issue = coefficientValueIssue(raw, coefficient);
    if (issue) {
        throw new RrsRuleError(400, `«${coefficient.title}» корзины «${basketName}»: ${issue}`);
    }
    return Number(raw.trim().replace(",", "."));
}
