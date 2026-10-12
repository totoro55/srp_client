import { readVersionSettings, type BasketParameter } from "@/lib/baskets";
import {
    buildRrsEditPolicy,
    closedPeriodMessage,
    monthIsOpen,
    versionChangeOpen,
    versionLockedMessage,
} from "@/lib/rrs-edit-window";
import { getAppSettings } from "@/services/app-settings";
import {
    parseConnectionValue,
    type RrsBasketOffer,
    type RrsConnectionInput,
    type RrsConnectionSlice,
    type RrsCard,
    type RrsCardSummary,
    type RrsHistoryEvent,
    type RrsSavedPeriod,
    type RrsConnectedBasket,
    type RrsMonthState,
    type RrsTerritory,
    type RrsVersionOffer,
} from "@/lib/rrs";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import type { QueryResultRow } from "pg";

export class RrsRuleError extends Error {
    readonly status: 400 | 403 | 404;

    constructor(status: 400 | 403 | 404, message: string) {
        super(message);
        this.name = "RrsRuleError";
        this.status = status;
    }
}

type Sql = <R extends QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>;

interface BasketOfferRow {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorName: string;
    mandatory: boolean;
    versionId: number | null;
    versionNo: number | null;
    versionName: string | null;
    versionDescription: string | null;
    versionStatus: string | null;
    settings: unknown;
    dataTable: string | null;
}

interface VersionRow {
    id: number;
    basketId: number;
    status: string;
    dataTable: string | null;
    settings: unknown;
}

interface LatestRow {
    basketId: number;
    versionId: number | null;
    period: string;
}

const DATA_TABLE_PATTERN = /^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$/;

export async function listRrsTerritories(access: AccessView): Promise<RrsTerritory[]> {
    const scope = access.role?.scopeKind;
    if (scope === "division" || access.fullAccess) {
        return db.query<RrsTerritory>(
            `SELECT uuid, code, name FROM territories ORDER BY name`,
        );
    }
    if (scope === "granted") {
        return db.query<RrsTerritory>(
            `
            SELECT t.uuid, t.code, t.name
            FROM scope_grants g
            JOIN territories t ON t.uuid = g.territory_uuid
            WHERE lower(g.username) = lower($1)
            ORDER BY t.name
            `,
            [access.username],
        );
    }
    return [];
}

export async function listConnectableBaskets(): Promise<RrsBasketOffer[]> {
    return loadOffers(db.query.bind(db));
}

export async function listRrsCards(access: AccessView): Promise<RrsCardSummary[]> {
    const territories = await listRrsTerritories(access);
    if (territories.length === 0) {
        return [];
    }
    const rows = await db.query<{
        territoryUuid: string;
        basketId: number;
        basketName: string;
        mandatory: boolean;
        versionId: number | null;
        cardPeriod: string;
    }>(
        `
        WITH scoped AS (
            SELECT territory_uuid, basket_id, period, version_id
            FROM basket_connections
            WHERE territory_uuid = ANY($1::uuid[])
        ),
        bounds AS (
            SELECT territory_uuid,
                   COALESCE(
                       MAX(period) FILTER (WHERE period <= $2::date),
                       MIN(period)
                   ) AS period
            FROM scoped
            GROUP BY territory_uuid
        )
        SELECT DISTINCT ON (c.territory_uuid, c.basket_id)
            c.territory_uuid AS "territoryUuid",
            c.basket_id AS "basketId",
            b.name AS "basketName",
            b.mandatory,
            c.version_id AS "versionId",
            to_char(bounds.period, 'YYYY-MM-DD') AS "cardPeriod"
        FROM scoped c
        JOIN bounds ON bounds.territory_uuid = c.territory_uuid
        JOIN baskets b ON b.id = c.basket_id
        WHERE c.period <= bounds.period
        ORDER BY c.territory_uuid, c.basket_id, c.period DESC
        `,
        [territories.map((territory) => territory.uuid), calendarMonthStart()],
    );
    const byTerritory = new Map<string, RrsCardSummary>();
    for (const row of rows) {
        const territory = territories.find((item) => item.uuid === row.territoryUuid);
        if (!territory) {
            continue;
        }
        let card = byTerritory.get(row.territoryUuid);
        if (!card) {
            card = { territory, period: row.cardPeriod, baskets: [] };
            byTerritory.set(row.territoryUuid, card);
        }
        if (row.versionId !== null) {
            const basket: RrsConnectedBasket = { id: row.basketId, name: row.basketName, mandatory: row.mandatory };
            card.baskets.push(basket);
        }
    }
    for (const card of byTerritory.values()) {
        card.baskets.sort((left, right) => Number(right.mandatory) - Number(left.mandatory) || left.name.localeCompare(right.name, "ru"));
    }
    return [...byTerritory.values()].sort((left, right) => left.territory.name.localeCompare(right.territory.name, "ru"));
}

