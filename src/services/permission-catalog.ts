import { PERMISSION_CATALOG } from "@/lib/permissions";
import { matchRoutePolicy } from "@/lib/access";
import { db } from "@/services/db";
import { invalidateRolePermissionCache } from "@/services/permission-cache";

export async function syncPermissionCatalog(): Promise<void> {
    for (const item of PERMISSION_CATALOG) {
        await db.query(
            `
            INSERT INTO permissions (route_path, method, description, code)
            VALUES ($1, 'ALL', $2, $3)
            ON CONFLICT (route_path, method)
            DO UPDATE SET description = EXCLUDED.description, code = EXCLUDED.code
            `,
            [item.code, item.description, item.code]
        );
    }

    await migrateLegacyRouteBindings();
    await ensureGuestHomeAccess();
    invalidateRolePermissionCache();
}

async function migrateLegacyRouteBindings(): Promise<void> {
    const legacyRows = await db.query<{
        id: number;
        route_path: string;
        method: string;
        code: string | null;
    }>(
        `
        SELECT id, route_path, method, code
        FROM permissions
        WHERE code LIKE 'legacy:%'
        `
    );

    if (legacyRows.length === 0) {
        return;
    }

    const catalogRows = await db.query<{ id: number; code: string }>(
        `SELECT id, code FROM permissions WHERE code = ANY($1::text[])`,
        [PERMISSION_CATALOG.map((item) => item.code)]
    );
    const catalogIdByCode = new Map(catalogRows.map((row) => [row.code, row.id]));

    for (const legacy of legacyRows) {
        const policy = matchRoutePolicy(legacy.route_path, legacy.method === "ALL" ? "GET" : legacy.method);
        if (!policy || policy.access.kind !== "permission") {
            continue;
        }

        const catalogId = catalogIdByCode.get(policy.access.permission);
        if (!catalogId) {
            continue;
        }

        await db.query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT role_id, $2
            FROM role_permissions
            WHERE permission_id = $1
            ON CONFLICT DO NOTHING
            `,
            [legacy.id, catalogId]
        );
    }

    await db.query(
        `
        DELETE FROM permissions
        WHERE code LIKE 'legacy:%'
          AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp WHERE rp.permission_id = permissions.id
          )
        `
    );
}

async function ensureGuestHomeAccess(): Promise<void> {
    await db.query(
        `
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.code = 'app.home:read'
        WHERE r.name = 'GUEST'
        ON CONFLICT DO NOTHING
        `
    );
}
