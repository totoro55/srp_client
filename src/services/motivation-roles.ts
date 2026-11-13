import {
    motivationSettingsError,
    type MotivationSettings,
    type RuleKtu,
} from "@/lib/motivation-roles";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";

export class MotivationSettingsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MotivationSettingsError";
    }
}

interface RoleRow {
    id: string;
    title: string;
}

interface RuleRow {
    id: string;
    title: string;
    ktu: string;
    role_id: string | null;
}

interface AssignmentRow {
    employee_uuid: string;
    role_id: string | null;
}

function ruleKtu(value: string): RuleKtu {
    if (value === "plus" || value === "minus" || value === "any") {
        return value;
    }
    throw new MotivationSettingsError("В правилах записано неизвестное КТУ");
}

export async function readMotivationSettings(): Promise<MotivationSettings> {
    const [roles, rules] = await Promise.all([
        db.query<RoleRow>(`
            SELECT id, title
            FROM motivation_roles
            ORDER BY sort_order, id
        `),
        db.query<RuleRow>(`
            SELECT id, title, ktu, role_id
            FROM motivation_role_rules
            ORDER BY sort_order, id
        `),
    ]);
    return {
        roles: roles.map((role) => ({ id: role.id, title: role.title })),
        rules: rules.map((rule) => ({
            id: rule.id,
            title: rule.title,
            ktu: ruleKtu(rule.ktu),
            roleId: rule.role_id,
        })),
    };
}

export async function replaceMotivationSettings(input: MotivationSettings): Promise<MotivationSettings> {
    const error = motivationSettingsError(input);
    if (error) {
        throw new MotivationSettingsError(error);
    }
    const roleIds = input.roles.map((role) => role.id);
    try {
        await db.transaction(async (query) => {
            const blocked = await query<{ title: string }>(
                `
                SELECT role.title
                FROM motivation_roles role
                WHERE NOT (role.id = ANY($1::text[]))
                  AND EXISTS (
                      SELECT 1
                      FROM branch_motivation_roles assignment
                      WHERE assignment.role_id = role.id
                  )
                LIMIT 1
                `,
                [roleIds],
            );
            const used = blocked[0];
            if (used) {
                throw new MotivationSettingsError(`Роль «${used.title}» назначена сотрудникам`);
            }
            await query(`DELETE FROM motivation_role_rules`);
            for (const [index, role] of input.roles.entries()) {
                await query(
                    `
                    INSERT INTO motivation_roles (id, title, sort_order)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id) DO UPDATE
                        SET title = EXCLUDED.title,
                            sort_order = EXCLUDED.sort_order
                    `,
                    [role.id, role.title, index],
                );
            }
            await query(
                `DELETE FROM motivation_roles WHERE NOT (id = ANY($1::text[]))`,
                [roleIds],
            );
            for (const [index, rule] of input.rules.entries()) {
                await query(
                    `
                    INSERT INTO motivation_role_rules (id, title, ktu, role_id, sort_order)
                    VALUES ($1, $2, $3, $4, $5)
                    `,
                    [rule.id, rule.title, rule.ktu, rule.roleId, index],
                );
            }
        });
    } catch (error) {
        if (error instanceof MotivationSettingsError) {
            throw error;
        }
        if (isForeignKeyError(error)) {
            throw new MotivationSettingsError("Роль назначена сотрудникам");
        }
        throw error;
    }
    return readMotivationSettings();
}

const ROLE_PERIOD = /^\d{4}-\d{2}-01$/;

export async function readBranchRoleOverrides(branchId: string, period: string): Promise<Record<string, string | null>> {
    const rows = await readRoleSlice((text, params) => db.query(text, params), branchId, period, true);
    return Object.fromEntries(rows);
}

const EMPLOYEE_ID = /^[0-9a-zA-Z-]{8,80}$/;

export async function setBranchEmployeeRole(
    branchId: string,
    employeeId: string,
    period: string,
    roleId: string | null,
): Promise<void> {
    if (!EMPLOYEE_ID.test(employeeId)) {
        throw new MotivationSettingsError("Некорректный сотрудник");
    }
    const current = await readBranchRoleOverrides(branchId, period);
    current[employeeId.toLowerCase()] = roleId;
    await saveBranchRoleOverrides(branchId, period, current);
}

export async function clearBranchEmployeeRole(branchId: string, employeeId: string, period: string): Promise<void> {
    if (!EMPLOYEE_ID.test(employeeId)) {
        throw new MotivationSettingsError("Некорректный сотрудник");
    }
    const current = await readBranchRoleOverrides(branchId, period);
    delete current[employeeId.toLowerCase()];
    await saveBranchRoleOverrides(branchId, period, current);
}

