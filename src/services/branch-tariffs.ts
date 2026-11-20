import { readVersionSettings, SALES_INDICATOR_NAME, tariffAxisTitle, type TariffAxis } from "@/lib/baskets";
import { receivesManagerGrants } from "@/lib/manager-grants";
import { isTariffBaseMode, type TariffBaseMode } from "@/lib/tariff-exceptions";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { managerBranchOpenSql } from "@/services/premium-access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_TABLE = /^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$/;
const COLUMN = /^[a-z][a-z0-9_]{0,49}$/;

const moneyFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export interface BranchTariffRow {
    title: string;
    mode: "percent" | "per_unit";
    stm: string;
    nonStm: string;
    im: string;
    b2b: string;
}

export interface BranchTariffParameter {
    title: string;
    value: string;
}

export interface BranchTariffBasket {
    id: string;
    title: string;
    parameters: BranchTariffParameter[];
    articleId: number | null;
}

export interface BranchTariffSales {
    axis: string;
    rows: BranchTariffRow[];
    articleId: number | null;
    vacant: boolean;
}

export interface BranchTariffPage {
    inMotivation: boolean;
    sales: BranchTariffSales | null;
    baskets: BranchTariffBasket[];
}

interface VisibleBranch {
    id: string;
    territoryId: string;
}

interface ConnectedVersion {
    basketId: number;
    sortOrder: number;
    indicatorId: string;
    indicatorName: string;
    versionId: number;
    dataTable: string | null;
    tariffAxis: string | null;
    settings: unknown;
    wikiArticleId: number | null;
}

type ScopeMode = "all" | "granted" | "home" | "none";

function scopeMode(access: AccessView): ScopeMode {
    if (access.fullAccess || access.role?.scopeKind === "division") {
        return "all";
    }
    if (access.role?.scopeKind === "granted") {
        return "granted";
    }
    if (access.role?.scopeKind === "home_branch") {
        return "home";
    }
    return "none";
}

export async function readBranchTariffs(access: AccessView, period: string, branchId: string): Promise<BranchTariffPage | null> {
    const branch = await visibleBranch(access, period, branchId);
    if (!branch) {
        return null;
    }
    const [enabled, versions, coefficients] = await Promise.all([
        motivationEnabled(branch, period),
        connectedVersions(branch.territoryId, period),
        branchCoefficients(branch, period),
    ]);
    if (!enabled) {
        return { inMotivation: false, sales: null, baskets: [] };
    }
    const salesVersion = versions.find((version) => version.indicatorName === SALES_INDICATOR_NAME) ?? null;
    const baskets = await Promise.all(versions
        .filter((version) => version.indicatorName !== SALES_INDICATOR_NAME)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.indicatorName.localeCompare(right.indicatorName, "ru"))
        .map((version) => parameterBasket(version, period, branch.territoryId, coefficients.get(version.basketId) ?? new Map())));
    return {
        inMotivation: true,
        sales: salesVersion ? await salesTariffs(salesVersion, period, branch.territoryId, coefficients.get(salesVersion.basketId) ?? new Map()) : null,
        baskets: baskets.flatMap((basket) => basket ? [basket] : []),
    };
}

