import { SALES_INDICATOR_NAME } from "@/lib/baskets";
import { buildRrsEditPolicy } from "@/lib/rrs-edit-window";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";

const MONTH_WINDOW = 6;

export interface LoadDirectory {
    id: string;
    name: string;
    rows: number;
    marked: number | null;
    updatedAt: string | null;
    updatedKind: "time" | "date" | "none";
    updatedLabel: string;
    issue: string | null;
}

export interface LoadMonthTable {
    id: string;
    name: string;
    rows: number;
    counts: Record<string, number>;
    updatedAt: string | null;
    updatedKind: "time" | "date" | "none";
    updatedLabel: string;
}

export interface LoadGap {
    period: string;
    text: string;
}

export interface LoadMonitorData {
    periods: string[];
    openPeriods: string[];
    directories: LoadDirectory[];
    months: LoadMonthTable[];
    gaps: LoadGap[];
    issues: string[];
}

export type TariffReadiness = "calculated" | "missing" | "no-sales" | "no-axis";

export interface SettingsTerritory {
    uuid: string;
    name: string;
    code: string;
    connectedBaskets: number;
    branchesEnabled: number;
    branchesTotal: number;
    coefficientsDefined: number;
    coefficientsSaved: number;
    coefficientsExpected: number;
    tariffs: TariffReadiness;
}

export interface CompanySetting {
    id: string;
    title: string;
    value: string;
    detail: string;
    ready: boolean;
}

export interface SettingsMonitorData {
    period: string;
    periods: string[];
    company: CompanySetting[];
    territories: SettingsTerritory[];
}

interface CountRow {
    rows: number;
    marked: number | null;
    updated_at: string | null;
}

interface MonthRow {
    period: string | null;
    rows: number;
    updated_at: string | null;
}

interface IssueRow {
    rows: number;
}

export async function readLoadMonitor(): Promise<LoadMonitorData> {
    const { periods, openPeriods, start, end } = await monitorMonths();
    const [directories, months, issues] = await Promise.all([
        readDirectories(),
        readMonthlyLoads(start, end),
        readLoadIssues(),
    ]);
    return {
        periods,
        openPeriods,
        directories,
        months,
        gaps: loadGaps(openPeriods, months),
        issues,
    };
}

export async function readSettingsMonitor(requested: string | undefined): Promise<SettingsMonitorData> {
    const { periods } = await monitorMonths();
    const period = periods.includes(normalizePeriod(requested)) ? normalizePeriod(requested) : periods[periods.length - 1];
    const [company, territories] = await Promise.all([
        readCompanySettings(period),
        readTerritorySettings(period),
    ]);
    return { period, periods, company, territories: territories.filter((row) => row.connectedBaskets > 0) };
}

async function monitorMonths(): Promise<{ periods: string[]; openPeriods: string[]; start: string; end: string }> {
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    const current = `${policy.currentMonth}-01`;
    const periods = Array.from({ length: MONTH_WINDOW }, (_, index) => shiftMonth(current, index - (MONTH_WINDOW - 1)));
    const openPeriods: string[] = [];
    let cursor = `${policy.earliestMonth}-01`;
    while (cursor <= current) {
        openPeriods.push(cursor);
        cursor = shiftMonth(cursor, 1);
    }
    return {
        periods,
        openPeriods,
        start: periods[0],
        end: shiftMonth(current, 1),
    };
}

async function readDirectories(): Promise<LoadDirectory[]> {
    const [territories, branches, employees, categories, kinds] = await Promise.all([
        db.query<CountRow>(`
            SELECT count(*)::int AS rows,
                   count(*) FILTER (WHERE deleted)::int AS marked,
                   NULL::text AS updated_at
            FROM dictionaries.territories
        `),
        db.query<CountRow>(`
            SELECT count(*)::int AS rows,
                   count(*) FILTER (WHERE deleted)::int AS marked,
                   NULL::text AS updated_at
            FROM dictionaries.branches
        `),
        db.query<CountRow>(`
            SELECT count(*)::int AS rows,
                   count(*) FILTER (WHERE deleted)::int AS marked,
                   NULL::text AS updated_at
            FROM dictionaries.employees
        `),
        db.query<CountRow>(`
            SELECT count(*)::int AS rows,
                   NULL::int AS marked,
                   to_char(max(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
            FROM dictionaries.product_categories
        `),
        db.query<CountRow>(`
            SELECT count(*)::int AS rows,
                   NULL::int AS marked,
                   to_char(max(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
            FROM dictionaries.product_kinds
        `),
    ]);
    return [
        directory("territories", "Территории", territories[0], "none", "Даты загрузки нет"),
        directory("branches", "Филиалы", branches[0], "none", "Даты загрузки нет"),
        directory("employees", "Сотрудники", employees[0], "none", "Даты загрузки нет"),
        directory("categories", "Категории товаров", categories[0], "time", "Время появления строк. Повторная загрузка его не двигает"),
        directory("kinds", "Виды изделий", kinds[0], "time", "Время появления строк. Повторная загрузка его не двигает"),
    ];
}

