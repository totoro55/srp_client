import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { priceGrowthAllowanceFor } from "@/services/price-growth";
import { readBranchSalePremiumDays } from "@/services/sale-premium";

export interface BranchOption {
    id: string;
    name: string;
    code: string;
    own: boolean;
}

export interface BranchStaffRow {
    id: string;
    rowKey: string;
    name: string;
    title: string;
    ktu: boolean | null;
    probation: boolean | null;
    hourlyRate: number | null;
    salaryAmount: number | null;
    status: string;
    scheduleHours: number | null;
    timesheetHours: number | null;
    activeFrom: string;
    activeUntil: string;
    titleChange: boolean;
    partial: boolean;
    markedOn: string;
    leftOn: string | null;
}

export interface ConnectedBasketIndicator {
    id: string;
    title: string;
}

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function isStaffPeriod(value: string | null): value is string {
    return value !== null && PERIOD.test(value);
}

export async function readBranchStaff(
    access: AccessView,
    period: string,
    branchId: string | null,
): Promise<{ branches: BranchOption[]; employees: BranchStaffRow[]; indicators: ConnectedBasketIndicator[]; salePremiums: Record<string, number>; baseBonus: number | null; priceGrowth: number }> {
    const branches = await db.query<BranchOption>(
        `
        SELECT branch.uuid::text AS id,
               branch.name,
               branch.code,
               branch.uuid IS NOT DISTINCT FROM home.branch_uuid AS own
        FROM branches branch
        LEFT JOIN LATERAL (
            SELECT employee.branch_uuid
            FROM employees employee
            WHERE lower(employee.login) = lower($2)
              AND NOT employee.deleted
            LIMIT 1
        ) home ON true
        WHERE NOT branch.deleted
          AND (
              $1::text = 'all'
              OR ($1::text = 'granted' AND branch.territory_uuid IN (
                  SELECT grant_row.territory_uuid
                  FROM scope_grants grant_row
                  WHERE lower(grant_row.username) = lower($2)
              ))
              OR ($1::text = 'home' AND branch.uuid IS NOT DISTINCT FROM home.branch_uuid)
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period = $3::date
                    AND lower(staff.branch_uuid) = lower(branch.uuid::text)
              )
              OR branch.uuid IS NOT DISTINCT FROM home.branch_uuid
          )
        ORDER BY branch.name
        `,
        [scopeMode(access), access.username, period],
    );

    const selected = branchId && UUID.test(branchId)
        ? branches.find((branch) => branch.id.toLowerCase() === branchId.toLowerCase())
        : undefined;
    if (!selected) {
        return { branches, employees: [], indicators: [], salePremiums: {}, baseBonus: null, priceGrowth: (await priceGrowthAllowanceFor(period)) ?? 0 };
    }

    const [versions, days, premiumDays] = await Promise.all([
        db.query<StaffVersion>(
            `
            -- Строки сотрудника с предыдущего месяца до конца выбранного:
            -- отрезок действует с date_modified до следующей даты, в том числе через границу месяца.
            SELECT lower(staff.employees_uuid) AS id,
                   COALESCE(NULLIF(btrim(employee.name), ''), 'Сотрудник без имени') AS name,
                   to_char(staff.date_modified, 'YYYY-MM-DD') AS "changedOn",
                   lower(btrim(staff.branch_uuid)) AS "branchId",
                   COALESCE(staff.title, '') AS title,
                   staff.ktu,
                   staff.probation,
                   staff.hourly_rate AS "hourlyRate",
                   staff.salary_amount AS "salaryAmount",
                   COALESCE(staff.status, '') AS status
            FROM raw.hr_ktu staff
            LEFT JOIN employees employee ON lower(employee.uuid::text) = lower(staff.employees_uuid)
            WHERE lower(staff.employees_uuid) IN (
                SELECT lower(person.employees_uuid)
                FROM raw.hr_ktu person
                WHERE person.period = $1::date
                  AND lower(person.branch_uuid) = lower($2::text)
            )
              AND staff.date_modified >= ($1::date - INTERVAL '1 month')
              AND staff.date_modified < ($1::date + INTERVAL '1 month')
            ORDER BY lower(staff.employees_uuid), staff.date_modified
            `,
            [period, selected.id],
        ),
        db.query<HourDay>(
            `
            SELECT lower(day.employees_uuid::text) AS id,
                   to_char(day.date, 'YYYY-MM-DD') AS day,
                   day.norma_hour AS schedule,
                   day.fact_hour AS timesheet
            FROM (
                SELECT sheet.employees_uuid,
                       sheet.date::date AS date,
                       MAX(sheet.norma_hour) AS norma_hour,
                       MAX(sheet.fact_hour) AS fact_hour
                FROM raw.grafiki_tabeli sheet
                WHERE sheet.period = $1::timestamp
                  AND sheet.branch_uuid = $2::uuid
                GROUP BY sheet.employees_uuid, sheet.date::date
            ) day
            `,
            [period, selected.id],
        ),
        readBranchSalePremiumDays(period, selected.id),
    ]);
    const employees = staffSegments(versions, days, selected.id.toLowerCase(), period);

    return {
        branches,
        employees,
        indicators: await readConnectedIndicators(period, selected.id),
        salePremiums: premiumsBySegment(employees, premiumDays),
        baseBonus: selected ? await readBaseBonus(period, selected.id) : null,
        priceGrowth: (await priceGrowthAllowanceFor(period)) ?? 0,
    };
}