async function visibleBranch(access: AccessView, period: string, branchId: string): Promise<VisibleBranch | null> {
    const rows = await db.query<VisibleBranch>(
        `
        SELECT branch.uuid::text AS id,
               branch.territory_uuid::text AS "territoryId"
        FROM branches branch
        LEFT JOIN LATERAL (
            SELECT employee.branch_uuid
            FROM employees employee
            WHERE lower(employee.login) = lower($2)
              AND NOT employee.deleted
            LIMIT 1
        ) home ON true
        WHERE NOT branch.deleted
          AND branch.uuid = $4::uuid
          AND (
              $1::text = 'all'
              OR ($1::text = 'granted' AND branch.territory_uuid IN (
                  SELECT grant_row.territory_uuid
                  FROM scope_grants grant_row
                  WHERE lower(grant_row.username) = lower($2)
              ))
              OR ($1::text = 'home' AND branch.uuid IS NOT DISTINCT FROM home.branch_uuid)
              OR (
                  $5::boolean
                  AND EXISTS (
                      SELECT 1
                      FROM employees employee
                      WHERE lower(employee.login) = lower($2)
                        AND NOT employee.deleted
                        AND ${managerBranchOpenSql("employee.uuid", "employee.territory_uuid")}
                  )
              )
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period = $3::date
                    AND staff.branch_uuid = branch.uuid
              )
              OR branch.uuid IS NOT DISTINCT FROM home.branch_uuid
              OR (
                  $5::boolean
                  AND EXISTS (
                      SELECT 1
                      FROM employees employee
                      WHERE lower(employee.login) = lower($2)
                        AND NOT employee.deleted
                        AND ${managerBranchOpenSql("employee.uuid", "employee.territory_uuid")}
                  )
              )
          )
        `,
        [scopeMode(access), access.username, period, branchId, receivesManagerGrants(access.role?.code, access.title) && !access.fullAccess],
    );
    const row = rows[0];
    if (!row || !UUID.test(row.id) || !UUID.test(row.territoryId)) {
        return null;
    }
    return { id: row.id.toLowerCase(), territoryId: row.territoryId.toLowerCase() };
}

async function motivationEnabled(branch: VisibleBranch, period: string): Promise<boolean> {
    const rows = await db.query<{ enabled: boolean }>(
        `
        SELECT enabled
        FROM basket_branch_motivation
        WHERE territory_uuid = $1::uuid
          AND branch_uuid = $2::uuid
          AND period <= $3::date
        ORDER BY period DESC
        LIMIT 1
        `,
        [branch.territoryId, branch.id, period],
    );
    return rows[0]?.enabled === true;
}

async function connectedVersions(territoryId: string, period: string): Promise<ConnectedVersion[]> {
    return db.query<ConnectedVersion>(
        `
        -- Последнее подключение корзины на РРС, не позже месяца. Пустая версия — корзина отключена.
        SELECT basket_id AS "basketId",
               sort_order AS "sortOrder",
               indicator_id AS "indicatorId",
               indicator_name AS "indicatorName",
               version_id AS "versionId",
               data_table AS "dataTable",
               tariff_axis AS "tariffAxis",
               settings,
               wiki_article_id AS "wikiArticleId"
        FROM (
            SELECT DISTINCT ON (basket.id)
                   basket.id AS basket_id,
                   basket.sort_order,
                   indicator.id::text AS indicator_id,
                   btrim(indicator.name) AS indicator_name,
                   connection.version_id,
                   version.data_table,
                   version.tariff_axis,
                   version.settings,
                   article.id AS wiki_article_id
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            LEFT JOIN basket_versions version ON version.id = connection.version_id
            LEFT JOIN wiki_articles article
                ON article.id = version.wiki_article_id
               AND article.status = 'published'
               AND NOT article.archived
            WHERE connection.territory_uuid = $1::uuid
              AND connection.period <= $2::date
            ORDER BY basket.id, connection.period DESC
        ) latest
        WHERE version_id IS NOT NULL
        `,
        [territoryId, period],
    );
}

async function branchCoefficients(branch: VisibleBranch, period: string): Promise<Map<number, Map<string, number>>> {
    const rows = await db.query<{ basketId: number; key: string; value: string }>(
        `
        SELECT DISTINCT ON (basket_id, coefficient_key)
               basket_id AS "basketId",
               coefficient_key AS key,
               value::text AS value
        FROM basket_branch_coefficients
        WHERE territory_uuid = $1::uuid
          AND branch_uuid = $2::uuid
          AND period <= $3::date
        ORDER BY basket_id, coefficient_key, period DESC
        `,
        [branch.territoryId, branch.id, period],
    );
    const byBasket = new Map<number, Map<string, number>>();
    for (const row of rows) {
        const value = Number(row.value);
        if (!Number.isFinite(value)) {
            continue;
        }
        const basket = byBasket.get(row.basketId) ?? new Map<string, number>();
        basket.set(row.key, value);
        byBasket.set(row.basketId, basket);
    }
    return byBasket;
}