export async function getRrsCard(access: AccessView, territoryUuid: string, requestedPeriod: string | null = null): Promise<RrsCard> {
    await assertTerritory(access, territoryUuid);
    const savedPeriods = await listSavedPeriods(territoryUuid);
    if (savedPeriods.length === 0) {
        throw new RrsRuleError(404, "Карточка РРС ещё не создана");
    }
    const today = calendarMonthStart();
    const appliedPeriod = [...savedPeriods].map((item) => item.period).filter((period) => period <= today).sort().at(-1) ?? null;
    if (requestedPeriod && !savedPeriods.some((item) => item.period === requestedPeriod)) {
        throw new RrsRuleError(400, "Такого сохранения нет");
    }
    const period = requestedPeriod ?? appliedPeriod ?? [...savedPeriods].map((item) => item.period).sort()[0];
    const month = await getRrsMonth(access, territoryUuid, period);
    const territory = (await listRrsTerritories(access)).find((item) => item.uuid.toLowerCase() === territoryUuid.toLowerCase());
    if (!territory) {
        throw new RrsRuleError(403, "Эта РРС вам не назначена");
    }
    const settings = await getAppSettings();
    return {
        territory,
        period,
        appliedPeriod,
        savedPeriods,
        baskets: month.baskets,
        connections: month.connections,
        editPolicy: buildRrsEditPolicy(settings.rrsEditCutoffDay),
    };
}

export async function listRrsHistory(access: AccessView, territoryUuid: string): Promise<RrsHistoryEvent[]> {
    await assertTerritory(access, territoryUuid);
    const rows = await db.query<HistoryRow>(
        `
        SELECT FALSE AS replaced,
               to_char(c.period, 'YYYY-MM-DD') AS period,
               c.connected_at AS "savedAt",
               c.connected_by AS "savedBy",
               c.basket_id AS "basketId",
               b.name AS "basketName",
               c.version_id AS "versionId"
        FROM basket_connections c
        JOIN baskets b ON b.id = c.basket_id
        WHERE c.territory_uuid = $1
        UNION ALL
        SELECT TRUE,
               to_char(l.period, 'YYYY-MM-DD'),
               l.recorded_at,
               l.recorded_by,
               l.basket_id,
               b.name,
               l.version_id
        FROM basket_connections_log l
        JOIN baskets b ON b.id = l.basket_id
        WHERE l.territory_uuid = $1
        `,
        [territoryUuid],
    );
    const versionIds = [...new Set(rows.flatMap((row) => row.versionId === null ? [] : [row.versionId]))];
    const versions = await loadHistoryVersions(versionIds);
    const byVersion = new Map(versions.map((version) => [version.id, version]));
    const groups = new Map<string, RrsHistoryEvent>();
    for (const row of rows) {
        const at = toIso(row.savedAt);
        const key = `${row.replaced}|${row.period}|${at}|${row.savedBy}`;
        let event = groups.get(key);
        if (!event) {
            event = { at, by: row.savedBy, period: row.period, replaced: row.replaced, changes: [] };
            groups.set(key, event);
        }
        const version = row.versionId === null ? undefined : byVersion.get(row.versionId);
        const values = version
            ? await readHistoryValues(db.query.bind(db), version, territoryUuid, row.period, row.replaced ? row.savedAt : null)
            : [];
        event.changes.push({
            basketId: row.basketId,
            basketName: row.basketName,
            versionId: row.versionId,
            versionLabel: version ? `№ ${version.versionNo} ${version.name}` : null,
            values,
        });
    }
    return [...groups.values()]
        .map((event) => ({
            ...event,
            changes: [...event.changes].sort((left, right) => left.basketName.localeCompare(right.basketName, "ru")),
        }))
        .sort((left, right) => right.at.localeCompare(left.at) || Number(left.replaced) - Number(right.replaced));
}

