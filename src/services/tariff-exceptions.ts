import type { QueryResultRow } from "pg";
import { SALES_INDICATOR_NAME, isTariffAxis, readVersionSettings, TARIFF_BOUND_KEYS, type TariffAxis } from "@/lib/baskets";
import { resolveConnectionValues } from "@/lib/rrs";
import { closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { calculateAlgorithmTariffs, calculateServiceTariffs, rowBecomesException, tariffRowComplete, territoryMean, type TariffSaveRow, type TariffServiceContext } from "@/lib/tariff-calculation";
import { isTariffBaseMode, type TariffCategoryFolder, type TariffExceptionInput, type TariffExceptionLine, type TariffExceptionPage, type TariffExceptionReport, type TariffExceptionReportRow, type TariffSegmentMatch, type CalculatedTariffRow } from "@/lib/tariff-exceptions";
import type { AccessView } from "@/server/authz/resolve-access";
import { getRrsCard, RrsRuleError } from "@/services/basket-connections";
import { db } from "@/services/db";

const AXIS_TABLE = {
    category: {
        directory: "product_categories",
        stats: "basket_category_stats",
        codeColumn: "category_uuid",
        tariffs: "basket_category_tariffs",
    },
    product_kind: {
        directory: "product_kinds",
        stats: "basket_kind_stats",
        codeColumn: "kind_uuid",
        tariffs: "basket_kind_tariffs",
    },
} as const;

/** Пустая, отрицательная или нулевая цена и количество в расчёт тарифа не входят. */
const USABLE_STAT = `stats.avg_price IS NOT NULL AND stats.sum_quantity IS NOT NULL AND stats.avg_price > 0 AND stats.sum_quantity > 0`;

async function loadSalesStats(territoryUuid: string, period: string, axis: TariffAxis): Promise<TariffExceptionPage["stats"]> {
    const source = AXIS_TABLE[axis];
    const rows = await db.query<{ code: string; title: string; parent: string | null; parent2: string | null; parent3: string | null; avgPrice: string | null; quantity: string | null; baseMode: string | null; main: string | null; im: string | null; b2b: string | null }>(
        `
        SELECT directory.uuid::text AS code,
               directory.name AS title,
               directory.parent_1 AS parent,
               directory.parent_2 AS "parent2",
               directory.parent_3 AS "parent3",
               stats.avg_price::text AS "avgPrice",
               stats.sum_quantity::text AS quantity,
               tariffs.base_mode AS "baseMode",
               tariffs.main::text AS main,
               tariffs.im::text AS im,
               tariffs.b2b::text AS b2b
        FROM ${source.stats} stats
        JOIN ${source.directory} directory ON directory.uuid = stats.${source.codeColumn}
        LEFT JOIN ${source.tariffs} tariffs
            ON tariffs.territory_uuid = stats.territory_uuid
           AND tariffs.period = stats.period
           AND tariffs.code = directory.uuid
        WHERE stats.territory_uuid = $1
          AND stats.period = $2::date
          AND ${USABLE_STAT}
        ORDER BY stats.sum_quantity DESC NULLS LAST, directory.name
        `,
        [territoryUuid, period],
    );
    return rows.map((row) => ({
        code: row.code,
        title: row.title,
        parent: blankToNull(row.parent),
        parent2: blankToNull(row.parent2),
        parent3: blankToNull(row.parent3),
        avgPrice: formatRate(row.avgPrice),
        quantity: formatRate(row.quantity),
        baseMode: isTariffBaseMode(row.baseMode) ? row.baseMode : null,
        main: formatRate(row.main),
        im: formatRate(row.im),
        b2b: formatRate(row.b2b),
    }));
}

interface SliceRow {
    axis: string;
    code: string;
    title: string;
    parent: string | null;
    baseMode: string;
    automatic: boolean;
    main: string | null;
    im: string | null;
    b2b: string | null;
    removed: boolean;
    fromPeriod: string;
}

export async function getTariffExceptions(
    access: AccessView,
    territoryUuid: string,
    requestedPeriod: string | null,
): Promise<TariffExceptionPage> {
    let card;
    try {
        card = await getRrsCard(access, territoryUuid, requestedPeriod);
    } catch (error) {
        if (error instanceof RrsRuleError && error.message === "Такого сохранения нет" && requestedPeriod) {
            const known = await getRrsCard(access, territoryUuid, null);
            if (requestedPeriod.slice(0, 7) !== known.editPolicy.currentMonth) {
                return emptyTariffPage(known, requestedPeriod);
            }
        }
        throw error;
    }
    const connection = await loadSalesConnection(territoryUuid, card.period);
    const axis = connection?.axis ?? null;
    const slices = await loadSlices(territoryUuid, card.period);
    const current = axis === null ? [] : slices.filter((row) => row.axis === axis && !row.removed);
    const other = slices.filter((row) => row.axis !== axis && !row.removed && isTariffAxis(row.axis));
    const inStats = axis === null ? new Set<string>() : await statsCodes(territoryUuid, card.period, axis, current.map((row) => row.code));
    return {
        territory: card.territory,
        period: card.period,
        appliedPeriod: card.appliedPeriod,
        savedPeriods: card.savedPeriods.map((item) => item.period),
        editable: axis !== null && monthIsOpen(card.period.slice(0, 7), card.editPolicy),
        editPolicy: card.editPolicy,
        connection,
        exceptions: current.map((row) => toLine(row, inStats.has(row.code))),
        stats: axis === null ? [] : await loadSalesStats(territoryUuid, card.period, axis),
        otherAxis: other[0] && isTariffAxis(other[0].axis) ? other[0].axis : null,
        otherAxisTitles: other.map((row) => row.title),
        weights: axis === null ? null : await loadAlgorithmWeights(access, territoryUuid, axis),
        bounds: connection?.versionId ? await loadTariffBounds(territoryUuid, card.period, connection.versionId) : emptyTariffBounds(),
    };
}

function emptyTariffPage(card: Awaited<ReturnType<typeof getRrsCard>>, period: string): TariffExceptionPage {
    return {
        territory: card.territory,
        period,
        appliedPeriod: card.appliedPeriod,
        savedPeriods: card.savedPeriods.map((item) => item.period),
        editable: false,
        editPolicy: card.editPolicy,
        connection: null,
        exceptions: [],
        stats: [],
        otherAxis: null,
        otherAxisTitles: [],
        weights: null,
        bounds: emptyTariffBounds(),
    };
}

export async function searchTariffSegments(
    access: AccessView,
    territoryUuid: string,
    period: string,
    queryText: string,
): Promise<TariffSegmentMatch[]> {
    const page = await getTariffExceptions(access, territoryUuid, period);
    const axis = page.connection?.axis;
    if (!axis) {
        return [];
    }
    const query = queryText.trim();
    if (query.length < 2) {
        return [];
    }
    const source = AXIS_TABLE[axis];
    const rows = await db.query<{ code: string; title: string; parent: string | null; inStats: boolean }>(
        `
        SELECT directory.uuid::text AS code,
               directory.name AS title,
               directory.parent_1 AS parent,
               EXISTS (
                   SELECT 1
                   FROM ${source.stats} stats
                   WHERE stats.territory_uuid = $1
                     AND stats.period = $2::date
                     AND stats.${source.codeColumn} = directory.uuid
                     AND ${USABLE_STAT}
               ) AS "inStats"
        FROM ${source.directory} directory
        WHERE directory.name ILIKE $3 ESCAPE '\\' OR directory.uuid::text ILIKE $4 ESCAPE '\\'
        ORDER BY "inStats" DESC, directory.name
        LIMIT 20
        `,
        [territoryUuid, period, `%${escapeLike(query)}%`, `${query.toLowerCase()}%`],
    );
    return rows;
}

function exceptionItems(rows: TariffSaveRow[]): TariffExceptionInput[] {
    return rows.filter((row) => rowBecomesException(row)).map((row) => ({
        code: row.code,
        baseMode: row.baseMode,
        automatic: row.automatic,
        main: row.automatic ? null : row.main,
        im: row.automatic ? null : row.im,
        b2b: row.automatic ? null : row.b2b,
    }));
}

export async function saveTariffExceptions(
    access: AccessView,
    territoryUuid: string,
    period: string,
    rows: TariffSaveRow[],
    weights: { salesShareWeight: number; priceShareWeight: number } | null = null,
): Promise<void> {
    const page = await getTariffExceptions(access, territoryUuid, period);
    if (!page.connection?.axis) {
        if (rows.length === 0 && page.stats.length === 0 && page.period.slice(0, 7) === page.editPolicy.currentMonth) {
            return;
        }
        throw new RrsRuleError(400, "У подключённой версии продаж не выбран вид расчета тарифов");
    }
    if (!page.editable) {
        throw new RrsRuleError(400, closedPeriodMessage(page.editPolicy));
    }
    const axis = page.connection.axis;
    const versionId = page.connection.versionId;
    const expected = new Set(page.stats.map((stat) => stat.code));
    if (rows.length !== expected.size || rows.some((row) => !expected.has(row.code))) {
        throw new RrsRuleError(400, "Список тарифов не совпадает со статистикой этого месяца");
    }
    const items = exceptionItems(rows);
    const titles = await titlesOf(axis, rows.map((row) => row.code));
    const missing = rows.find((row) => !titles.has(row.code));
    if (missing) {
        throw new RrsRuleError(400, "Код тарифа не найден в справочнике этого вида расчета");
    }
    const source = AXIS_TABLE[axis];
    await db.transaction(async (query) => {
        if (weights && page.weights?.editable) {
            await query(
                `
                INSERT INTO tariff_algorithm_territory_weights (
                    algorithm_code, territory_uuid, sales_share_weight, price_share_weight
                )
                VALUES ($1::varchar, $2::uuid, $3::smallint, $4::smallint)
                ON CONFLICT (algorithm_code, territory_uuid) DO UPDATE
                SET sales_share_weight = EXCLUDED.sales_share_weight,
                    price_share_weight = EXCLUDED.price_share_weight
                `,
                [axis, territoryUuid, weights.salesShareWeight, weights.priceShareWeight],
            );
        }
        const current = await query<PeriodRow>(
            `
            SELECT code::text AS code,
                   title,
                   base_mode AS "baseMode",
                   automatic,
                   main::text AS main,
                   im::text AS im,
                   b2b::text AS b2b,
                   removed,
                   set_at AS "setAt",
                   set_by AS "setBy"
            FROM basket_tariff_exceptions
            WHERE territory_uuid = $1 AND period = $2::date AND axis = $3
            FOR UPDATE
            `,
            [territoryUuid, period, axis],
        );
        const byCode = new Map(current.map((row) => [row.code, row]));
        for (const row of rows) {
            await query(
                `
                INSERT INTO ${source.tariffs} (
                    territory_uuid, period, version_id, code, title, base_mode, main, im, b2b
                )
                VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9)
                ON CONFLICT (territory_uuid, period, code) DO UPDATE
                SET version_id = EXCLUDED.version_id,
                    title = EXCLUDED.title,
                    base_mode = EXCLUDED.base_mode,
                    main = EXCLUDED.main,
                    im = EXCLUDED.im,
                    b2b = EXCLUDED.b2b,
                    calculated_at = NOW()
                `,
                [territoryUuid, period, versionId, row.code, titles.get(row.code), row.baseMode, row.main, row.im, row.b2b],
            );
        }
        const wanted = new Set(items.map((item) => item.code));
        for (const line of page.exceptions) {
            if (!rowBecomesException(line)) {
                wanted.add(line.code);
            }
        }
        for (const item of items) {
            const previous = byCode.get(item.code);
            if (previous && sameRule(previous, item)) {
                continue;
            }
            if (previous) {
                await logRow(query, territoryUuid, period, axis, previous, access.username);
                await query(
                    `
                    UPDATE basket_tariff_exceptions
                    SET title = $5,
                        base_mode = $6,
                        automatic = $7,
                        main = $8,
                        im = $9,
                        b2b = $10,
                        removed = FALSE,
                        set_at = NOW(),
                        set_by = $11
                    WHERE territory_uuid = $1 AND period = $2::date AND axis = $3 AND code = $4::uuid
                    `,
                    [territoryUuid, period, axis, item.code, titles.get(item.code), item.baseMode, item.automatic, item.main, item.im, item.b2b, access.username],
                );
                continue;
            }
            await query(
                `
                INSERT INTO basket_tariff_exceptions (
                    territory_uuid, period, axis, code, title, base_mode, automatic, main, im, b2b, removed, set_by
                )
                VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, FALSE, $11)
                `,
                [territoryUuid, period, axis, item.code, titles.get(item.code), item.baseMode, item.automatic, item.main, item.im, item.b2b, access.username],
            );
        }
        const effective = await loadSlices(territoryUuid, period);
        for (const row of effective) {
            if (row.axis !== axis || row.removed || wanted.has(row.code) || !expected.has(row.code)) {
                continue;
            }
            const previous = byCode.get(row.code);
            if (previous) {
                if (previous.removed) {
                    continue;
                }
                await logRow(query, territoryUuid, period, axis, previous, access.username);
                await query(
                    `
                    UPDATE basket_tariff_exceptions
                    SET removed = TRUE, set_at = NOW(), set_by = $4
                    WHERE territory_uuid = $1 AND period = $2::date AND axis = $3 AND code = $5::uuid
                    `,
                    [territoryUuid, period, axis, access.username, row.code],
                );
                continue;
            }
            await query(
                `
                INSERT INTO basket_tariff_exceptions (
                    territory_uuid, period, axis, code, title, base_mode, automatic, main, im, b2b, removed, set_by
                )
                VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, TRUE, $11)
                `,
                [territoryUuid, period, axis, row.code, row.title, row.baseMode, row.automatic, numberOrNull(row.main), numberOrNull(row.im), numberOrNull(row.b2b), access.username],
            );
        }
    });
}

function emptyTariffBounds(parameters: { key: string; title: string }[] = []): TariffExceptionPage["bounds"] {
    return TARIFF_BOUND_KEYS.map((key) => ({
        key,
        title: parameters.find((parameter) => parameter.key === key)?.title.trim() || key,
        value: null,
    }));
}

async function loadTariffBounds(territoryUuid: string, period: string, versionId: number): Promise<TariffExceptionPage["bounds"]> {
    const rows = await db.query<{ settings: unknown; dataTable: string | null }>(
        `
        SELECT settings, data_table AS "dataTable"
        FROM basket_versions
        WHERE id = $1
        `,
        [versionId],
    );
    const version = rows[0];
    if (!version) {
        return emptyTariffBounds();
    }
    const settings = readVersionSettings(version.settings);
    const hasBounds = settings.parameters.some((parameter) => parameter.kind === "number" && (TARIFF_BOUND_KEYS as readonly string[]).includes(parameter.key));
    if (!version.dataTable || !/^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$/.test(version.dataTable) || !hasBounds) {
        return emptyTariffBounds(settings.parameters);
    }
    const columns = settings.parameters.map((parameter) => `"${parameter.key}" AS "${parameter.key}"`).join(", ");
    const found = await db.query<Record<string, unknown>>(
        `
        SELECT ${columns}
        FROM basket_data."${version.dataTable}"
        WHERE territory_uuid = $1 AND period = $2::date
        `,
        [territoryUuid, period],
    );
    const raw: Record<string, string> = {};
    for (const parameter of settings.parameters) {
        const value = found[0]?.[parameter.key];
        raw[parameter.key] = value === null || value === undefined ? "" : String(value);
    }
    const resolved = resolveConnectionValues(settings.parameters, raw);
    return TARIFF_BOUND_KEYS.map((key) => {
        const parameter = settings.parameters.find((item) => item.key === key);
        const value = resolved.values[key];
        return {
            key,
            title: parameter?.title.trim() || key,
            value: typeof value === "number" ? String(value) : null,
        };
    });
}

function administratorTariffControls(access: AccessView): boolean {
    return access.fullAccess || access.permissions.includes("tariffs:write");
}

async function loadAlgorithmWeights(access: AccessView, territoryUuid: string, axis: TariffAxis): Promise<TariffExceptionPage["weights"]> {
    const rows = await db.query<{ title: string; salesShareWeight: number; priceShareWeight: number; weightEditable: boolean; referenceGranted: boolean }>(
        `
        SELECT algorithm.title,
               COALESCE(override.sales_share_weight, algorithm.sales_share_weight) AS "salesShareWeight",
               COALESCE(override.price_share_weight, algorithm.price_share_weight) AS "priceShareWeight",
               EXISTS (
                   SELECT 1
                   FROM tariff_algorithm_weight_grants grant_row
                   WHERE grant_row.algorithm_code = algorithm.code
                     AND grant_row.territory_uuid = $2::uuid
               ) AS "weightEditable",
               EXISTS (
                   SELECT 1
                   FROM tariff_algorithm_reference_grants grant_row
                   WHERE grant_row.algorithm_code = algorithm.code
                     AND grant_row.territory_uuid = $2::uuid
               ) AS "referenceGranted"
        FROM tariff_algorithms algorithm
        LEFT JOIN tariff_algorithm_territory_weights override
            ON override.algorithm_code = algorithm.code
           AND override.territory_uuid = $2::uuid
        WHERE algorithm.code = $1
        `,
        [axis, territoryUuid],
    );
    const row = rows[0];
    if (!row) {
        return null;
    }
    const administrator = administratorTariffControls(access);
    return {
        title: row.title,
        salesShareWeight: Number(row.salesShareWeight),
        priceShareWeight: Number(row.priceShareWeight),
        editable: administrator || row.weightEditable,
        referenceSelectable: administrator || row.referenceGranted,
    };
}

async function loadSalesConnection(territoryUuid: string, period: string): Promise<TariffExceptionPage["connection"]> {
    const rows = await db.query<{ versionId: number | null; versionNo: number | null; versionName: string | null; versionStatus: string | null; tariffAxis: string | null }>(
        `
        SELECT connection.version_id AS "versionId",
               version.version_no AS "versionNo",
               version.name AS "versionName",
               version.status AS "versionStatus",
               version.tariff_axis AS "tariffAxis"
        FROM basket_connections connection
        JOIN baskets basket ON basket.id = connection.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        LEFT JOIN basket_versions version ON version.id = connection.version_id
        WHERE connection.territory_uuid = $1
          AND connection.period <= $2::date
          AND indicator.name = $3
        ORDER BY connection.period DESC
        LIMIT 1
        `,
        [territoryUuid, period, SALES_INDICATOR_NAME],
    );
    const row = rows[0];
    if (!row?.versionId || row.versionNo === null || !row.versionName || !row.versionStatus) {
        return null;
    }
    return {
        versionId: row.versionId,
        versionNo: row.versionNo,
        versionName: row.versionName,
        versionStatus: row.versionStatus,
        axis: isTariffAxis(row.tariffAxis) ? row.tariffAxis : null,
    };
}

async function loadSlices(territoryUuid: string, period: string): Promise<SliceRow[]> {
    return db.query<SliceRow>(
        `
        SELECT DISTINCT ON (exception.axis, exception.code)
               exception.axis,
               exception.code::text AS code,
               exception.title,
               COALESCE(category.parent_1, kind.parent_1) AS parent,
               exception.base_mode AS "baseMode",
               exception.automatic,
               exception.main::text AS main,
               exception.im::text AS im,
               exception.b2b::text AS b2b,
               exception.removed,
               to_char(exception.period, 'YYYY-MM-DD') AS "fromPeriod"
        FROM basket_tariff_exceptions exception
        LEFT JOIN product_categories category
            ON exception.axis = 'category' AND category.uuid = exception.code
        LEFT JOIN product_kinds kind
            ON exception.axis = 'product_kind' AND kind.uuid = exception.code
        WHERE exception.territory_uuid = $1
          AND exception.period <= $2::date
        ORDER BY exception.axis, exception.code, exception.period DESC
        `,
        [territoryUuid, period],
    );
}

async function statsCodes(territoryUuid: string, period: string, axis: TariffAxis, codes: string[]): Promise<Set<string>> {
    if (codes.length === 0) {
        return new Set();
    }
    const source = AXIS_TABLE[axis];
    const rows = await db.query<{ code: string }>(
        `
        SELECT stats.${source.codeColumn}::text AS code
        FROM ${source.stats} stats
        WHERE stats.territory_uuid = $1
          AND stats.period = $2::date
          AND stats.${source.codeColumn} = ANY($3::uuid[])
          AND ${USABLE_STAT}
        `,
        [territoryUuid, period, codes],
    );
    return new Set(rows.map((row) => row.code));
}

export async function getEnabledTariffExceptions(
    access: AccessView,
    territoryUuid: string,
    requestedPeriod: string | null,
): Promise<TariffExceptionReport> {
    const card = await getRrsCard(access, territoryUuid, null);
    const period = requestedPeriod ?? card.period;
    const connection = await loadSalesConnection(territoryUuid, period);
    const axis = connection?.axis ?? null;
    const [rows, directory, stats] = await Promise.all([
        listEnabledTariffExceptions(period, [territoryUuid]),
        axis ? listAxisDirectory(territoryUuid, period, axis) : Promise.resolve([]),
        axis ? loadSalesStats(territoryUuid, period, axis) : Promise.resolve([]),
    ]);
    const weights = axis ? await loadAlgorithmWeights(access, territoryUuid, axis) : null;
    const bounds = axis && connection ? await loadTariffBounds(territoryUuid, period, connection.versionId) : emptyTariffBounds();
    return {
        territory: card.territory,
        period,
        appliedPeriod: card.appliedPeriod,
        savedPeriods: card.savedPeriods.map((item) => item.period),
        rows,
        directory,
        editable: monthIsOpen(period.slice(0, 7), card.editPolicy),
        axis,
        quotes: stats.map((stat) => ({ code: stat.code, avgPrice: stat.avgPrice, quantity: stat.quantity })),
        service: weights
            ? {
                salesShareWeight: weights.salesShareWeight,
                priceShareWeight: weights.priceShareWeight,
                min: boundNumber(bounds, "min"),
                base: boundNumber(bounds, "base"),
                max: boundNumber(bounds, "max"),
                averagePrice: territoryMean(stats.map((stat) => stat.avgPrice)),
                averageQuantity: territoryMean(stats.map((stat) => stat.quantity)),
            }
            : null,
    };
}

export async function saveExceptionRules(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: TariffExceptionInput[],
): Promise<void> {
    const page = await openTariffPeriod(access, territoryUuid, period);
    const axis = page.connection?.axis;
    if (!axis) {
        throw new RrsRuleError(400, "У подключённой версии продаж не выбран вид расчета тарифов");
    }
    const expected = new Set(page.stats.map((stat) => stat.code));
    for (const item of items) {
        if (!expected.has(item.code)) {
            throw new RrsRuleError(400, "Исключение относится к категории вне статистики этого месяца");
        }
        if (!item.automatic && (item.main === null || item.im === null || item.b2b === null)) {
            throw new RrsRuleError(400, "Заполните ставки ручного исключения");
        }
    }
    const normalized = items.map((item) => ({
        ...item,
        main: item.automatic ? null : item.main,
        im: item.automatic ? null : item.im,
        b2b: item.automatic ? null : item.b2b,
    }));
    const titles = await titlesOf(axis, [...expected]);
    await db.transaction(async (query) => {
        await writeExceptionRules(query, access.username, territoryUuid, period, axis, expected, titles, normalized);
    });
}

export async function previewRecalculatedTariffs(
    access: AccessView,
    territoryUuid: string,
    period: string,
): Promise<CalculatedTariffRow[]> {
    const page = await openTariffPeriod(access, territoryUuid, period);
    return calculatePeriodTariffs(page);
}

export async function saveRecalculatedTariffs(
    access: AccessView,
    territoryUuid: string,
    period: string,
): Promise<{ saved: number }> {
    const page = await openTariffPeriod(access, territoryUuid, period);
    const axis = page.connection?.axis;
    const versionId = page.connection?.versionId;
    if (!axis || versionId === undefined) {
        throw new RrsRuleError(400, "У подключённой версии продаж не выбран вид расчета тарифов");
    }
    const rows = calculatePeriodTariffs(page);
    if (rows.length === 0) {
        throw new RrsRuleError(400, "В статистике этого месяца нет категорий для расчёта");
    }
    if (rows.some((row) => !tariffRowComplete(row))) {
        throw new RrsRuleError(400, "Нельзя сохранить тарифы, пока хотя бы одно поле пустое");
    }
    const source = AXIS_TABLE[axis];
    await db.transaction(async (query) => {
        for (const row of rows) {
            await query(
                `
                INSERT INTO ${source.tariffs} (
                    territory_uuid, period, version_id, code, title, base_mode, main, im, b2b
                )
                VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9)
                ON CONFLICT (territory_uuid, period, code) DO UPDATE
                SET version_id = EXCLUDED.version_id,
                    title = EXCLUDED.title,
                    base_mode = EXCLUDED.base_mode,
                    main = EXCLUDED.main,
                    im = EXCLUDED.im,
                    b2b = EXCLUDED.b2b,
                    calculated_at = NOW()
                `,
                [territoryUuid, period, versionId, row.code, row.title, row.baseMode, Number(row.main), Number(row.im), Number(row.b2b)],
            );
        }
    });
    return { saved: rows.length };
}

async function openTariffPeriod(access: AccessView, territoryUuid: string, period: string): Promise<TariffExceptionPage> {
    const page = await getTariffExceptions(access, territoryUuid, period);
    if (!page.editable) {
        throw new RrsRuleError(400, closedPeriodMessage(page.editPolicy));
    }
    return page;
}

function calculatePeriodTariffs(page: TariffExceptionPage): CalculatedTariffRow[] {
    const context = tariffServiceContext(page);
    const byCode = new Map(page.exceptions.map((line) => [line.code, line]));
    return page.stats.map((stat) => {
        const exception = byCode.get(stat.code) ?? null;
        const automatic = exception ? exception.automatic : true;
        const baseMode = exception?.baseMode ?? (isTariffBaseMode(stat.baseMode) ? stat.baseMode : "per_unit");
        const channels = automatic
            ? calculateAlgorithmTariffs({
                stat,
                mode: baseMode,
                service: calculateServiceTariffs(stat, context),
            })
            : {
                main: exception?.main ?? null,
                im: exception?.im ?? null,
                b2b: exception?.b2b ?? null,
            };
        return {
            code: stat.code,
            title: stat.title,
            baseMode,
            automatic,
            main: channels.main,
            im: channels.im,
            b2b: channels.b2b,
            exception: rowBecomesException({ automatic, baseMode }),
        };
    });
}

function tariffServiceContext(page: TariffExceptionPage): TariffServiceContext | null {
    if (!page.weights) {
        return null;
    }
    return {
        salesShareWeight: page.weights.salesShareWeight,
        priceShareWeight: page.weights.priceShareWeight,
        min: boundNumber(page.bounds, "min"),
        base: boundNumber(page.bounds, "base"),
        max: boundNumber(page.bounds, "max"),
        averagePrice: territoryMean(page.stats.map((stat) => stat.avgPrice)),
        averageQuantity: territoryMean(page.stats.map((stat) => stat.quantity)),
    };
}

function boundNumber(bounds: TariffExceptionPage["bounds"], key: "min" | "base" | "max"): number | null {
    const raw = bounds.find((bound) => bound.key === key)?.value ?? null;
    if (raw === null) {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

async function writeExceptionRules(
    query: Sql,
    actor: string,
    territoryUuid: string,
    period: string,
    axis: TariffAxis,
    expected: Set<string>,
    titles: Map<string, string>,
    items: TariffExceptionInput[],
): Promise<void> {
    const current = await query<PeriodRow>(
        `
        SELECT code::text AS code,
               title,
               base_mode AS "baseMode",
               automatic,
               main::text AS main,
               im::text AS im,
               b2b::text AS b2b,
               removed,
               set_at AS "setAt",
               set_by AS "setBy"
        FROM basket_tariff_exceptions
        WHERE territory_uuid = $1 AND period = $2::date AND axis = $3
        FOR UPDATE
        `,
        [territoryUuid, period, axis],
    );
    const byCode = new Map(current.map((row) => [row.code, row]));
    const wanted = new Set(items.map((item) => item.code));
    for (const item of items) {
        const title = titles.get(item.code);
        if (!title) {
            throw new RrsRuleError(400, "Код тарифа не найден в справочнике этого вида расчета");
        }
        const previous = byCode.get(item.code);
        if (previous && sameRule(previous, item)) {
            continue;
        }
        if (previous) {
            await logRow(query, territoryUuid, period, axis, previous, actor);
            await query(
                `
                UPDATE basket_tariff_exceptions
                SET title = $5,
                    base_mode = $6,
                    automatic = $7,
                    main = $8,
                    im = $9,
                    b2b = $10,
                    removed = FALSE,
                    set_at = NOW(),
                    set_by = $11
                WHERE territory_uuid = $1 AND period = $2::date AND axis = $3 AND code = $4::uuid
                `,
                [territoryUuid, period, axis, item.code, title, item.baseMode, item.automatic, item.main, item.im, item.b2b, actor],
            );
            continue;
        }
        await query(
            `
            INSERT INTO basket_tariff_exceptions (
                territory_uuid, period, axis, code, title, base_mode, automatic, main, im, b2b, removed, set_by
            )
            VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, FALSE, $11)
            `,
            [territoryUuid, period, axis, item.code, title, item.baseMode, item.automatic, item.main, item.im, item.b2b, actor],
        );
    }
    const effective = await loadSlices(territoryUuid, period);
    for (const row of effective) {
        if (row.axis !== axis || row.removed || wanted.has(row.code) || !expected.has(row.code)) {
            continue;
        }
        const previous = byCode.get(row.code);
        if (previous) {
            if (previous.removed) {
                continue;
            }
            await logRow(query, territoryUuid, period, axis, previous, actor);
            await query(
                `
                UPDATE basket_tariff_exceptions
                SET removed = TRUE, set_at = NOW(), set_by = $4
                WHERE territory_uuid = $1 AND period = $2::date AND axis = $3 AND code = $5::uuid
                `,
                [territoryUuid, period, axis, actor, row.code],
            );
            continue;
        }
        await query(
            `
            INSERT INTO basket_tariff_exceptions (
                territory_uuid, period, axis, code, title, base_mode, automatic, main, im, b2b, removed, set_by
            )
            VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, TRUE, $11)
            `,
            [territoryUuid, period, axis, row.code, row.title, row.baseMode, row.automatic, numberOrNull(row.main), numberOrNull(row.im), numberOrNull(row.b2b), actor],
        );
    }
}

async function listEnabledTariffExceptions(period: string, territoryUuids: string[]): Promise<TariffExceptionReportRow[]> {
    if (territoryUuids.length === 0) {
        return [];
    }
    const rows = await db.query<{
        territoryUuid: string;
        territoryCode: string;
        territoryName: string;
        axis: string;
        code: string;
        title: string;
        parent3: string | null;
        parent2: string | null;
        parent1: string | null;
        inDirectory: boolean;
        baseMode: string;
        automatic: boolean;
        main: string | null;
        im: string | null;
        b2b: string | null;
        fromPeriod: string;
    }>(
        `
        SELECT territory.uuid::text AS "territoryUuid",
               territory.code AS "territoryCode",
               territory.name AS "territoryName",
               slice.axis,
               slice.code,
               slice.title,
               slice."parent3",
               slice."parent2",
               slice."parent1",
               slice."inDirectory",
               slice."baseMode",
               slice.automatic,
               slice.main,
               slice.im,
               slice.b2b,
               slice."fromPeriod"
        FROM (
            SELECT DISTINCT ON (exception.territory_uuid, exception.axis, exception.code)
                   exception.territory_uuid,
                   exception.axis,
                   exception.code::text AS code,
                   exception.title,
                   COALESCE(category.parent_3, kind.parent_3) AS "parent3",
                   COALESCE(category.parent_2, kind.parent_2) AS "parent2",
                   COALESCE(category.parent_1, kind.parent_1) AS "parent1",
                   (category.uuid IS NOT NULL OR kind.uuid IS NOT NULL) AS "inDirectory",
                   exception.base_mode AS "baseMode",
                   exception.automatic,
                   exception.main::text AS main,
                   exception.im::text AS im,
                   exception.b2b::text AS b2b,
                   exception.removed,
                   to_char(exception.period, 'YYYY-MM-DD') AS "fromPeriod"
            FROM basket_tariff_exceptions exception
            LEFT JOIN product_categories category
                ON exception.axis = 'category' AND category.uuid = exception.code
            LEFT JOIN product_kinds kind
                ON exception.axis = 'product_kind' AND kind.uuid = exception.code
            WHERE exception.period <= $1::date
              AND exception.territory_uuid = ANY($2::uuid[])
              AND (
                  (
                      exception.axis = 'category'
                      AND EXISTS (
                          SELECT 1
                          FROM basket_category_stats stats
                          WHERE stats.territory_uuid = exception.territory_uuid
                            AND stats.category_uuid = exception.code
                            AND stats.period = $1::date
                            AND ${USABLE_STAT}
                      )
                  )
                  OR (
                      exception.axis = 'product_kind'
                      AND EXISTS (
                          SELECT 1
                          FROM basket_kind_stats stats
                          WHERE stats.territory_uuid = exception.territory_uuid
                            AND stats.kind_uuid = exception.code
                            AND stats.period = $1::date
                            AND ${USABLE_STAT}
                      )
                  )
              )
            ORDER BY exception.territory_uuid, exception.axis, exception.code, exception.period DESC
        ) slice
        JOIN territories territory ON territory.uuid = slice.territory_uuid
        WHERE slice.removed = FALSE
        ORDER BY territory.name, slice.axis, slice.title
        `,
        [period, territoryUuids],
    );
    return rows.flatMap((row) => {
        if (!isTariffAxis(row.axis) || !isTariffBaseMode(row.baseMode)) {
            return [];
        }
        return [{
            territoryUuid: row.territoryUuid,
            territoryCode: row.territoryCode,
            territoryName: row.territoryName,
            axis: row.axis,
            code: row.code,
            title: row.title,
            folders: row.inDirectory ? folderPath(row.parent3, row.parent2, row.parent1) : [],
            archived: !row.inDirectory,
            baseMode: row.baseMode,
            automatic: row.automatic,
            main: row.main,
            im: row.im,
            b2b: row.b2b,
            fromPeriod: row.fromPeriod,
        }];
    });
}

function folderPath(parent3: string | null, parent2: string | null, parent1: string | null): string[] {
    return [parent3, parent2, parent1].filter((item): item is string => item !== null && item !== "");
}

async function listAxisDirectory(territoryUuid: string, period: string, axis: TariffAxis): Promise<TariffCategoryFolder[]> {
    const source = AXIS_TABLE[axis];
    const rows = await db.query<{ code: string; title: string; parent3: string | null; parent2: string | null; parent1: string | null }>(
        `
        SELECT directory.uuid::text AS code,
               directory.name AS title,
               directory.parent_3 AS "parent3",
               directory.parent_2 AS "parent2",
               directory.parent_1 AS "parent1"
        FROM ${source.directory} directory
        JOIN ${source.stats} stats
            ON stats.${source.codeColumn} = directory.uuid
           AND stats.territory_uuid = $1
           AND stats.period = $2::date
        WHERE ${USABLE_STAT}
        ORDER BY directory.name
        `,
        [territoryUuid, period],
    );
    return rows.map((row) => ({
        code: row.code,
        title: row.title,
        folders: folderPath(row.parent3, row.parent2, row.parent1),
    }));
}

async function titlesOf(axis: TariffAxis, codes: string[]): Promise<Map<string, string>> {
    if (codes.length === 0) {
        return new Map();
    }
    const source = AXIS_TABLE[axis];
    const rows = await db.query<{ code: string; title: string }>(
        `SELECT uuid::text AS code, name AS title FROM ${source.directory} WHERE uuid = ANY($1::uuid[])`,
        [codes],
    );
    return new Map(rows.map((row) => [row.code, row.title]));
}

interface PeriodRow {
    code: string;
    title: string;
    baseMode: string;
    automatic: boolean;
    main: string | null;
    im: string | null;
    b2b: string | null;
    removed: boolean;
    setAt: Date;
    setBy: string;
}

function sameRule(row: PeriodRow, item: TariffExceptionInput): boolean {
    return !row.removed
        && row.baseMode === item.baseMode
        && row.automatic === item.automatic
        && numberOrNull(row.main) === item.main
        && numberOrNull(row.im) === item.im
        && numberOrNull(row.b2b) === item.b2b;
}

function numberOrNull(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toLine(row: SliceRow, inStats: boolean): TariffExceptionLine {
    return {
        code: row.code,
        title: row.title,
        parent: row.parent,
        baseMode: row.baseMode === "per_unit" ? "per_unit" : "percent",
        automatic: row.automatic !== false,
        main: formatRate(row.main),
        im: formatRate(row.im),
        b2b: formatRate(row.b2b),
        inStats,
        fromPeriod: row.fromPeriod,
    };
}

function blankToNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
}

function formatRate(value: string | null): string | null {
    if (value === null) {
        return null;
    }
    if (!value.includes(".")) {
        return value;
    }
    return value.replace(/0+$/, "").replace(/\.$/, "");
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

type Sql = <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

async function logRow(query: Sql, territoryUuid: string, period: string, axis: TariffAxis, row: PeriodRow, actor: string): Promise<void> {
    await query(
        `
        INSERT INTO basket_tariff_exceptions_log (
            territory_uuid, period, axis, code, title, base_mode, automatic, main, im, b2b, removed, set_at, set_by, recorded_by
        )
        VALUES ($1, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `,
        [territoryUuid, period, axis, row.code, row.title, row.baseMode, row.automatic, numberOrNull(row.main), numberOrNull(row.im), numberOrNull(row.b2b), row.removed, row.setAt, row.setBy, actor],
    );
}
