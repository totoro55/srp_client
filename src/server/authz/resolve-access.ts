import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getAppSettings } from "@/services/app-settings";
import { isDevLoginName } from "@/services/dev-auth";
import { IMPERSONATION_COOKIE_ROLE_ID } from "@/services/impersonation";
import { db } from "@/services/db";
import {
    isWritePermission,
    PERMISSION_CODES,
    SCOPE_KIND_LABELS,
    type PermissionCode,
    type ScopeKind,
} from "@/lib/permissions";

export interface AccessRole {
    id: number;
    code: string;
    name: string;
    scopeKind: ScopeKind;
    isSystem: boolean;
}

export interface AccessView {
    username: string;
    title: string;
    role: AccessRole | null;
    scopeLabel: string;
    fullAccess: boolean;
    actorFullAccess: boolean;
    permissions: PermissionCode[];
    previewRoleName: string | null;
    conflict: boolean;
    previewChoices: { id: number; name: string }[];
}

interface RoleRecord {
    id: number;
    code: string;
    name: string;
    scope_kind: ScopeKind;
    is_system: boolean;
}

const EMPTY_ACCESS = (username: string, title: string): AccessView => ({
    username,
    title,
    role: null,
    scopeLabel: "Роль не назначена",
    fullAccess: false,
    actorFullAccess: false,
    permissions: [],
    previewRoleName: null,
    conflict: false,
    previewChoices: [],
});

export async function getRequestAccess(): Promise<AccessView | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
        return null;
    }

    const settings = await getAppSettings();
    const jar = await cookies();
    const previewRaw = jar.get(IMPERSONATION_COOKIE_ROLE_ID)?.value;
    const previewRoleId = Number.parseInt(previewRaw ?? "", 10);
    const access = await resolveAccess(
        session.user.username,
        session.user.title ?? "",
        settings.rolePreviewEnabled && Number.isInteger(previewRoleId) && previewRoleId > 0 ? previewRoleId : null
    );

    if (!settings.rolePreviewEnabled) {
        return { ...access, previewChoices: [] };
    }

    return access;
}

export async function resolveAccess(
    username: string,
    title: string,
    previewRoleId: number | null
): Promise<AccessView> {
    const actor = await resolveActor(username, title);

    if (!actor.actorFullAccess || !previewRoleId) {
        return actor;
    }

    const preview = await loadRoleById(previewRoleId);
    if (!preview || preview.is_system) {
        return actor;
    }

    const permissions = (await loadPermissionCodes(preview.id)).filter((code) => !isWritePermission(code));

    return {
        username,
        title,
        role: toAccessRole(preview),
        scopeLabel: SCOPE_KIND_LABELS[preview.scope_kind],
        fullAccess: false,
        actorFullAccess: true,
        permissions,
        previewRoleName: preview.name,
        conflict: false,
        previewChoices: actor.previewChoices,
    };
}

async function resolveActor(username: string, title: string): Promise<AccessView> {
    if (isDevLoginName(username)) {
        const admin = await loadRoleByCode("admin");
        if (!admin) {
            return EMPTY_ACCESS(username, title);
        }
        return finishActor(username, title, admin, false);
    }

    const rules = await db.query<{ priority: number } & RoleRecord>(
        `
        SELECT rr.priority, r.id, r.code, r.name, r.scope_kind, r.is_system
        FROM role_rules rr
        JOIN roles r ON r.id = rr.role_id
        WHERE (rr.expires_at IS NULL OR rr.expires_at > NOW())
          AND (
            (rr.match_type = 'login' AND lower(rr.match_value) = lower($1))
            OR (rr.match_type = 'title' AND rr.match_value = $2 AND $2 <> '')
          )
        `,
        [username, title]
    );

    if (rules.length > 0) {
        const topPriority = Math.max(...rules.map((rule) => rule.priority));
        const top = rules.filter((rule) => rule.priority === topPriority);
        const roleIds = new Set(top.map((rule) => rule.id));
        if (roleIds.size > 1) {
            return {
                ...EMPTY_ACCESS(username, title),
                scopeLabel: "Настройки доступа противоречат друг другу",
                conflict: true,
            };
        }
        return finishActor(username, title, top[0], false);
    }

    const employees = await db.query<{ uuid: string }>(
        "SELECT uuid FROM employees WHERE lower(login) = lower($1) LIMIT 1",
        [username]
    );
    if (employees.length > 0) {
        const linear = await loadRoleByCode("linear");
        if (linear) {
            return finishActor(username, title, linear, false);
        }
    }

    return EMPTY_ACCESS(username, title);
}