export async function getRrsMonth(access: AccessView, territoryUuid: string, period: string): Promise<RrsMonthState> {
    await assertTerritory(access, territoryUuid);
    const baskets = await loadOffers(db.query.bind(db));
    const connections = await loadSlices(db.query.bind(db), territoryUuid, period);
    return { baskets, connections };
}

export async function saveRrsMonth(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: RrsConnectionInput[],
): Promise<void> {
    await assertTerritory(access, territoryUuid);
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    const targetMonth = period.slice(0, 7);
    if (!monthIsOpen(targetMonth, policy)) {
        throw new RrsRuleError(400, closedPeriodMessage(policy));
    }
    await db.transaction(async (query) => {
        const baskets = await loadOffers(query);
        const byId = new Map(baskets.map((basket) => [basket.id, basket]));
        if (items.length !== byId.size || new Set(items.map((item) => item.basketId)).size !== items.length) {
            throw new RrsRuleError(400, "Сохраните весь набор действующих корзин");
        }

        const versions = await loadVersions(query, baskets.map((basket) => basket.id));
        const latest = await loadLatest(query, territoryUuid, period);
        const latestByBasket = new Map(latest.map((row) => [row.basketId, row]));
        const head = await loadHead(query, territoryUuid);
        const headByBasket = new Map(head.map((row) => [row.basketId, row]));
        const sliceValues = await loadSliceValues(query, territoryUuid, latest, versions);

        for (const item of items) {
            const basket = byId.get(item.basketId);
            if (!basket) {
                throw new RrsRuleError(400, "В наборе есть неизвестная корзина");
            }
            const current = latestByBasket.get(basket.id) ?? null;
            const storedValues = current ? sliceValues.get(basket.id) ?? null : null;
            if (item.connected && !versionChangeOpen(targetMonth, policy)) {
                const requiredVersionId = lockedVersionId(targetMonth, current, headByBasket.get(basket.id) ?? null);
                if (requiredVersionId !== null && item.versionId !== requiredVersionId) {
                    throw new RrsRuleError(400, versionLockedMessage(basket.name));
                }
            }
            if (item.connected) {
                await writeConnected(query, access.username, territoryUuid, period, basket, item, versions, current, storedValues);
            } else {
                await writeDisconnected(query, access.username, territoryUuid, period, basket, current, versions);
            }
        }
    });
}

async function assertTerritory(access: AccessView, territoryUuid: string): Promise<void> {
    const territories = await listRrsTerritories(access);
    if (!territories.some((territory) => territory.uuid.toLowerCase() === territoryUuid.toLowerCase())) {
        throw new RrsRuleError(403, "Эта РРС вам не назначена");
    }
}