function directory(
    id: string,
    name: string,
    row: CountRow | undefined,
    updatedKind: LoadDirectory["updatedKind"],
    updatedLabel: string,
): LoadDirectory {
    return {
        id,
        name,
        rows: row?.rows ?? 0,
        marked: row?.marked ?? null,
        updatedAt: row?.updated_at ?? null,
        updatedKind,
        updatedLabel,
        issue: null,
    };
}

async function readMonthlyLoads(start: string, end: string): Promise<LoadMonthTable[]> {
    const [sale, staffing, schedule, bonuses, categories, kinds, kassa] = await Promise.all([
        monthQuery(`
            SELECT to_char(date_trunc('month', period), 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(date), 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
            FROM raw.sale
            WHERE period >= $1::timestamp AND period < $2::timestamp
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(date_modified), 'YYYY-MM-DD') AS updated_at
            FROM raw.hr_ktu
            WHERE period >= $1::date AND period < $2::date
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(date_trunc('month', period), 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(date), 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
            FROM raw.grafiki_tabeli
            WHERE period >= $1::timestamp AND period < $2::timestamp
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   NULL::text AS updated_at
            FROM raw.basic_bonuses
            WHERE period >= $1::date AND period < $2::date
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(loaded_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
            FROM raw.basket_category_stats
            WHERE period >= $1::date AND period < $2::date
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(loaded_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
            FROM raw.basket_kind_stats
            WHERE period >= $1::date AND period < $2::date
            GROUP BY 1
        `, start, end),
        monthQuery(`
            SELECT to_char(date_trunc('month', period), 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows,
                   to_char(max(date), 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at
            FROM raw.kassa_oper
            WHERE period >= $1::timestamp AND period < $2::timestamp
            GROUP BY 1
        `, start, end),
    ]);
    return [
        monthTable("sale", "Продажи", sale, "time", "Дата последнего документа, не время загрузки"),
        monthTable("staffing", "Штатное расписание", staffing, "date", "Дата последней версии строки, не время загрузки"),
        monthTable("schedule", "График и табель", schedule, "time", "Последний день в выгрузке, не время загрузки"),
        monthTable("kassa", "Кассовые операции", kassa, "time", "Дата последней операции, не время загрузки"),
        monthTable("bonuses", "Базовая премия", bonuses, "none", "Даты загрузки нет"),
        monthTable("category-stats", "Статистика категорий", categories, "time", "Время загрузки"),
        monthTable("kind-stats", "Статистика видов", kinds, "time", "Время загрузки"),
    ];
}

async function monthQuery(text: string, start: string, end: string): Promise<MonthRow[]> {
    return db.query<MonthRow>(text, [start, end]);
}

function monthTable(
    id: string,
    name: string,
    rows: MonthRow[],
    updatedKind: LoadMonthTable["updatedKind"],
    updatedLabel: string,
): LoadMonthTable {
    const counts: Record<string, number> = {};
    let total = 0;
    let updatedAt: string | null = null;
    for (const row of rows) {
        if (!row.period) {
            continue;
        }
        counts[row.period] = row.rows;
        total += row.rows;
        if (row.updated_at && (updatedAt === null || row.updated_at > updatedAt)) {
            updatedAt = row.updated_at;
        }
    }
    return { id, name, rows: total, counts, updatedAt, updatedKind, updatedLabel };
}

function loadGaps(openPeriods: string[], tables: LoadMonthTable[]): LoadGap[] {
    const byId = new Map(tables.map((table) => [table.id, table]));
    const gaps: LoadGap[] = [];
    for (const period of openPeriods) {
        const missing = ["sale", "staffing", "schedule", "bonuses", "category-stats", "kind-stats"]
            .filter((id) => (byId.get(id)?.counts[period] ?? 0) === 0)
            .map((id) => byId.get(id)?.name ?? id);
        if (missing.length > 0) {
            gaps.push({ period, text: `Нет данных: ${missing.join(", ")}` });
        }
    }
    return gaps;
}