async function salesTariffs(
    version: ConnectedVersion,
    period: string,
    territoryId: string,
    coefficients: Map<string, number>,
): Promise<BranchTariffSales> {
    const axis = saleAxis(version);
    const stm = coefficients.get("stm_coef") ?? 1;
    const notStm = coefficients.get("not_stm_coef") ?? 1;
    const im = coefficients.get("im_coef") ?? 1;
    const b2b = coefficients.get("b2b_coef") ?? 1;
    const sale = coefficients.get("sale_coef") ?? 1;
    const saved = axis ? await savedSaleRows(axis, period, territoryId, version.versionId) : [];
    const fallback = saved.length > 0 ? null : await baseSaleRow(version, period, territoryId, stm, notStm, im, b2b, sale);
    const rows = saved.length > 0
        ? saved.flatMap((row) => {
            const next = saleRow(row, stm, notStm, im, b2b, sale);
            return next ? [next] : [];
        })
        : fallback?.rows ?? [];
    rows.sort((left, right) => left.title.localeCompare(right.title, "ru"));
    return {
        axis: axis ? tariffAxisTitle(axis) : "Базовая ставка",
        rows,
        articleId: version.wikiArticleId,
        vacant: saved.length === 0 && (fallback?.vacant ?? true),
    };
}

function saleAxis(version: ConnectedVersion): TariffAxis | null {
    if (version.tariffAxis === "category" || version.tariffAxis === "product_kind") {
        return version.tariffAxis;
    }
    const settings = readVersionSettings(version.settings);
    return settings.tariffAxis;
}

async function savedSaleRows(axis: TariffAxis, period: string, territoryId: string, versionId: number): Promise<SavedSaleRow[]> {
    const table = axis === "category" ? "basket_category_tariffs" : "basket_kind_tariffs";
    const rows = await db.query<{ title: string; baseMode: string; main: string | null; im: string | null; b2b: string | null }>(
        `
        SELECT btrim(title) AS title,
               base_mode AS "baseMode",
               main::text AS main,
               im::text AS im,
               b2b::text AS b2b
        FROM basket_data.${table}
        WHERE territory_uuid = $1::uuid
          AND period = $2::date
          AND version_id = $3
        `,
        [territoryId, period, versionId],
    );
    return rows.flatMap((row) => {
        if (row.title === "" || !isTariffBaseMode(row.baseMode)) {
            return [];
        }
        return [{ title: row.title, baseMode: row.baseMode, main: numberOrNull(row.main), im: numberOrNull(row.im), b2b: numberOrNull(row.b2b) }];
    });
}

interface SavedSaleRow {
    title: string;
    baseMode: TariffBaseMode;
    main: number | null;
    im: number | null;
    b2b: number | null;
}

function saleRow(row: SavedSaleRow, stm: number, notStm: number, im: number, b2b: number, sale: number): BranchTariffRow | null {
    const percent = row.baseMode === "percent";
    const stmValue = percent ? shownPercent(product(row.main, stm, sale)) : shownMoney(product(row.main, stm, sale));
    const nonStmValue = percent ? shownPercent(product(row.main, notStm, sale)) : shownMoney(product(row.main, notStm, sale));
    const imValue = shownMoney(product(row.im, im, sale));
    const b2bValue = shownMoney(product(row.b2b, b2b, sale));
    if (stmValue === null && nonStmValue === null && imValue === null && b2bValue === null) {
        return null;
    }
    const retail = percent ? formatPercent : formatMoney;
    return {
        title: row.title,
        mode: row.baseMode,
        stm: retail(stmValue),
        nonStm: retail(nonStmValue),
        im: formatMoney(imValue),
        b2b: formatMoney(b2bValue),
    };
}