async function loadOffers(query: Sql): Promise<RrsBasketOffer[]> {
    const rows = await query<BasketOfferRow>(
        `
        SELECT
            b.id,
            b.code,
            b.name,
            b.description,
            i.name AS "indicatorName",
            b.mandatory,
            v.id AS "versionId",
            v.version_no AS "versionNo",
            v.name AS "versionName",
            v.description AS "versionDescription",
            v.status AS "versionStatus",
            v.settings,
            v.data_table AS "dataTable"
        FROM baskets b
        JOIN indicators i ON i.id = b.indicator_id
        LEFT JOIN basket_versions v
            ON v.basket_id = b.id
           AND v.status IN ('test', 'working')
           AND v.data_table IS NOT NULL
        WHERE b.status = 'active'
        ORDER BY b.mandatory DESC, b.name, v.version_no
        `,
    );
    const baskets = new Map<number, RrsBasketOffer>();
    for (const row of rows) {
        let basket = baskets.get(row.id);
        if (!basket) {
            basket = {
                id: row.id,
                code: row.code,
                name: row.name,
                description: row.description,
                indicatorName: row.indicatorName,
                mandatory: row.mandatory,
                versions: [],
            };
            baskets.set(row.id, basket);
        }
        if (row.versionId !== null && row.versionNo !== null && row.versionName && (row.versionStatus === "test" || row.versionStatus === "working")) {
            const version: RrsVersionOffer = {
                id: row.versionId,
                versionNo: row.versionNo,
                name: row.versionName,
                description: row.versionDescription ?? "",
                status: row.versionStatus,
                parameters: readVersionSettings(row.settings).parameters,
            };
            basket.versions.push(version);
        }
    }
    return [...baskets.values()];
}

interface HistoryRow {
    replaced: boolean;
    period: string;
    savedAt: Date | string;
    savedBy: string;
    basketId: number;
    basketName: string;
    versionId: number | null;
}

interface HistoryVersion {
    id: number;
    versionNo: number;
    name: string;
    dataTable: string | null;
    settings: unknown;
}

async function listSavedPeriods(territoryUuid: string): Promise<RrsSavedPeriod[]> {
    const rows = await db.query<{ period: string; savedAt: Date | string; savedBy: string }>(
        `
        SELECT to_char(period, 'YYYY-MM-DD') AS period,
               MAX(connected_at) AS "savedAt",
               (ARRAY_AGG(connected_by ORDER BY connected_at DESC))[1] AS "savedBy"
        FROM basket_connections
        WHERE territory_uuid = $1
        GROUP BY period
        ORDER BY period DESC
        `,
        [territoryUuid],
    );
    return rows.map((row) => ({
        period: row.period,
        savedAt: toIso(row.savedAt),
        savedBy: row.savedBy,
    }));
}

async function loadHistoryVersions(versionIds: number[]): Promise<HistoryVersion[]> {
    if (versionIds.length === 0) {
        return [];
    }
    return db.query<HistoryVersion>(
        `
        SELECT id,
               version_no AS "versionNo",
               name,
               data_table AS "dataTable",
               settings
        FROM basket_versions
        WHERE id = ANY($1::int[])
        `,
        [versionIds],
    );
}

async function readHistoryValues(
    query: Sql,
    version: HistoryVersion,
    territoryUuid: string,
    period: string,
    recordedAt: Date | string | null,
): Promise<{ title: string; value: string }[]> {
    if (!version.dataTable || !DATA_TABLE_PATTERN.test(version.dataTable)) {
        return [];
    }
    const parameters = readVersionSettings(version.settings).parameters;
    const raw = recordedAt === null
        ? await readParameterValues(query, version.dataTable, parameters, territoryUuid, period)
        : await readLoggedParameterValues(query, version.dataTable, parameters, territoryUuid, period, recordedAt);
    return parameters.map((parameter) => ({
        title: parameter.title,
        value: (raw[parameter.key] ?? "").trim() || "—",
    }));
}