export async function saveBranchRoleOverrides(
    branchId: string,
    period: string,
    overrides: Record<string, string | null>,
): Promise<void> {
    if (!ROLE_PERIOD.test(period)) {
        throw new MotivationSettingsError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!monthIsOpen(period.slice(0, 7), policy)) {
        throw new MotivationSettingsError(closedPeriodMessage(policy));
    }
    const desired = new Map<string, string | null>();
    for (const [employeeId, roleId] of Object.entries(overrides)) {
        if (!EMPLOYEE_ID.test(employeeId)) {
            throw new MotivationSettingsError("Некорректный сотрудник");
        }
        if (roleId !== null && typeof roleId !== "string") {
            throw new MotivationSettingsError("Выберите роль из списка");
        }
        desired.set(employeeId.toLowerCase(), roleId);
    }
    if (desired.size > 500) {
        throw new MotivationSettingsError("Слишком много назначений");
    }
    const roleIds = [...new Set([...desired.values()].flatMap((roleId) => (roleId ? [roleId] : [])))];
    if (roleIds.length > 0) {
        const found = await db.query<{ id: string }>(
            `SELECT id FROM motivation_roles WHERE id = ANY($1::text[])`,
            [roleIds],
        );
        if (found.length !== roleIds.length) {
            throw new MotivationSettingsError("Выберите роль из списка");
        }
    }
    const branch = branchId.toLowerCase();
    await db.transaction(async (query) => {
        const inherited = await readRoleSlice(query, branch, period, false);
        const stored = await query<{ employee: string }>(
            `
            SELECT employee_uuid AS employee
            FROM branch_motivation_roles
            WHERE branch_uuid = $1::uuid
              AND period = $2::date
            `,
            [branch, period],
        );
        const employees = new Set<string>([...inherited.keys(), ...desired.keys(), ...stored.map((row) => row.employee)]);
        const remove: string[] = [];
        const keepEmployees: string[] = [];
        const keepRoles: (string | null)[] = [];
        const keepAutomatic: boolean[] = [];
        for (const employee of employees) {
            const wantAutomatic = !desired.has(employee);
            const wantRole = wantAutomatic ? null : desired.get(employee) ?? null;
            const hadAutomatic = !inherited.has(employee);
            const hadRole = hadAutomatic ? null : inherited.get(employee) ?? null;
            if (wantAutomatic === hadAutomatic && wantRole === hadRole) {
                remove.push(employee);
                continue;
            }
            keepEmployees.push(employee);
            keepRoles.push(wantRole);
            keepAutomatic.push(wantAutomatic);
        }
        if (remove.length > 0) {
            await query(
                `
                DELETE FROM branch_motivation_roles
                WHERE branch_uuid = $1::uuid
                  AND period = $2::date
                  AND employee_uuid = ANY($3::uuid[])
                `,
                [branch, period, remove],
            );
        }
        if (keepEmployees.length === 0) {
            return;
        }
        await query(
            `
            INSERT INTO branch_motivation_roles (branch_uuid, employee_uuid, period, role_id, automatic)
            SELECT $1::uuid, employee_id::uuid, $2::date, role_id, automatic
            FROM unnest($3::text[], $4::text[], $5::boolean[]) AS assignment(employee_id, role_id, automatic)
            ON CONFLICT (branch_uuid, employee_uuid, period)
            DO UPDATE SET role_id = EXCLUDED.role_id,
                          automatic = EXCLUDED.automatic
            `,
            [branch, period, keepEmployees, keepRoles, keepAutomatic],
        );
    });
}

async function readRoleSlice(
    query: (text: string, params?: unknown[]) => Promise<AssignmentRow[]>,
    branchId: string,
    period: string,
    includePeriod: boolean,
): Promise<Map<string, string | null>> {
    const rows = await query(
        `
        SELECT employee_uuid, role_id
        FROM (
            SELECT DISTINCT ON (employee_uuid)
                   employee_uuid,
                   role_id,
                   automatic
            FROM branch_motivation_roles
            WHERE branch_uuid = $1::uuid
              AND period ${includePeriod ? "<=" : "<"} $2::date
            ORDER BY employee_uuid, period DESC
        ) latest
        WHERE NOT automatic
        `,
        [branchId, period],
    );
    const overrides = new Map<string, string | null>();
    for (const row of rows) {
        overrides.set(row.employee_uuid, row.role_id);
    }
    return overrides;
}

function isForeignKeyError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
