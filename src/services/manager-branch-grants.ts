import { can } from "@/lib/access";
import {
    closedGrantPolicies,
    effectiveManagerFlags,
    managerTitleGroup,
    receivesManagerGrants,
    sparseManagerGrants,
    type ManagerAccessPage,
    type ManagerAccessPerson,
    type ManagerGrantDraft,
    type ManagerGrantPolicies,
    type ManagerGrantPolicy,
    type ManagerGrantSettings,
    type ManagerTitleGroup,
    type StoredManagerGrant,
} from "@/lib/manager-grants";
import type { PermissionCode } from "@/lib/permissions";
import { decideAccess } from "@/server/authz/match-access";
import { audit, type AccessView } from "@/server/authz/resolve-access";
import { listRrsTerritories } from "@/services/basket-connections";
import { db } from "@/services/db";
import { managerTitleGroupSql } from "@/services/premium-access";
import { isDevLoginName } from "@/services/dev-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_SETTINGS_SQL = `
SELECT permission_code
FROM role_permission_codes code
JOIN roles role ON role.id = code.role_id
WHERE role.code = 'store-manager'
  AND permission_code = ANY($1::text[])
`;

const SETTING_CODES = ["branch.roles:write", "branch.brigades:write", "branch.shared:write"];

export class ManagerGrantError extends Error {
    readonly status: 400 | 403 | 404 | 409;

    constructor(status: 400 | 403 | 404 | 409, message: string) {
        super(message);
        this.name = "ManagerGrantError";
        this.status = status;
    }
}

interface TerritoryRow {
    uuid: string;
    code: string;
    name: string;
}

interface EmployeeRow {
    id: string;
    login: string;
    name: string;
    title: string;
    territoryId: string | null;
    branchId: string | null;
}

interface BranchRow {
    id: string;
    code: string;
    name: string;
}

interface PersonRow {
    id: string;
    login: string;
    name: string;
    title: string;
    roleCode: string | null;
    branchId: string | null;
    branchName: string | null;
}

interface GrantRow {
    employeeId: string;
    branchId: string;
    code: string;
    allowed: boolean;
}

interface FlagRow {
    home: boolean;
    sameTerritory: boolean;
    code: string | null;
    allowed: boolean | null;
    policyAccess: boolean;
    policyRoles: boolean;
    policyBrigades: boolean;
    policyShared: boolean;
}

export async function readManagerAccess(access: AccessView, territoryUuid: string): Promise<ManagerAccessPage> {
    const territory = await openTerritory(access, territoryUuid);
    const mode = await accessMode(access, territory.uuid);
    const settings = await roleSettings();
    const policies = await readPolicies(territory.uuid, settings);
    if (mode === "readonly") {
        return {
            territory,
            editable: false,
            notice: "Выдача доступа доступна только в вашей РРС.",
            settings,
            policies,
            managers: [],
        };
    }
    const managers = await readManagers(territory.uuid, settings, policies);
    return { territory, editable: true, notice: null, settings, policies, managers };
}

export async function saveManagerAccess(
    access: AccessView,
    territoryUuid: string,
    employeeId: string,
    drafts: ManagerGrantDraft[],
): Promise<ManagerAccessPage> {
    const territory = await openTerritory(access, territoryUuid);
    const mode = await accessMode(access, territory.uuid);
    if (mode !== "edit") {
        throw new ManagerGrantError(403, "Выдача доступа доступна только в вашей РРС");
    }
    if (!UUID.test(employeeId)) {
        throw new ManagerGrantError(400, "Укажите управляющего");
    }
    const employee = await loadEmployee(employeeId);
    if (!employee || employee.territoryId !== territory.uuid) {
        throw new ManagerGrantError(400, "Управляющий относится к другой РРС");
    }
    if (isDevLoginName(employee.login)) {
        throw new ManagerGrantError(400, "Этому сотруднику доступ не выдаётся");
    }
    const group = managerTitleGroup(employee.title);
    if (!group) {
        throw new ManagerGrantError(400, "Этой должности доступ не выдаётся");
    }
    const decision = await decideAccess(employee.login, employee.title);
    if (!titleMayReceiveGrant(group, decision.role?.code)) {
        throw new ManagerGrantError(400, group === "senior" ? "Сотрудник больше не старший продавец" : "Сотрудник больше не управляющий");
    }
    const branches = await territoryBranches(territory.uuid);
    const branchIds = new Set(branches.map((branch) => branch.id));
    const normalized = drafts.map((draft) => ({ ...draft, id: draft.id.toLowerCase() }));
    const sent = normalized.map((draft) => draft.id);
    if (sent.length !== branchIds.size || new Set(sent).size !== sent.length || sent.some((id) => !branchIds.has(id))) {
        throw new ManagerGrantError(409, "Список филиалов изменился. Обновите страницу");
    }
    const homeId = employee.branchId && branchIds.has(employee.branchId) ? employee.branchId : null;
    const settings = await roleSettings();
    const policies = await readPolicies(territory.uuid, settings);
    const existing = await readStoredGrants(territory.uuid, [employee.id]);
    const stored = existing.get(employee.id) ?? new Map<string, StoredManagerGrant[]>();
    const rows = normalized.flatMap((draft) => {
        const sparse = sparseManagerGrants(draft, draft.id === homeId, settings, policies[group], stored.get(draft.id) ?? []);
        if ("error" in sparse) {
            throw new ManagerGrantError(400, sparse.error);
        }
        return sparse.rows;
    });
    await db.transaction(async (query) => {
        await query(
            "DELETE FROM manager_branch_grants WHERE territory_uuid = $1::uuid AND employee_uuid = $2::uuid",
            [territory.uuid, employee.id],
        );
        if (rows.length === 0) {
            return;
        }
        await query(
            `
            INSERT INTO manager_branch_grants (
                territory_uuid, employee_uuid, branch_uuid, permission_code, allowed, granted_by
            )
            SELECT $1::uuid, $2::uuid, row.branch_id, row.code, row.allowed, $3
            FROM unnest($4::uuid[], $5::text[], $6::boolean[]) AS row(branch_id, code, allowed)
            `,
            [territory.uuid, employee.id, access.username, rows.map((row) => row.branchId), rows.map((row) => row.code), rows.map((row) => row.allowed)],
        );
    });
    await audit(access.username, "manager.branch.grant", `${employee.login} → ${territory.uuid}`);
    return readManagerAccess(access, territory.uuid);
}

export async function saveManagerGrantPolicy(
    access: AccessView,
    territoryUuid: string,
    policies: ManagerGrantPolicies,
): Promise<ManagerAccessPage> {
    const territory = await openTerritory(access, territoryUuid);
    const mode = await accessMode(access, territory.uuid);
    if (mode !== "edit") {
        throw new ManagerGrantError(403, "Выдача доступа доступна только в вашей РРС");
    }
    const settings = await roleSettings();
    const rows = policyRows(policies, settings);
    await db.transaction(async (query) => {
        await query("DELETE FROM manager_grant_policies WHERE territory_uuid = $1::uuid", [territory.uuid]);
        if (rows.length === 0) {
            return;
        }
        await query(
            `
            INSERT INTO manager_grant_policies (
                territory_uuid, permission_code, enabled, updated_by, title_group
            )
            SELECT $1::uuid, row.permission_code, true, $2, row.title_group
            FROM unnest($3::text[], $4::text[]) AS row(permission_code, title_group)
            `,
            [territory.uuid, access.username, rows.map((row) => row.code), rows.map((row) => row.group)],
        );
    });
    const details = rows.length === 0
        ? "выключено"
        : rows.map((row) => `${row.group}:${row.code}`).join(", ");
    await audit(access.username, "manager.grant.policy", `${territory.uuid}: ${details}`);
    return readManagerAccess(access, territory.uuid);
}

export async function readOwnGrantTerritory(access: AccessView): Promise<TerritoryRow | null> {
    assertHolder(access);
    const territoryId = await employeeTerritory(access.username);
    if (!territoryId) {
        return null;
    }
    return loadTerritory(territoryId);
}

export function holdsBranchSetting(access: AccessView, permission: PermissionCode): boolean {
    if (can(access, permission)) {
        return true;
    }
    return access.role?.code === "linear" && !access.previewRoleName && managerTitleGroup(access.title) === "senior";
}

export async function managerBranchSettings(access: AccessView, branchId: string): Promise<ManagerGrantSettings> {
    if (access.fullAccess || !receivesManagerGrants(access.role?.code, access.title)) {
        return actorSettings(access);
    }
    const ceiling = access.role?.code === "store-manager" ? actorSettings(access) : await roleSettings();
    const flags = await readManagerFlags(access.username, branchId, ceiling);
    return { roles: flags.roles, brigades: flags.brigades, shared: flags.shared };
}

export async function managerMayChangeBranch(
    access: AccessView,
    branchId: string,
    permission: Extract<PermissionCode, "branch.roles:write" | "branch.brigades:write" | "branch.shared:write">,
): Promise<boolean> {
    const settings = await managerBranchSettings(access, branchId);
    if (permission === "branch.roles:write") {
        return settings.roles;
    }
    if (permission === "branch.brigades:write") {
        return settings.brigades;
    }
    return settings.shared;
}

async function readManagers(territoryId: string, settings: ManagerGrantSettings, policies: ManagerGrantPolicies): Promise<ManagerAccessPerson[]> {
    const people = await db.query<PersonRow>(
        `
        WITH people AS (
            SELECT employee.uuid,
                   employee.login,
                   employee.name,
                   COALESCE(employee.title, '') AS title,
                   employee.branch_uuid
            FROM employees employee
            WHERE employee.territory_uuid = $1::uuid
              AND NOT employee.deleted
              AND btrim(employee.login) <> ''
              AND (
                  replace(lower(btrim(COALESCE(employee.title, ''))), 'ё', 'е') LIKE 'управляющий маг.%'
                  OR replace(lower(btrim(COALESCE(employee.title, ''))), 'ё', 'е') LIKE 'управляющий филиала магазин-склад%'
                  OR replace(lower(btrim(COALESCE(employee.title, ''))), 'ё', 'е') LIKE 'зам. управляющего магазина%'
                  OR replace(lower(btrim(COALESCE(employee.title, ''))), 'ё', 'е') LIKE 'заместитель управляющего магазина%'
                  OR replace(lower(btrim(COALESCE(employee.title, ''))), 'ё', 'е') LIKE 'старший продавец%'
              )
        ),
        matched AS (
            SELECT people.uuid,
                   rule.priority,
                   role.id AS role_id,
                   role.code
            FROM people
            JOIN role_rules rule
              ON (rule.expires_at IS NULL OR rule.expires_at > NOW())
             AND (
                (rule.match_type = 'login' AND lower(rule.match_value) = lower(people.login))
                OR (rule.match_type = 'title' AND rule.match_value = people.title AND people.title <> '')
             )
            JOIN roles role ON role.id = rule.role_id
        ),
        top_priority AS (
            SELECT uuid, MAX(priority) AS priority
            FROM matched
            GROUP BY uuid
        ),
        winners AS (
            SELECT matched.uuid, MIN(matched.code) AS code
            FROM matched
            JOIN top_priority
              ON top_priority.uuid = matched.uuid
             AND top_priority.priority = matched.priority
            GROUP BY matched.uuid
            HAVING COUNT(DISTINCT matched.role_id) = 1
        )
        SELECT people.uuid::text AS id,
               people.login,
               people.name,
               people.title,
               winners.code AS "roleCode",
               people.branch_uuid::text AS "branchId",
               branch.name AS "branchName"
        FROM people
        LEFT JOIN winners ON winners.uuid = people.uuid
        LEFT JOIN branches branch ON branch.uuid = people.branch_uuid AND NOT branch.deleted
        ORDER BY people.name, people.login
        `,
        [territoryId],
    );
    const managers = people.filter((person) => {
        if (isDevLoginName(person.login)) {
            return false;
        }
        const titleGroup = managerTitleGroup(person.title);
        return titleGroup !== null && titleMayReceiveGrant(titleGroup, person.roleCode);
    });
    if (managers.length === 0) {
        return [];
    }
    const branches = await territoryBranches(territoryId);
    const byEmployee = await readStoredGrants(territoryId, managers.map((person) => person.id));
    return managers.map((person) => {
        const homeId = person.branchId?.toLowerCase() ?? null;
        const stored = byEmployee.get(person.id.toLowerCase()) ?? new Map<string, StoredManagerGrant[]>();
        const group = managerTitleGroup(person.title);
        if (!group) {
            return null;
        }
        return {
            id: person.id.toLowerCase(),
            name: person.name,
            title: person.title,
            group,
            branchName: person.branchName,
            branches: branches.map((branch) => {
                const home = homeId === branch.id;
                const flags = effectiveManagerFlags(home, true, stored.get(branch.id) ?? [], settings, policies[group]);
                return { ...branch, ...flags, home };
            }),
        };
    }).filter((person): person is ManagerAccessPerson => person !== null);
}

async function readStoredGrants(territoryId: string, employeeIds: string[]): Promise<Map<string, Map<string, StoredManagerGrant[]>>> {
    const byEmployee = new Map<string, Map<string, StoredManagerGrant[]>>();
    if (employeeIds.length === 0) {
        return byEmployee;
    }
    const grants = await db.query<GrantRow>(
        `
        SELECT employee_uuid::text AS "employeeId",
               branch_uuid::text AS "branchId",
               permission_code AS code,
               allowed
        FROM manager_branch_grants
        WHERE territory_uuid = $1::uuid
          AND employee_uuid = ANY($2::uuid[])
        `,
        [territoryId, employeeIds],
    );
    for (const grant of grants) {
        const employeeId = grant.employeeId.toLowerCase();
        const branchId = grant.branchId.toLowerCase();
        let branchesOfEmployee = byEmployee.get(employeeId);
        if (!branchesOfEmployee) {
            branchesOfEmployee = new Map();
            byEmployee.set(employeeId, branchesOfEmployee);
        }
        const list = branchesOfEmployee.get(branchId) ?? [];
        list.push({ code: grant.code, allowed: grant.allowed });
        branchesOfEmployee.set(branchId, list);
    }
    return byEmployee;
}

async function readPolicies(territoryId: string, settings: ManagerGrantSettings): Promise<ManagerGrantPolicies> {
    const rows = await db.query<{ code: string; titleGroup: ManagerTitleGroup }>(
        `
        SELECT permission_code AS code,
               title_group AS "titleGroup"
        FROM manager_grant_policies
        WHERE territory_uuid = $1::uuid
          AND enabled
        `,
        [territoryId],
    );
    const policies = closedGrantPolicies();
    for (const row of rows) {
        const policy = policies[row.titleGroup];
        if (!policy) {
            continue;
        }
        if (row.code === "branch.access") {
            policy.access = true;
        } else if (row.code === "branch.roles:write") {
            policy.roles = settings.roles;
        } else if (row.code === "branch.brigades:write") {
            policy.brigades = settings.brigades;
        } else if (row.code === "branch.shared:write") {
            policy.shared = settings.shared;
        }
    }
    return policies;
}

function policyRows(
    policies: ManagerGrantPolicies,
    settings: ManagerGrantSettings,
): { code: string; group: ManagerTitleGroup }[] {
    const rows: { code: string; group: ManagerTitleGroup }[] = [];
    for (const group of ["manager", "deputy", "senior"] as const) {
        const policy = maskPolicy(policies[group], settings);
        for (const code of policyCodes(policy)) {
            rows.push({ code, group });
        }
    }
    return rows;
}

function maskPolicy(policy: ManagerGrantPolicy, settings: ManagerGrantSettings): ManagerGrantPolicy {
    return {
        access: policy.access,
        roles: policy.roles && settings.roles,
        brigades: policy.brigades && settings.brigades,
        shared: policy.shared && settings.shared,
    };
}

function policyCodes(policy: ManagerGrantPolicy): string[] {
    const codes: string[] = [];
    if (policy.access) {
        codes.push("branch.access");
    }
    if (policy.roles) {
        codes.push("branch.roles:write");
    }
    if (policy.brigades) {
        codes.push("branch.brigades:write");
    }
    if (policy.shared) {
        codes.push("branch.shared:write");
    }
    return codes;
}

function titleMayReceiveGrant(group: ManagerTitleGroup, roleCode: string | null | undefined): boolean {
    if (group === "senior") {
        return roleCode == null || roleCode === "linear" || roleCode === "store-manager";
    }
    return roleCode === "store-manager";
}

async function readManagerFlags(
    username: string,
    branchId: string,
    roleSettings: ManagerGrantSettings,
): Promise<ManagerGrantSettings & { access: boolean }> {
    if (!UUID.test(branchId)) {
        return { access: false, roles: false, brigades: false, shared: false };
    }
    const rows = await db.query<FlagRow>(
        `
        SELECT place.home,
               place.same_territory AS "sameTerritory",
               grant_row.permission_code AS code,
               grant_row.allowed,
               COALESCE(policy.access, false) AS "policyAccess",
               COALESCE(policy.roles, false) AS "policyRoles",
               COALESCE(policy.brigades, false) AS "policyBrigades",
               COALESCE(policy.shared, false) AS "policyShared"
        FROM (
            SELECT employee.uuid AS employee_id,
                   employee.territory_uuid AS employee_territory,
                   branch.territory_uuid AS branch_territory,
                   branch.uuid IS NOT DISTINCT FROM employee.branch_uuid AS home,
                   employee.territory_uuid IS NOT NULL
                       AND branch.territory_uuid IS NOT DISTINCT FROM employee.territory_uuid AS same_territory,
                   ${managerTitleGroupSql("employee.title")} AS title_group
            FROM employees employee
            JOIN branches branch ON branch.uuid = $2::uuid AND NOT branch.deleted
            WHERE lower(employee.login) = lower($1)
              AND NOT employee.deleted
            LIMIT 1
        ) place
        LEFT JOIN manager_branch_grants grant_row
          ON place.same_territory
         AND grant_row.territory_uuid = place.employee_territory
         AND grant_row.employee_uuid = place.employee_id
         AND grant_row.branch_uuid = $2::uuid
        LEFT JOIN LATERAL (
            SELECT bool_or(permission_code = 'branch.access' AND enabled) AS access,
                   bool_or(permission_code = 'branch.roles:write' AND enabled) AS roles,
                   bool_or(permission_code = 'branch.brigades:write' AND enabled) AS brigades,
                   bool_or(permission_code = 'branch.shared:write' AND enabled) AS shared
            FROM manager_grant_policies
            WHERE territory_uuid = place.employee_territory
              AND title_group = place.title_group
        ) policy ON place.same_territory
        `,
        [username, branchId],
    );
    if (rows.length === 0) {
        return { access: false, roles: false, brigades: false, shared: false };
    }
    const grants = rows.flatMap((row) => row.code ? [{ code: row.code, allowed: row.allowed === true }] : []);
    const policy: ManagerGrantPolicy = {
        access: rows[0].policyAccess === true,
        roles: rows[0].policyRoles === true && roleSettings.roles,
        brigades: rows[0].policyBrigades === true && roleSettings.brigades,
        shared: rows[0].policyShared === true && roleSettings.shared,
    };
    return effectiveManagerFlags(rows[0].home, rows[0].sameTerritory, grants, roleSettings, policy);
}

async function openTerritory(access: AccessView, territoryUuid: string): Promise<TerritoryRow> {
    if (!UUID.test(territoryUuid)) {
        throw new ManagerGrantError(400, "Некорректная территория");
    }
    assertHolder(access);
    const territory = await loadTerritory(territoryUuid);
    if (!territory) {
        throw new ManagerGrantError(404, "Территория не найдена");
    }
    return territory;
}

function assertHolder(access: AccessView): void {
    if (access.fullAccess) {
        return;
    }
    if (access.role?.code !== "rrs-director" || !access.permissions.includes("branch.grants:write")) {
        throw new ManagerGrantError(403, "Выдачу доступа делает администрация РРС");
    }
}

async function accessMode(access: AccessView, territoryId: string): Promise<"edit" | "readonly"> {
    if (access.fullAccess) {
        return "edit";
    }
    const own = await employeeTerritory(access.username);
    if (own === territoryId) {
        return "edit";
    }
    const visible = await listRrsTerritories(access);
    if (visible.some((territory) => territory.uuid.toLowerCase() === territoryId)) {
        return "readonly";
    }
    throw new ManagerGrantError(403, "Выдача доступа доступна только в вашей РРС");
}

async function employeeTerritory(username: string): Promise<string | null> {
    const rows = await db.query<{ territoryId: string | null }>(
        `
        SELECT territory_uuid::text AS "territoryId"
        FROM employees
        WHERE lower(login) = lower($1)
          AND NOT deleted
        LIMIT 1
        `,
        [username],
    );
    return rows[0]?.territoryId?.toLowerCase() ?? null;
}

async function loadTerritory(territoryId: string): Promise<TerritoryRow | null> {
    const rows = await db.query<TerritoryRow>(
        `
        SELECT uuid::text AS uuid, code, name
        FROM territories
        WHERE uuid = $1::uuid
          AND NOT deleted
        `,
        [territoryId],
    );
    const territory = rows[0];
    if (!territory) {
        return null;
    }
    return { ...territory, uuid: territory.uuid.toLowerCase() };
}

async function loadEmployee(employeeId: string): Promise<EmployeeRow | null> {
    const rows = await db.query<EmployeeRow>(
        `
        SELECT uuid::text AS id,
               login,
               name,
               COALESCE(title, '') AS title,
               territory_uuid::text AS "territoryId",
               branch_uuid::text AS "branchId"
        FROM employees
        WHERE uuid = $1::uuid
          AND NOT deleted
        `,
        [employeeId],
    );
    const employee = rows[0];
    if (!employee) {
        return null;
    }
    return {
        ...employee,
        id: employee.id.toLowerCase(),
        territoryId: employee.territoryId?.toLowerCase() ?? null,
        branchId: employee.branchId?.toLowerCase() ?? null,
    };
}

async function territoryBranches(territoryId: string): Promise<BranchRow[]> {
    const rows = await db.query<BranchRow>(
        `
        SELECT uuid::text AS id, code, name
        FROM branches
        WHERE territory_uuid = $1::uuid
          AND NOT deleted
        ORDER BY name
        `,
        [territoryId],
    );
    return rows.map((branch) => ({ ...branch, id: branch.id.toLowerCase() }));
}

async function roleSettings(): Promise<ManagerGrantSettings> {
    const rows = await db.query<{ permission_code: string }>(ROLE_SETTINGS_SQL, [SETTING_CODES]);
    const codes = new Set(rows.map((row) => row.permission_code));
    return {
        roles: codes.has("branch.roles:write"),
        brigades: codes.has("branch.brigades:write"),
        shared: codes.has("branch.shared:write"),
    };
}

function actorSettings(access: AccessView): ManagerGrantSettings {
    return {
        roles: access.fullAccess || access.permissions.includes("branch.roles:write"),
        brigades: access.fullAccess || access.permissions.includes("branch.brigades:write"),
        shared: access.fullAccess || access.permissions.includes("branch.shared:write"),
    };
}