async function readLoggedParameterValues(
    query: Sql,
    dataTable: string,
    parameters: BasketParameter[],
    territoryUuid: string,
    period: string,
    recordedAt: Date | string,
): Promise<Record<string, string>> {
    if (parameters.length === 0) {
        return {};
    }
    const columns = parameters.map((parameter) => `${quoteIdent(parameter.key)} AS ${quoteIdent(parameter.key)}`).join(", ");
    const found = await query<Record<string, unknown>>(
        `
        SELECT ${columns}
        FROM basket_data.${quoteIdent(`${dataTable}_log`)}
        WHERE territory_uuid = $1 AND period = $2::date AND recorded_at = $3
        ORDER BY id DESC
        LIMIT 1
        `,
        [territoryUuid, period, recordedAt],
    );
    return stringifyValues(parameters, found[0]);
}

function calendarMonthStart(now = new Date()): string {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}-01`;
}

function toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function loadVersions(query: Sql, basketIds: number[]): Promise<VersionRow[]> {
    if (basketIds.length === 0) {
        return [];
    }
    return query<VersionRow>(
        `
        SELECT id, basket_id AS "basketId", status, data_table AS "dataTable", settings
        FROM basket_versions
        WHERE basket_id = ANY($1::int[])
        `,
        [basketIds],
    );
}

function lockedVersionId(targetMonth: string, asOf: LatestRow | null, head: LatestRow | null): number | null {
    if (asOf?.versionId != null && asOf.period.slice(0, 7) === targetMonth) {
        return asOf.versionId;
    }
    return head?.versionId ?? null;
}

async function loadHead(query: Sql, territoryUuid: string): Promise<LatestRow[]> {
    return query<LatestRow>(
        `
        SELECT DISTINCT ON (basket_id)
            basket_id AS "basketId",
            version_id AS "versionId",
            to_char(period, 'YYYY-MM-DD') AS period
        FROM basket_connections
        WHERE territory_uuid = $1
        ORDER BY basket_id, period DESC
        `,
        [territoryUuid],
    );
}

async function loadLatest(query: Sql, territoryUuid: string, period: string): Promise<LatestRow[]> {
    return query<LatestRow>(
        `
        SELECT DISTINCT ON (basket_id)
            basket_id AS "basketId",
            version_id AS "versionId",
            to_char(period, 'YYYY-MM-DD') AS period
        FROM basket_connections
        WHERE territory_uuid = $1
          AND period <= $2::date
        ORDER BY basket_id, period DESC
        `,
        [territoryUuid, period],
    );
}

async function loadSlices(query: Sql, territoryUuid: string, period: string): Promise<RrsConnectionSlice[]> {
    const latest = await loadLatest(query, territoryUuid, period);
    const versions = await loadVersions(query, [...new Set(latest.map((row) => row.basketId))]);
    const values = await loadSliceValues(query, territoryUuid, latest, versions);
    return latest.map((row) => ({
        basketId: row.basketId,
        versionId: row.versionId,
        period: row.period,
        values: values.get(row.basketId) ?? null,
    }));
}

async function loadSliceValues(
    query: Sql,
    territoryUuid: string,
    latest: LatestRow[],
    versions: VersionRow[],
): Promise<Map<number, Record<string, string>>> {
    const byVersion = new Map(versions.map((version) => [version.id, version]));
    const values = new Map<number, Record<string, string>>();
    for (const row of latest) {
        if (row.versionId === null) {
            continue;
        }
        const version = byVersion.get(row.versionId);
        if (!version?.dataTable || !DATA_TABLE_PATTERN.test(version.dataTable)) {
            continue;
        }
        const parameters = readVersionSettings(version.settings).parameters;
        values.set(row.basketId, await readParameterValues(query, version.dataTable, parameters, territoryUuid, row.period));
    }
    return values;
}

async function writeConnected(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    basket: RrsBasketOffer,
    item: RrsConnectionInput,
    versions: VersionRow[],
    current: LatestRow | null,
    storedValues: Record<string, string> | null,
): Promise<void> {
    const version = basket.versions.find((candidate) => candidate.id === item.versionId);
    if (!version) {
        throw new RrsRuleError(400, basket.versions.length === 0
            ? `У корзины «${basket.name}» нет версии для подключения`
            : `Выберите версию корзины «${basket.name}»`);
    }
    const storedVersion = versions.find((candidate) => candidate.id === version.id);
    if (!storedVersion?.dataTable || !DATA_TABLE_PATTERN.test(storedVersion.dataTable)) {
        throw new RrsRuleError(400, `У корзины «${basket.name}» нет таблицы подключения`);
    }
    const parsed: Record<string, string | number> = {};
    for (const parameter of version.parameters) {
        const value = parseConnectionValue(parameter, item.values[parameter.key] ?? "");
        if ("error" in value) {
            throw new RrsRuleError(400, `${basket.name}: ${value.error}`);
        }
        parsed[parameter.key] = value.value;
    }
    if (current?.versionId === version.id && sameValues(version.parameters, storedValues, parsed)) {
        return;
    }

    const editingThisMonth = current?.period === period;
    if (editingThisMonth && current) {
        await logRegistry(query, actor, territoryUuid, basket.id, period);
        if (current.versionId !== null && current.versionId !== version.id) {
            await logAndDeleteParameters(query, actor, territoryUuid, period, versions, current.versionId);
        }
        await query(
            `
            UPDATE basket_connections
            SET version_id = $4, connected_at = NOW(), connected_by = $5
            WHERE territory_uuid = $1 AND basket_id = $2 AND period = $3::date
            `,
            [territoryUuid, basket.id, period, version.id, actor],
        );
        if (current.versionId === version.id) {
            await updateParameters(query, actor, territoryUuid, period, storedVersion.dataTable, version.parameters, parsed);
            return;
        }
    } else {
        await query(
            `
            INSERT INTO basket_connections (territory_uuid, basket_id, period, version_id, connected_by)
            VALUES ($1, $2, $3::date, $4, $5)
            `,
            [territoryUuid, basket.id, period, version.id, actor],
        );
    }
    await insertParameters(query, actor, territoryUuid, period, storedVersion.dataTable, version.parameters, parsed);
}

async function writeDisconnected(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    basket: RrsBasketOffer,
    current: LatestRow | null,
    versions: VersionRow[],
): Promise<void> {
    if (basket.mandatory) {
        throw new RrsRuleError(400, `Корзину «${basket.name}» нужно включить: она обязательна для РРС`);
    }
    if (!current || current.versionId === null) {
        return;
    }
    if (current.period === period) {
        await logRegistry(query, actor, territoryUuid, basket.id, period);
        await logAndDeleteParameters(query, actor, territoryUuid, period, versions, current.versionId);
        await query(
            `
            UPDATE basket_connections
            SET version_id = NULL, connected_at = NOW(), connected_by = $4
            WHERE territory_uuid = $1 AND basket_id = $2 AND period = $3::date
            `,
            [territoryUuid, basket.id, period, actor],
        );
        return;
    }
    await query(
        `
        INSERT INTO basket_connections (territory_uuid, basket_id, period, version_id, connected_by)
        VALUES ($1, $2, $3::date, NULL, $4)
        `,
        [territoryUuid, basket.id, period, actor],
    );
}

async function logRegistry(query: Sql, actor: string, territoryUuid: string, basketId: number, period: string): Promise<void> {
    await query(
        `
        INSERT INTO basket_connections_log (
            territory_uuid, basket_id, period, version_id, connected_at, connected_by, recorded_by
        )
        SELECT territory_uuid, basket_id, period, version_id, connected_at, connected_by, $4
        FROM basket_connections
        WHERE territory_uuid = $1 AND basket_id = $2 AND period = $3::date
        `,
        [territoryUuid, basketId, period, actor],
    );
}

async function logAndDeleteParameters(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    versions: VersionRow[],
    versionId: number,
): Promise<void> {
    const version = versions.find((candidate) => candidate.id === versionId);
    if (!version?.dataTable || !DATA_TABLE_PATTERN.test(version.dataTable)) {
        return;
    }
    const table = quoteIdent(version.dataTable);
    const parameters = readVersionSettings(version.settings).parameters;
    const columns = parameters.map((parameter) => quoteIdent(parameter.key)).join(", ");
    const columnList = columns.length > 0 ? `, ${columns}` : "";
    await query(
        `
        INSERT INTO basket_data.${quoteIdent(`${version.dataTable}_log`)} (
            territory_uuid, period, connected_at, connected_by${columnList}, recorded_by
        )
        SELECT territory_uuid, period, connected_at, connected_by${columnList}, $3
        FROM basket_data.${table}
        WHERE territory_uuid = $1 AND period = $2::date
        `,
        [territoryUuid, period, actor],
    );
    await query(
        `DELETE FROM basket_data.${table} WHERE territory_uuid = $1 AND period = $2::date`,
        [territoryUuid, period],
    );
}

async function insertParameters(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    dataTable: string,
    parameters: BasketParameter[],
    values: Record<string, string | number>,
): Promise<void> {
    const names = ["territory_uuid", "period", "connected_by", ...parameters.map((parameter) => quoteIdent(parameter.key))];
    const placeholders = ["$1", "$2::date", "$3", ...parameters.map((_, index) => `$${index + 4}`)];
    await query(
        `
        INSERT INTO basket_data.${quoteIdent(dataTable)} (${names.join(", ")})
        VALUES (${placeholders.join(", ")})
        `,
        [territoryUuid, period, actor, ...parameters.map((parameter) => values[parameter.key])],
    );
}

async function updateParameters(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    dataTable: string,
    parameters: BasketParameter[],
    values: Record<string, string | number>,
): Promise<void> {
    const assignments = [
        "connected_at = NOW()",
        "connected_by = $3",
        ...parameters.map((parameter, index) => `${quoteIdent(parameter.key)} = $${index + 4}`),
    ];
    await query(
        `
        UPDATE basket_data.${quoteIdent(dataTable)}
        SET ${assignments.join(", ")}
        WHERE territory_uuid = $1 AND period = $2::date
        `,
        [territoryUuid, period, actor, ...parameters.map((parameter) => values[parameter.key])],
    );
}

async function readParameterValues(
    query: Sql,
    dataTable: string,
    parameters: BasketParameter[],
    territoryUuid: string,
    period: string,
): Promise<Record<string, string>> {
    if (parameters.length === 0) {
        return {};
    }
    const columns = parameters.map((parameter) => `${quoteIdent(parameter.key)} AS ${quoteIdent(parameter.key)}`).join(", ");
    const found = await query<Record<string, unknown>>(
        `
        SELECT ${columns}
        FROM basket_data.${quoteIdent(dataTable)}
        WHERE territory_uuid = $1 AND period = $2::date
        `,
        [territoryUuid, period],
    );
    return stringifyValues(parameters, found[0]);
}

function stringifyValues(parameters: BasketParameter[], row: Record<string, unknown> | undefined): Record<string, string> {
    const values: Record<string, string> = {};
    if (!row) {
        return values;
    }
    for (const parameter of parameters) {
        const value = row[parameter.key];
        values[parameter.key] = value === null || value === undefined ? "" : String(value);
    }
    return values;
}

function sameValues(
    parameters: BasketParameter[],
    stored: Record<string, string> | null,
    incoming: Record<string, string | number>,
): boolean {
    if (!stored) {
        return false;
    }
    return parameters.every((parameter) => {
        const left = stored[parameter.key];
        const right = incoming[parameter.key];
        if (parameter.kind === "number") {
            return Number(left) === Number(right);
        }
        return left === String(right);
    });
}

function quoteIdent(name: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
        throw new RrsRuleError(400, "Недопустимое имя поля подключения");
    }
    return `"${name}"`;
}