interface StaffVersion {
    id: string;
    name: string;
    changedOn: string;
    branchId: string;
    title: string;
    ktu: boolean | null;
    probation: boolean | null;
    hourlyRate: number | null;
    salaryAmount: number | null;
    status: string;
}

interface HourDay {
    id: string;
    day: string;
    schedule: number | null;
    timesheet: number | null;
}

function staffSegments(versions: StaffVersion[], days: HourDay[], branchId: string, monthStart: string): BranchStaffRow[] {
    const monthEnd = shiftDate(monthStart, 1, -1);
    const byEmployee = new Map<string, StaffVersion[]>();
    for (const version of versions) {
        const list = byEmployee.get(version.id) ?? [];
        list.push(version);
        byEmployee.set(version.id, list);
    }
    const hours = new Map<string, HourDay[]>();
    for (const day of days) {
        const list = hours.get(day.id) ?? [];
        list.push(day);
        hours.set(day.id, list);
    }
    const rows: BranchStaffRow[] = [];
    for (const [employeeId, list] of byEmployee) {
        const ordered = list.slice().sort((left, right) => left.changedOn.localeCompare(right.changedOn));
        let opening = 0;
        ordered.forEach((version, index) => {
            if (version.changedOn <= monthStart) {
                opening = index;
            }
        });
        const visible = ordered.slice(opening).filter((version) => version.changedOn <= monthEnd);
        const intervals: { version: StaffVersion; from: string; until: string; leftOn: string | null }[] = [];
        visible.forEach((version, index) => {
            const next = visible[index + 1];
            const from = version.changedOn < monthStart ? monthStart : version.changedOn;
            const until = next ? shiftDate(next.changedOn, 0, -1) : monthEnd;
            if (from > until || version.branchId !== branchId) {
                return;
            }
            const leftOn = next && next.branchId !== branchId ? next.changedOn : null;
            intervals.push({ version, from, until, leftOn });
        });
        const segments: { version: StaffVersion; from: string; until: string; leftOn: string | null }[] = [];
        for (const interval of intervals) {
            const last = segments.at(-1);
            if (last && last.version.title === interval.version.title && shiftDate(last.until, 0, 1) === interval.from) {
                last.until = interval.until;
                last.version = interval.version;
                last.leftOn = interval.leftOn;
                continue;
            }
            segments.push({ ...interval });
        }
        const employeeDays = hours.get(employeeId) ?? [];
        segments.forEach((segment, index) => {
            const version = segment.version;
            const wholeMonth = segments.length === 1 && segment.from === monthStart && segment.until === monthEnd;
            rows.push({
                id: employeeId,
                rowKey: `${employeeId}:${segment.from}`,
                name: version.name,
                title: version.title,
                ktu: version.ktu,
                probation: version.probation === true,
                hourlyRate: finite(version.hourlyRate),
                salaryAmount: finite(version.salaryAmount),
                status: version.status,
                scheduleHours: hoursIn(employeeDays, wholeMonth ? "" : segment.from, wholeMonth ? "9999-12-31" : segment.until, "schedule"),
                timesheetHours: hoursIn(employeeDays, wholeMonth ? "" : segment.from, wholeMonth ? "9999-12-31" : segment.until, "timesheet"),
                activeFrom: segment.from,
                activeUntil: segment.until,
                titleChange: index > 0 && segments[index - 1]?.version.title !== version.title,
                partial: segment.from !== monthStart || segment.until !== monthEnd,
                markedOn: version.changedOn,
                leftOn: segment.leftOn,
            });
        });
    }
    return rows.sort((left, right) => left.name.localeCompare(right.name, "ru") || left.activeFrom.localeCompare(right.activeFrom));
}

