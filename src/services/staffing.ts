import type { MotivationKtu } from "@/lib/motivation-roles";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { priceGrowthAllowanceFor } from "@/services/price-growth";

export interface StaffingBranch {
    id: string;
    name: string;
    territoryId: string;
    territoryName: string;
}

export interface StaffingRow {
    employeeId: string;
    name: string;
    territoryName: string;
    branchId: string;
    branchName: string;
    changedOn: string;
    title: string;
    ktu: MotivationKtu | null;
    status: string;
    probation: boolean | null;
    payLevel: number | null;
    hourlyRate: number | null;
    baseBonus: number | null;
    monthFixedPremium: number | null;
    manual: boolean;
    manualRoleId: string | null;
}

export interface StaffingView {
    branches: StaffingBranch[];
    rows: StaffingRow[];
    truncated: boolean;
}

const NDFL_RATE = 0.13;
const MONTH_HOURS = 165;
const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROW_LIMIT = 10000;

interface StaffingQueryRow {
    employeeId: string;
    name: string;
    territoryName: string;
    branchId: string;
    branchName: string;
    changedOn: string;
    title: string;
    ktu: boolean | null;
    status: string;
    probation: boolean | null;
    payLevel: number | string | null;
    hourlyRate: number | string | null;
    baseBonus: string | number | null;
    manual: boolean;
    manualRoleId: string | null;
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

const SCOPE = `
    (
        $1::text = 'all'
        OR (
            $1::text = 'granted'
            AND branch.territory_uuid IN (
                SELECT grant_row.territory_uuid
                FROM scope_grants grant_row
                WHERE lower(grant_row.username) = lower($2)
            )
        )
        OR (
            $1::text = 'home'
            AND branch.uuid IS NOT DISTINCT FROM (
                SELECT employee.branch_uuid
                FROM employees employee
                WHERE lower(employee.login) = lower($2)
                  AND NOT employee.deleted
                LIMIT 1
            )
        )
    )
`;

export function isStaffingPeriod(value: string | null): value is string {
    return value !== null && PERIOD.test(value);
}

export async function readStaffingBranches(access: AccessView, period: string): Promise<StaffingBranch[]> {
    const mode = scopeMode(access);
    if (mode === "none") {
        return [];
    }
    return db.query<StaffingBranch>(
            `
            SELECT branch.uuid::text AS id,
                   branch.name,
                   COALESCE(territory.uuid::text, '') AS "territoryId",
                   COALESCE(territory.name, 'РРС не найдена') AS "territoryName"
            FROM branches branch
            LEFT JOIN territories territory
                ON territory.uuid = branch.territory_uuid
            WHERE NOT branch.deleted
              AND ${SCOPE}
              AND EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period = $3::date
                    AND lower(staff.branch_uuid) = lower(branch.uuid::text)
              )
            ORDER BY territory.name, branch.name
            `,
        [mode, access.username, period],
    );
}

export async function readStaffing(
    access: AccessView,
    period: string,
    branchId: string,
    territoryId: string,
    query: string,
): Promise<StaffingView> {
    const mode = scopeMode(access);
    const branches = await readStaffingBranches(access, period);
    const allowedBranches = new Set(branches.map((item) => item.id.toLowerCase()));
    const allowedTerritories = new Set(branches.map((item) => item.territoryId.toLowerCase()).filter((item) => item !== ""));
    const branchFilter = idList(branchId, allowedBranches);
    const territoryFilter = idList(territoryId, allowedTerritories);
    const needle = query.trim();
    if (branchFilter === "" && territoryFilter === "" && needle.length === 0) {
        return { branches, rows: [], truncated: false };
    }
    const [rows, priceGrowth] = await Promise.all([
        db.query<StaffingQueryRow>(
        `
        SELECT staff.employees_uuid AS "employeeId",
               COALESCE(NULLIF(btrim(employee.name), ''), 'Сотрудник без имени') AS name,
               COALESCE(territory.name, 'РРС не найдена') AS "territoryName",
               lower(staff.branch_uuid) AS "branchId",
               COALESCE(branch.name, 'Филиал не найден') AS "branchName",
               to_char(staff.date_modified, 'YYYY-MM-DD') AS "changedOn",
               COALESCE(staff.title, '') AS title,
               staff.ktu,
               COALESCE(staff.status, '') AS status,
               staff.probation,
               staff.salary_amount AS "payLevel",
               staff.hourly_rate AS "hourlyRate",
               bonus.base_bonus AS "baseBonus",
               assignment.role_id AS "manualRoleId",
               assignment.employee_uuid IS NOT NULL AS manual
        FROM raw.hr_ktu staff
        LEFT JOIN employees employee
            ON lower(employee.uuid::text) = lower(staff.employees_uuid)
        LEFT JOIN branches branch
            ON lower(branch.uuid::text) = lower(staff.branch_uuid)
        LEFT JOIN territories territory
            ON territory.uuid = branch.territory_uuid
        LEFT JOIN raw.basic_bonuses bonus
            ON bonus.period = staff.period
           AND lower(bonus.branch_uuid::text) = lower(staff.branch_uuid)
        LEFT JOIN branch_motivation_roles assignment
            ON lower(assignment.branch_uuid) = lower(staff.branch_uuid)
           AND lower(assignment.employee_uuid) = lower(staff.employees_uuid)
        WHERE staff.period = $3::date
          AND ${SCOPE}
          AND (
              ($4::text = '' AND $6::text = '')
              OR lower(staff.branch_uuid) = ANY (string_to_array($4, ','))
              OR lower(territory.uuid::text) = ANY (string_to_array($6, ','))
          )
          AND (
              $5::text = ''
              OR employee.name ILIKE $5 ESCAPE '\\'
          )
        ORDER BY territory.name, branch.name, employee.name, staff.employees_uuid, staff.date_modified
        LIMIT ${ROW_LIMIT + 1}
        `,
        [mode, access.username, period, branchFilter, likePattern(needle), territoryFilter],
        ),
        priceGrowthAllowanceFor(period),
    ]);
    const growth = priceGrowth ?? 0;
    return {
        branches,
        rows: rows.slice(0, ROW_LIMIT).map((row) => {
            const payLevel = finiteNumber(row.payLevel);
            const hourlyRate = finiteNumber(row.hourlyRate);
            const baseBonus = bonusAmount(row.baseBonus);
            return {
                ...row,
                ktu: row.ktu === true ? "plus" : "minus",
                probation: row.probation === true,
                payLevel,
                hourlyRate,
                baseBonus,
                monthFixedPremium: monthFixedPremium(payLevel, hourlyRate, baseBonus, growth),
                manual: Boolean(row.manual),
            };
        }),
        truncated: rows.length > ROW_LIMIT,
    };
}

function monthFixedPremium(
    payLevel: number | null,
    hourlyRate: number | null,
    baseBonus: number | null,
    priceGrowth: number,
): number | null {
    if (payLevel === null || hourlyRate === null || hourlyRate <= 0 || baseBonus === null) {
        return null;
    }
    const netHourly = hourlyRate * (1 - NDFL_RATE);
    const amount = payLevel - baseBonus - priceGrowth - netHourly * MONTH_HOURS;
    return amount < 0 ? 0 : amount;
}

function finiteNumber(value: number | string | null): number | null {
    if (value === null) {
        return null;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

function bonusAmount(value: string | number | null): number | null {
    if (value === null) {
        return null;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    const text = value.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) {
        return null;
    }
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

function idList(value: string, allowed: Set<string>): string {
    return value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => UUID.test(item) && allowed.has(item))
        .join(",");
}

function likePattern(value: string): string {
    if (!value) {
        return "";
    }
    return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