async function finishActor(
    username: string,
    title: string,
    role: RoleRecord,
    conflict: boolean
): Promise<AccessView> {
    const permissions = role.is_system ? [...PERMISSION_CODES] : await loadPermissionCodes(role.id);
    const scopeLabel = await scopeLabelFor(username, role.scope_kind);
    const previewChoices = role.is_system ? await loadPreviewChoices() : [];

    return {
        username,
        title,
        role: toAccessRole(role),
        scopeLabel,
        fullAccess: role.is_system,
        actorFullAccess: role.is_system,
        permissions,
        previewRoleName: null,
        conflict,
        previewChoices,
    };
}

async function scopeLabelFor(username: string, scopeKind: ScopeKind): Promise<string> {
    if (scopeKind === "division") {
        return SCOPE_KIND_LABELS.division;
    }

    if (scopeKind === "none") {
        return SCOPE_KIND_LABELS.none;
    }

    if (scopeKind === "home_branch") {
        const rows = await db.query<{ branch: string | null }>(
            "SELECT branch FROM employees WHERE lower(login) = lower($1) LIMIT 1",
            [username]
        );
        return rows[0]?.branch || "Филиал не назначен";
    }

    const grants = await db.query<{ name: string }>(
        `
        SELECT t.name
        FROM scope_grants g
        JOIN territories t ON t.uuid = g.territory_uuid
        WHERE lower(g.username) = lower($1)
        ORDER BY t.name
        `,
        [username]
    );

    if (grants.length === 0) {
        return "Территории не назначены";
    }

    return grants.map((grant) => grant.name).join(", ");
}

async function loadPermissionCodes(roleId: number): Promise<PermissionCode[]> {
    const rows = await db.query<{ permission_code: string }>(
        "SELECT permission_code FROM role_permission_codes WHERE role_id = $1",
        [roleId]
    );
    return rows
        .map((row) => row.permission_code)
        .filter((code): code is PermissionCode => (PERMISSION_CODES as string[]).includes(code));
}

async function loadRoleByCode(code: string): Promise<RoleRecord | null> {
    const rows = await db.query<RoleRecord>(
        "SELECT id, code, name, scope_kind, is_system FROM roles WHERE code = $1",
        [code]
    );
    return rows[0] ?? null;
}

async function loadRoleById(id: number): Promise<RoleRecord | null> {
    const rows = await db.query<RoleRecord>(
        "SELECT id, code, name, scope_kind, is_system FROM roles WHERE id = $1",
        [id]
    );
    return rows[0] ?? null;
}

async function loadPreviewChoices(): Promise<{ id: number; name: string }[]> {
    return db.query<{ id: number; name: string }>(
        "SELECT id, name FROM roles WHERE is_system = false ORDER BY name"
    );
}

function toAccessRole(role: RoleRecord): AccessRole {
    return {
        id: role.id,
        code: role.code,
        name: role.name,
        scopeKind: role.scope_kind,
        isSystem: role.is_system,
    };
}

export async function audit(actor: string, action: string, details: string): Promise<void> {
    await db.query(
        "INSERT INTO audit_events (actor_username, action, details) VALUES ($1, $2, $3)",
        [actor, action, details]
    );
}