function hoursIn(days: HourDay[], from: string, until: string, field: "schedule" | "timesheet"): number | null {
    let sum = 0;
    let seen = false;
    for (const day of days) {
        if (day.day < from || day.day > until) {
            continue;
        }
        const value = finite(day[field]);
        if (value === null) {
            continue;
        }
        sum += value;
        seen = true;
    }
    return seen ? Math.round(sum * 100) / 100 : null;
}

function premiumsBySegment(employees: BranchStaffRow[], days: { id: string; day: string; amount: number }[]): Record<string, number> {
    const premiums: Record<string, number> = {};
    for (const employee of employees) {
        let sum = 0;
        let seen = false;
        for (const day of days) {
            if (day.id !== employee.id || day.day < employee.activeFrom || day.day > employee.activeUntil) {
                continue;
            }
            sum += day.amount;
            seen = true;
        }
        if (seen) {
            premiums[employee.rowKey] = Math.round(sum * 100) / 100;
        }
    }
    return premiums;
}

function finite(value: number | null): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

function shiftDate(value: string, months: number, days: number): string {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, (day ?? 1) + days));
    return date.toISOString().slice(0, 10);
}

async function readConnectedIndicators(period: string, branchId: string): Promise<ConnectedBasketIndicator[]> {
    const rows = await db.query<ConnectedBasketIndicator>(
        `
        -- Последний срез подключения корзины на РРС филиала, не позже выбранного месяца.
        -- Пустая версия значит, что корзину отключили. Показатель берётся из справочника.
        SELECT id, title
        FROM (
            SELECT DISTINCT ON (indicator.id)
                   indicator.id::text AS id,
                   indicator.name AS title,
                   basket.sort_order,
                   connection.version_id
            FROM dictionaries.branches branch
            JOIN basket_connections connection
              ON connection.territory_uuid = branch.territory_uuid
             AND connection.period <= $1::date
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE branch.uuid = $2::uuid
            ORDER BY indicator.id, connection.period DESC, basket.sort_order
        ) latest
        WHERE version_id IS NOT NULL
        ORDER BY sort_order, title
        `,
        [period, branchId],
    );
    return rows.flatMap((row) => {
        const title = row.title.trim();
        if (title === "") {
            return [];
        }
        return [{ id: row.id, title }];
    });
}

async function readBaseBonus(period: string, branchId: string): Promise<number | null> {
    const rows = await db.query<{ baseBonus: string }>(
        `
        SELECT btrim(base_bonus) AS "baseBonus"
        FROM raw.basic_bonuses
        WHERE period = $1::date
          AND branch_uuid = $2::uuid
        `,
        [period, branchId],
    );
    return bonusAmount(rows[0]?.baseBonus ?? null);
}

function bonusAmount(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const text = value.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) {
        return null;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}