async function readLoadIssues(): Promise<string[]> {
    const [saleBlank, branchOrphans, employeeOrphans, categoryOrphans, kindOrphans] = await Promise.all([
        db.query<IssueRow>(`SELECT count(*)::int AS rows FROM raw.sale WHERE period IS NULL`),
        db.query<IssueRow>(`
            SELECT count(*)::int AS rows
            FROM dictionaries.branches branch
            WHERE NOT EXISTS (
                SELECT 1 FROM dictionaries.territories territory
                WHERE territory.uuid = branch.territory_uuid
            )
        `),
        db.query<IssueRow>(`
            SELECT count(*)::int AS rows
            FROM dictionaries.employees employee
            WHERE employee.branch_uuid IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM dictionaries.branches branch
                  WHERE branch.uuid = employee.branch_uuid
              )
        `),
        db.query<IssueRow>(`
            SELECT count(*)::int AS rows
            FROM raw.basket_category_stats stat
            WHERE NOT EXISTS (
                SELECT 1 FROM dictionaries.product_categories category
                WHERE category.uuid = stat.category_uuid
            )
        `),
        db.query<IssueRow>(`
            SELECT count(*)::int AS rows
            FROM raw.basket_kind_stats stat
            WHERE NOT EXISTS (
                SELECT 1 FROM dictionaries.product_kinds kind
                WHERE kind.uuid = stat.kind_uuid
            )
        `),
    ]);
    const issues: string[] = [];
    const blank = saleBlank[0]?.rows ?? 0;
    if (blank > 0) {
        issues.push(`В продажах ${blank} строк без месяца`);
    }
    const branches = branchOrphans[0]?.rows ?? 0;
    if (branches > 0) {
        issues.push(`У ${branches} филиалов территория не найдена в справочнике`);
    }
    const employees = employeeOrphans[0]?.rows ?? 0;
    if (employees > 0) {
        issues.push(`У ${employees} сотрудников филиал не найден в справочнике`);
    }
    const categories = categoryOrphans[0]?.rows ?? 0;
    if (categories > 0) {
        issues.push(`В статистике категорий ${categories} строк без категории в справочнике`);
    }
    const kinds = kindOrphans[0]?.rows ?? 0;
    if (kinds > 0) {
        issues.push(`В статистике видов ${kinds} строк без вида в справочнике`);
    }
    return issues;
}