async function baseSaleRow(
    version: ConnectedVersion,
    period: string,
    territoryId: string,
    stm: number,
    notStm: number,
    im: number,
    b2b: number,
    sale: number,
): Promise<{ vacant: boolean; rows: BranchTariffRow[] }> {
    const table = version.dataTable;
    if (!table || !DATA_TABLE.test(table) || !await tableExists(table)) {
        return { vacant: true, rows: [] };
    }
    const rows = await db.query<{ base: string | null }>(
        `
        SELECT base::text AS base
        FROM basket_data.${quoteIdent(table)}
        WHERE territory_uuid = $1::uuid
          AND period <= $2::date
        ORDER BY period DESC
        LIMIT 1
        `,
        [territoryId, period],
    );
    const base = numberOrNull(rows[0]?.base ?? null);
    if (base === null) {
        return { vacant: true, rows: [] };
    }
    const row = saleRow(
        { title: "Базовая ставка", baseMode: "per_unit", main: base, im: base, b2b: base },
        stm,
        notStm,
        im,
        b2b,
        sale,
    );
    return { vacant: false, rows: row ? [row] : [] };
}

async function parameterBasket(
    version: ConnectedVersion,
    period: string,
    territoryId: string,
    coefficients: Map<string, number>,
): Promise<BranchTariffBasket | null> {
    const settings = readVersionSettings(version.settings);
    const parameters = settings.parameters.filter((parameter) => COLUMN.test(parameter.key));
    const table = version.dataTable;
    if (parameters.length === 0 || !table || !DATA_TABLE.test(table) || !await tableExists(table)) {
        return null;
    }
    const select = parameters.map((parameter, index) => `${quoteIdent(parameter.key)}::text AS c${index}`).join(", ");
    const rows = await db.query<Record<string, string | null>>(
        `
        SELECT ${select}
        FROM basket_data.${quoteIdent(table)}
        WHERE territory_uuid = $1::uuid
          AND period <= $2::date
        ORDER BY period DESC
        LIMIT 1
        `,
        [territoryId, period],
    );
    const stored = rows[0];
    if (!stored) {
        return null;
    }
    const shared = coefficients.size === 1 ? [...coefficients.values()][0] : null;
    const shown = parameters.flatMap((parameter, index) => {
        const title = parameter.title.trim();
        if (title === "") {
            return [];
        }
        const raw = stored[`c${index}`] ?? null;
        if (parameter.kind !== "number") {
            const text = raw?.trim() ?? "";
            return text === "" ? [] : [{ title, value: text }];
        }
        const value = numberOrNull(raw);
        if (value === null) {
            return [];
        }
        const coefficient = shared ?? coefficients.get(`${parameter.key}_coef`) ?? coefficients.get(parameter.key) ?? 1;
        const amount = shownMoney(value * coefficient);
        if (amount === null) {
            return [];
        }
        return [{ title, value: formatMoney(amount) }];
    });
    if (shown.length === 0) {
        return null;
    }
    return { id: version.indicatorId, title: version.indicatorName, parameters: shown, articleId: version.wikiArticleId };
}

async function tableExists(table: string): Promise<boolean> {
    const rows = await db.query<{ present: string | null }>(
        `SELECT to_regclass($1) AS present`,
        [`basket_data.${table}`],
    );
    return rows[0]?.present !== null && rows[0]?.present !== undefined;
}

function product(rate: number | null, ...coefficients: number[]): number | null {
    if (rate === null) {
        return null;
    }
    return coefficients.reduce((current, coefficient) => current * coefficient, rate);
}

function numberOrNull(value: string | null): number | null {
    if (value === null || value.trim() === "") {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function shownMoney(value: number | null): number | null {
    if (value === null || !Number.isFinite(value) || moneyFormat.format(value) === "0") {
        return null;
    }
    return value;
}

function shownPercent(value: number | null): number | null {
    if (value === null || !Number.isFinite(value)) {
        return null;
    }
    const shown = Math.round(value * 10_000) / 100;
    if (percentFormat.format(shown) === "0") {
        return null;
    }
    return value;
}

function formatMoney(value: number | null): string {
    if (value === null) {
        return "—";
    }
    return `${moneyFormat.format(value)} ₽`;
}

function formatPercent(value: number | null): string {
    if (value === null) {
        return "—";
    }
    return `${percentFormat.format(Math.round(value * 10_000) / 100)}%`;
}

function quoteIdent(name: string): string {
    if (!COLUMN.test(name) && !DATA_TABLE.test(name)) {
        throw new Error("Недопустимое имя таблицы тарифа");
    }
    return `"${name}"`;
}
