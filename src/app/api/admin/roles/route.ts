import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";

type AdminEntityType = "ROLE" | "MAPPING" | "EXCEPTION";

interface RolesMutationBody {
    type?: AdminEntityType;
    id?: number;
    name?: string;
    description?: string | null;
    ldapPosition?: string;
    roleId?: number;
    username?: string;
    reason?: string | null;
    expiresAt?: string | null;
}

const TABLE_BY_TYPE: Record<AdminEntityType, string> = {
    ROLE: "roles",
    MAPPING: "ldap_position_mappings",
    EXCEPTION: "user_role_exceptions",
};

export async function GET() {
    try {
        await requireAdmin();
        const roles = await db.query("SELECT id, name, description FROM roles ORDER BY id ASC");
        const mappings = await db.query(`
            SELECT m.id, m.ldap_position AS "ldapPosition", m.role_id AS "roleId", r.name AS "roleName"
            FROM ldap_position_mappings m JOIN roles r ON m.role_id = r.id ORDER BY m.id DESC
        `);
        const exceptions = await db.query(`
            SELECT e.id, e.username, e.role_id AS "roleId", r.name AS "roleName",
                   e.reason, e.granted_by AS "grantedBy", e.expires_at AS "expiresAt"
            FROM user_role_exceptions e JOIN roles r ON e.role_id = r.id ORDER BY e.id DESC
        `);
        return NextResponse.json({ success: true, data: { roles, mappings, exceptions } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка БД", 500);
    }
}

export async function POST(req: Request) {
    try {
        const admin = await requireAdmin();
        const payload = (await req.json()) as RolesMutationBody;

        if (payload.type === "ROLE") {
            await db.query(
                "INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description",
                [payload.name, payload.description]
            );
        } else if (payload.type === "MAPPING") {
            await db.query(
                "INSERT INTO ldap_position_mappings (ldap_position, role_id) VALUES ($1, $2) ON CONFLICT (ldap_position) DO UPDATE SET role_id = EXCLUDED.role_id",
                [payload.ldapPosition, payload.roleId]
            );
        } else if (payload.type === "EXCEPTION") {
            await db.query(
                "INSERT INTO user_role_exceptions (username, role_id, reason, granted_by, expires_at) VALUES ($1, $2, $3, $4, $5)",
                [payload.username, payload.roleId, payload.reason, admin.username, payload.expiresAt]
            );
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка сохранения", 500);
    }
}

export async function PUT(req: Request) {
    try {
        const admin = await requireAdmin();
        const payload = (await req.json()) as RolesMutationBody;

        if (payload.type === "ROLE") {
            await db.query("UPDATE roles SET name = $1, description = $2 WHERE id = $3", [
                payload.name,
                payload.description,
                payload.id,
            ]);
        } else if (payload.type === "MAPPING") {
            await db.query(
                "UPDATE ldap_position_mappings SET ldap_position = $1, role_id = $2 WHERE id = $3",
                [payload.ldapPosition, payload.roleId, payload.id]
            );
        } else if (payload.type === "EXCEPTION") {
            await db.query(
                "UPDATE user_role_exceptions SET role_id = $1, reason = $2, granted_by = $3, expires_at = $4 WHERE id = $5",
                [payload.roleId, payload.reason, admin.username, payload.expiresAt, payload.id]
            );
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка обновления", 500);
    }
}

export async function DELETE(req: Request) {
    try {
        await requireAdmin();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const type = searchParams.get("type");

        if (id && (type === "ROLE" || type === "MAPPING" || type === "EXCEPTION")) {
            await db.query(`DELETE FROM ${TABLE_BY_TYPE[type]} WHERE id = $1`, [parseInt(id, 10)]);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка удаления", 500);
    }
}
