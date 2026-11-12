import { BRANCH_SETTINGS_PERMISSIONS } from "@/lib/permissions";
import type { AccessView } from "@/server/authz/resolve-access";
import { db } from "@/services/db";
import { moscowToday } from "@/services/segment-locks";

export type CabinetScope = "all" | "home" | "granted" | "territory";
export type BranchChoice = "open" | "assignment";

const BRANCH_UUID = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

function workedAssignmentsSql(employeeIdSql: string, periodSql: string): string {
    return `
        SELECT version.branch_id, version.started
        FROM (
            SELECT assignment.branch_id,
                   assignment.started,
                   assignment.status,
                   LEAD(assignment.started) OVER (ORDER BY assignment.started, assignment.branch_id) AS ended
            FROM (
                SELECT DISTINCT ON (staff.date_modified)
                       lower(btrim(staff.branch_uuid::text)) AS branch_id,
                       staff.date_modified AS started,
                       btrim(COALESCE(staff.status, '')) AS status
                FROM raw.hr_ktu staff
                WHERE ${employeeIdSql} IS NOT NULL
                  AND lower(staff.employees_uuid::text) = ${employeeIdSql}
                  AND staff.date_modified IS NOT NULL
                  AND btrim(staff.branch_uuid::text) ~* '${BRANCH_UUID}'
                ORDER BY staff.date_modified, staff.period DESC NULLS LAST
            ) assignment
        ) version
        WHERE version.status <> 'Уволен'
          AND version.started < (${periodSql}::date + INTERVAL '1 month')
          AND (version.ended IS NULL OR version.ended > ${periodSql}::date)
    `;
}

const OWN_PREMIUM_SQL = `
EXISTS (
    SELECT 1
    FROM main.basket_premium_days day
    WHERE day.period = $3::date
      AND day.branch_uuid = branch.uuid
      AND lower(day.employee_uuid) = lower(home.employee_id)
)
OR EXISTS (
    SELECT 1
    FROM main.shared_premiums share
    WHERE share.period = $3::date
      AND share.branch_uuid = branch.uuid
      AND lower(share.employee_uuid) = lower(home.employee_id)
)
`;

export const CABINET_HOME_SQL = `
LEFT JOIN LATERAL (
    SELECT employee.branch_uuid,
           employee.territory_uuid,
           lower(employee.uuid::text) AS employee_id
    FROM employees employee
    WHERE lower(employee.login) = lower($2)
      AND NOT employee.deleted
    LIMIT 1
) home ON true
`;

export const CABINET_SCOPE_SQL = `
(
    'all' = ANY($1::text[])
    OR (
        'home' = ANY($1::text[])
        AND (
            branch.uuid IS NOT DISTINCT FROM home.branch_uuid
            OR ${OWN_PREMIUM_SQL}
            OR (
                NOT (
                    'all' = ANY($1::text[])
                    OR 'granted' = ANY($1::text[])
                    OR 'territory' = ANY($1::text[])
                )
                AND lower(branch.uuid::text) IN (
                    SELECT assignment.branch_id
                    FROM (${workedAssignmentsSql("home.employee_id", "$3")}) assignment
                )
            )
        )
    )
    OR (
        'granted' = ANY($1::text[])
        AND branch.territory_uuid IN (
            SELECT grant_row.territory_uuid
            FROM scope_grants grant_row
            WHERE lower(grant_row.username) = lower($2)
        )
    )
    OR (
        'territory' = ANY($1::text[])
        AND branch.territory_uuid IS NOT DISTINCT FROM home.territory_uuid
    )
)
`;

export function cabinetScopes(access: AccessView): CabinetScope[] {
    if (access.fullAccess || access.permissions.includes("bonus.any:read")) {
        return ["all"];
    }
    const scopes: CabinetScope[] = [];
    if (access.permissions.includes("bonus.branch:read")) {
        scopes.push("home");
    }
    if (access.permissions.includes("bonus.granted:read")) {
        scopes.push("granted");
    }
    if (access.permissions.includes("bonus.territory:read")) {
        scopes.push("territory");
    }
    return scopes;
}

export function branchListScopes(access: AccessView): CabinetScope[] {
    const premium = cabinetScopes(access);
    if (premium.length > 0) {
        return premium;
    }
    const tools = access.permissions.includes("branch.tariffs:read")
        || BRANCH_SETTINGS_PERMISSIONS.some((permission) => access.permissions.includes(permission));
    if (!tools) {
        return [];
    }
    if (access.role?.scopeKind === "division") {
        return ["all"];
    }
    if (access.role?.scopeKind === "granted") {
        return ["granted"];
    }
    if (access.role?.scopeKind === "home_branch") {
        return ["home"];
    }
    return [];
}

export function seesForeignDetail(access: AccessView): boolean {
    return access.fullAccess
        || access.permissions.includes("bonus.any:read")
        || access.permissions.includes("bonus.detail:read");
}

