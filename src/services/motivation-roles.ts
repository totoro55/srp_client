import {
    motivationSettingsError,
    type MotivationSettings,
    type RuleKtu,
} from "@/lib/motivation-roles";
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

export async function readBranchRoleOverrides(branchId: string): Promise<Record<string, string | null>> {
    const rows = await db.query<AssignmentRow>(
        `
        SELECT employee_uuid, role_id
        FROM branch_motivation_roles
        WHERE lower(branch_uuid) = lower($1)
        ORDER BY employee_uuid
        `,
        [branchId],
    );
    const overrides: Record<string, string | null> = {};
    for (const row of rows) {
        overrides[row.employee_uuid] = row.role_id;
    }
    return overrides;
}

const EMPLOYEE_ID = /^[0-9a-zA-Z-]{8,80}$/;


export async function setBranchEmployeeRole(
    branchId: string,
    employeeId: string,
    roleId: string | null,
): Promise<void> {
    if (!EMPLOYEE_ID.test(employeeId)) {
        throw new MotivationSettingsError("Некорректный сотрудник");
    }
    if (roleId !== null) {
        const found = await db.query<{ id: string }>(
            `SELECT id FROM motivation_roles WHERE id = $1`,
            [roleId],
        );
        if (found.length === 0) {
            throw new MotivationSettingsError("Выберите роль из списка");
        }
    }
    const branch = branchId.toLowerCase();
    const employee = employeeId.toLowerCase();
    await db.query(
        `
        INSERT INTO branch_motivation_roles (branch_uuid, employee_uuid, role_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (branch_uuid, employee_uuid)
        DO UPDATE SET role_id = EXCLUDED.role_id
        `,
        [branch, employee, roleId],
    );
}

export async function clearBranchEmployeeRole(branchId: string, employeeId: string): Promise<void> {
    if (!EMPLOYEE_ID.test(employeeId)) {
        throw new MotivationSettingsError("Некорректный сотрудник");
    }
    await db.query(
        `
        DELETE FROM branch_motivation_roles
        WHERE lower(branch_uuid) = lower($1)
          AND lower(employee_uuid) = lower($2)
        `,
        [branchId, employeeId],
    );
}

export async function saveBranchRoleOverrides(
    branchId: string,
    overrides: Record<string, string | null>,
): Promise<void> {
    const entries = Object.entries(overrides);
    if (entries.length > 500) {
        throw new MotivationSettingsError("Слишком много назначений");
    }
    for (const [employeeId, roleId] of entries) {
        if (!EMPLOYEE_ID.test(employeeId)) {
            throw new MotivationSettingsError("Некорректный сотрудник");
        }
        if (roleId !== null && typeof roleId !== "string") {
            throw new MotivationSettingsError("Выберите роль из списка");
        }
    }
    const roleIds = [...new Set(entries.flatMap(([, roleId]) => (roleId ? [roleId] : [])))];
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
        await query(
            `DELETE FROM branch_motivation_roles WHERE lower(branch_uuid) = lower($1)`,
            [branch],
        );
        if (entries.length === 0) {
            return;
        }
        await query(
            `
            INSERT INTO branch_motivation_roles (branch_uuid, employee_uuid, role_id)
            SELECT $1, employee_id, role_id
            FROM unnest($2::text[], $3::text[]) AS assignment(employee_id, role_id)
            `,
            [branch, entries.map(([employeeId]) => employeeId), entries.map(([, roleId]) => roleId)],
        );
    });
}

function isForeignKeyError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