async function readCompanySettings(period: string): Promise<CompanySetting[]> {
    const [growth, brands, roles, algorithms] = await Promise.all([
        db.query<{ period: string; value: string; set_at: string }>(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   value::text AS value,
                   to_char(set_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS set_at
            FROM price_growth_allowances
            WHERE period <= $1::date
            ORDER BY period DESC
            LIMIT 1
        `, [period]),
        db.query<{ rows: number; set_at: string | null }>(`
            SELECT count(*)::int AS rows,
                   to_char(max(set_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS set_at
            FROM stm_brands
        `),
        db.query<{ roles: number; rules: number }>(`
            SELECT (SELECT count(*)::int FROM motivation_roles) AS roles,
                   (SELECT count(*)::int FROM motivation_role_rules) AS rules
        `),
        db.query<{ rows: number }>(`SELECT count(*)::int AS rows FROM tariff_algorithms`),
    ]);
    const allowance = growth[0];
    const brand = brands[0];
    const role = roles[0];
    const algorithm = algorithms[0];
    return [
        allowance
            ? {
                id: "price-growth",
                title: "Надбавка за рост цен",
                value: `${money.format(Number(allowance.value))} ₽`,
                detail: `Действует с ${monthLabel(allowance.period)}, записана ${timeLabel(allowance.set_at)}`,
                ready: true,
            }
            : {
                id: "price-growth",
                title: "Надбавка за рост цен",
                value: "Не задана",
                detail: "Для расчёта за этот месяц надбавки нет, в формуле будет ноль",
                ready: false,
            },
        {
            id: "stm",
            title: "Бренды СТМ",
            value: brand && brand.rows > 0 ? `${count.format(brand.rows)}` : "Список пуст",
            detail: brand?.set_at ? `Последний бренд добавлен ${timeLabel(brand.set_at)}` : "Розница СТМ не отделится от остальной",
            ready: (brand?.rows ?? 0) > 0,
        },
        {
            id: "roles",
            title: "Роли мотивации",
            value: `${count.format(role?.roles ?? 0)} ролей, ${count.format(role?.rules ?? 0)} правил`,
            detail: (role?.roles ?? 0) > 0 && (role?.rules ?? 0) > 0
                ? "Правила подставляют роль по должности"
                : "Без ролей или правил назначение по должности не работает",
            ready: (role?.roles ?? 0) > 0 && (role?.rules ?? 0) > 0,
        },
        {
            id: "algorithms",
            title: "Алгоритмы тарифов",
            value: (algorithm?.rows ?? 0) > 0 ? `${count.format(algorithm.rows)}` : "Нет",
            detail: (algorithm?.rows ?? 0) > 0 ? "Оси расчёта по категориям и изделиям" : "Нечем считать тарифы",
            ready: (algorithm?.rows ?? 0) > 0,
        },
    ];
}

async function readTerritorySettings(period: string): Promise<SettingsTerritory[]> {
    const rows = await db.query<{
        uuid: string;
        name: string;
        code: string;
        connectedBaskets: number;
        branchesEnabled: number;
        branchesTotal: number;
        coefficientsDefined: number;
        coefficientsSaved: number;
        tariffs: TariffReadiness;
    }>(`
        WITH listed AS (
            SELECT branch.territory_uuid, branch.uuid
            FROM branches branch
            WHERE NOT branch.deleted
               OR EXISTS (
                    SELECT 1 FROM basket_branch_motivation listed_motivation
                    WHERE listed_motivation.territory_uuid = branch.territory_uuid
                      AND listed_motivation.branch_uuid = branch.uuid
                      AND listed_motivation.period = $1::date
               )
               OR EXISTS (
                    SELECT 1 FROM basket_branch_coefficients listed_coefficient
                    WHERE listed_coefficient.territory_uuid = branch.territory_uuid
                      AND listed_coefficient.branch_uuid = branch.uuid
                      AND listed_coefficient.period = $1::date
               )
        ),
        motivation_slice AS (
            SELECT DISTINCT ON (motivation.territory_uuid, motivation.branch_uuid)
                   motivation.territory_uuid,
                   motivation.branch_uuid,
                   motivation.enabled,
                   motivation.period
            FROM basket_branch_motivation motivation
            WHERE motivation.period <= $1::date
            ORDER BY motivation.territory_uuid, motivation.branch_uuid, motivation.period DESC
        ),
        enabled AS (
            SELECT listed.territory_uuid, listed.uuid AS branch_uuid
            FROM listed
            JOIN motivation_slice slice
              ON slice.territory_uuid = listed.territory_uuid
             AND slice.branch_uuid = listed.uuid
             AND slice.enabled
            JOIN branches branch ON branch.uuid = listed.uuid
            WHERE NOT branch.deleted
               OR slice.period = $1::date
               OR EXISTS (
                    SELECT 1 FROM basket_branch_coefficients listed_coefficient
                    WHERE listed_coefficient.territory_uuid = listed.territory_uuid
                      AND listed_coefficient.branch_uuid = listed.uuid
                      AND listed_coefficient.period = $1::date
               )
        ),
        connections AS (
            SELECT DISTINCT ON (connection.territory_uuid, connection.basket_id)
                   connection.territory_uuid,
                   connection.basket_id,
                   connection.version_id
            FROM basket_connections connection
            WHERE connection.period <= $1::date
            ORDER BY connection.territory_uuid, connection.basket_id, connection.period DESC
        ),
        sales AS (
            SELECT DISTINCT ON (connection.territory_uuid)
                   connection.territory_uuid,
                   connection.version_id,
                   version.tariff_axis
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            LEFT JOIN basket_versions version ON version.id = connection.version_id
            WHERE connection.period <= $1::date
              AND indicator.name = $2
            ORDER BY connection.territory_uuid, connection.period DESC
        )
        SELECT territory.uuid::text AS uuid,
               territory.name,
               territory.code,
               COALESCE(connected.connected, 0)::int AS "connectedBaskets",
               COALESCE(enabled_counts.enabled, 0)::int AS "branchesEnabled",
               COALESCE(branch_counts.total, 0)::int AS "branchesTotal",
               COALESCE(defined.defined, 0)::int AS "coefficientsDefined",
               COALESCE(saved.saved, 0)::int AS "coefficientsSaved",
               CASE
                   WHEN sales.territory_uuid IS NULL OR sales.version_id IS NULL THEN 'no-sales'
                   WHEN sales.tariff_axis IS NULL OR sales.tariff_axis NOT IN ('category', 'product_kind') THEN 'no-axis'
                   WHEN sales.tariff_axis = 'category' AND EXISTS (
                       SELECT 1
                       FROM basket_data.basket_category_tariffs tariff
                       WHERE tariff.territory_uuid = territory.uuid
                         AND tariff.period = $1::date
                         AND tariff.version_id = sales.version_id
                         AND tariff.main IS NOT NULL
                         AND tariff.im IS NOT NULL
                         AND tariff.b2b IS NOT NULL
                   ) THEN 'calculated'
                   WHEN sales.tariff_axis = 'product_kind' AND EXISTS (
                       SELECT 1
                       FROM basket_data.basket_kind_tariffs tariff
                       WHERE tariff.territory_uuid = territory.uuid
                         AND tariff.period = $1::date
                         AND tariff.version_id = sales.version_id
                         AND tariff.main IS NOT NULL
                         AND tariff.im IS NOT NULL
                         AND tariff.b2b IS NOT NULL
                   ) THEN 'calculated'
                   ELSE 'missing'
               END AS tariffs
        FROM territories territory
        LEFT JOIN (
            SELECT territory_uuid, count(*)::int AS total
            FROM listed
            GROUP BY territory_uuid
        ) branch_counts ON branch_counts.territory_uuid = territory.uuid
        LEFT JOIN (
            SELECT territory_uuid, count(*)::int AS enabled
            FROM enabled
            GROUP BY territory_uuid
        ) enabled_counts ON enabled_counts.territory_uuid = territory.uuid
        LEFT JOIN (
            SELECT territory_uuid, count(*) FILTER (WHERE version_id IS NOT NULL)::int AS connected
            FROM connections
            GROUP BY territory_uuid
        ) connected ON connected.territory_uuid = territory.uuid
        LEFT JOIN (
            SELECT connection.territory_uuid,
                   COALESCE(sum(
                       CASE
                           WHEN jsonb_typeof(version.settings->'coefficients') = 'array'
                           THEN jsonb_array_length(version.settings->'coefficients')
                           ELSE 0
                       END
                   ), 0)::int AS defined
            FROM connections connection
            JOIN basket_versions version ON version.id = connection.version_id
            GROUP BY connection.territory_uuid
        ) defined ON defined.territory_uuid = territory.uuid
        LEFT JOIN (
            SELECT slice.territory_uuid, count(*)::int AS saved
            FROM (
                SELECT DISTINCT ON (coefficient.territory_uuid, coefficient.basket_id, coefficient.branch_uuid, coefficient.coefficient_key)
                       coefficient.territory_uuid,
                       coefficient.basket_id,
                       coefficient.branch_uuid,
                       coefficient.coefficient_key
                FROM basket_branch_coefficients coefficient
                WHERE coefficient.period <= $1::date
                ORDER BY coefficient.territory_uuid, coefficient.basket_id, coefficient.branch_uuid, coefficient.coefficient_key, coefficient.period DESC
            ) slice
            JOIN enabled
              ON enabled.territory_uuid = slice.territory_uuid
             AND enabled.branch_uuid = slice.branch_uuid
            JOIN connections connection
              ON connection.territory_uuid = slice.territory_uuid
             AND connection.basket_id = slice.basket_id
             AND connection.version_id IS NOT NULL
            JOIN basket_versions version ON version.id = connection.version_id
            WHERE jsonb_typeof(version.settings->'coefficients') = 'array'
              AND version.settings->'coefficients' @> jsonb_build_array(jsonb_build_object('key', slice.coefficient_key))
            GROUP BY slice.territory_uuid
        ) saved ON saved.territory_uuid = territory.uuid
        LEFT JOIN sales ON sales.territory_uuid = territory.uuid
        WHERE NOT territory.deleted
           OR EXISTS (
                SELECT 1 FROM basket_connections listed_connection
                WHERE listed_connection.territory_uuid = territory.uuid
           )
        ORDER BY territory.name
    `, [period, SALES_INDICATOR_NAME]);
    return rows.map((row) => ({
        ...row,
        coefficientsExpected: row.coefficientsDefined * row.branchesEnabled,
    }));
}

function normalizePeriod(value: string | undefined): string {
    if (!value) {
        return "";
    }
    const match = /^(\d{4}-\d{2})(?:-01)?$/.exec(value);
    return match ? `${match[1]}-01` : "";
}

function shiftMonth(period: string, delta: number): string {
    const [year, month] = period.slice(0, 7).split("-").map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${nextMonth}-01`;
}

const count = new Intl.NumberFormat("ru-RU");
const money = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

function monthLabel(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(value: string): string {
    return timeFormat.format(new Date(value));
}