export function seesSharedDetail(access: AccessView): boolean {
    return access.fullAccess
        || access.permissions.includes("bonus.any:read")
        || access.permissions.includes("bonus.shared:read");
}

export interface BranchPlacement {
    branchChoice: BranchChoice;
    workedBranchIds: string[];
    preferredBranchId: string | null;
}

export function branchChoiceFor(access: AccessView): BranchChoice {
    const scopes = branchListScopes(access);
    if (scopes.some((scope) => scope === "all" || scope === "granted" || scope === "territory")) {
        return "open";
    }
    return "assignment";
}

export function isCurrentStaffPeriod(period: string, now = new Date()): boolean {
    return period.slice(0, 7) === moscowToday(now).slice(0, 7);
}

export async function readBranchPlacement(access: AccessView, period: string): Promise<BranchPlacement> {
    const branchChoice = branchChoiceFor(access);
    if (branchChoice === "open") {
        return { branchChoice, workedBranchIds: [], preferredBranchId: null };
    }
    const rows = await db.query<{ currentBranch: string | null; id: string | null }>(
        `
        WITH person AS (
            SELECT lower(employee.uuid::text) AS employee_id,
                   employee.branch_uuid::text AS current_branch
            FROM employees employee
            WHERE lower(employee.login) = lower($1)
              AND NOT employee.deleted
            LIMIT 1
        )
        SELECT person.current_branch AS "currentBranch",
               worked.id
        FROM person
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (lower(branch.uuid::text))
                   branch.uuid::text AS id,
                   assignment.started
            FROM (${workedAssignmentsSql("person.employee_id", "$2")}) assignment
            JOIN branches branch
                ON lower(branch.uuid::text) = assignment.branch_id
               AND NOT branch.deleted
            ORDER BY lower(branch.uuid::text), assignment.started DESC
        ) worked ON true
        ORDER BY worked.started DESC NULLS LAST, worked.id
        `,
        [access.username, period],
    );
    const currentBranch = rows[0]?.currentBranch ?? null;
    const workedBranchIds = rows.flatMap((row) => row.id ? [row.id] : []);
    let preferredBranchId = workedBranchIds[0] ?? null;
    if (isCurrentStaffPeriod(period) && currentBranch && new RegExp(BRANCH_UUID, "i").test(currentBranch)) {
        const listed = workedBranchIds.find((id) => id.toLowerCase() === currentBranch.toLowerCase());
        preferredBranchId = listed ?? currentBranch;
        if (!listed) {
            workedBranchIds.push(currentBranch);
        }
    }
    return { branchChoice, workedBranchIds, preferredBranchId };
}

export async function cabinetViewer(access: AccessView): Promise<{ employeeId: string | null; foreignDetail: boolean }> {
    const rows = await db.query<{ id: string | null }>(
        `
        SELECT lower(employee.uuid::text) AS id
        FROM employees employee
        WHERE lower(employee.login) = lower($1)
          AND NOT employee.deleted
        LIMIT 1
        `,
        [access.username],
    );
    return {
        employeeId: rows[0]?.id ?? null,
        foreignDetail: seesForeignDetail(access),
    };
}

export async function branchVisible(access: AccessView, period: string, branchId: string): Promise<boolean> {
    const scopes = cabinetScopes(access);
    if (scopes.length === 0) {
        return false;
    }
    const rows = await db.query<{ ok: number }>(
        `
        SELECT 1 AS ok
        FROM branches branch
        ${CABINET_HOME_SQL}
        WHERE branch.uuid = $4::uuid
          AND NOT branch.deleted
          AND ${CABINET_SCOPE_SQL}
          AND (
              EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period <= $3::date
                    AND lower(staff.branch_uuid::text) = lower(branch.uuid::text)
              )
              OR branch.uuid IS NOT DISTINCT FROM home.branch_uuid
          )
        `,
        [scopes, access.username, period, branchId],
    );
    return rows.length > 0;
}

export async function canReadEmployeeDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
): Promise<boolean> {
    if (!await branchVisible(access, period, branchId)) {
        return false;
    }
    if (seesForeignDetail(access)) {
        return true;
    }
    const viewer = await cabinetViewer(access);
    if (viewer.employeeId !== null && viewer.employeeId === employeeId.toLowerCase()) {
        return true;
    }
    if (!seesSharedDetail(access)) {
        throw new DetailForbiddenError();
    }
    const authors = await db.query<{ ok: number }>(
        `
        SELECT 1 AS ok
        FROM main.shared_premium_authors author
        WHERE author.period = $1::date
          AND author.branch_uuid = $2::uuid
          AND lower(author.employee_uuid) = lower($3)
        LIMIT 1
        `,
        [period, branchId, employeeId],
    );
    if (authors.length > 0) {
        return true;
    }
    throw new DetailForbiddenError();
}

export class DetailForbiddenError extends Error {
    constructor() {
        super("Детализация другого сотрудника недоступна");
    }
}
