// src/services/impersonation.ts
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { UserPermission } from "@/types/next-auth";

interface ImpersonationResult {
    activeRole: string;
    activePermissions: UserPermission[];
    isImpersonating: boolean;
}

/**
 * Сервис проверки и применения режима имперсонации (тестирования ролей)
 * @param originalRole Изначальная роль пользователя из JWT токена
 * @param originalPermissions Изначальный массив прав из JWT токена
 * @param cookies Экземпляр кук текущего HTTP запроса
 */
export async function getActiveSessionContext(
    originalRole: string | undefined,
    originalPermissions: UserPermission[],
    cookies: RequestCookies
): Promise<ImpersonationResult> {

    // Базовый контекст по умолчанию (совпадает с оригинальным токеном)
    const result: ImpersonationResult = {
        activeRole: originalRole || "",
        activePermissions: originalPermissions,
        isImpersonating: false
    };

    // Считываем куки подмены роли, установленные через UI шапки
    const impersonatedRole = cookies.get("impersonated_role")?.value;
    const impersonatedRoleId = cookies.get("impersonated_role_id")?.value;

    // ИБ-ЗАЩИТА: Маску роли разрешено применять СТРОГО только если оригинальный пользователь — ADMIN
    if (originalRole === 'ADMIN' && impersonatedRole) {
        result.activeRole = impersonatedRole;
        result.isImpersonating = true;

        // Если админ тестирует роль, отличную от ADMIN (например, GUEST),
        // нам нужно вытащить из базы данных её реальные ограничения
        if (impersonatedRoleId && impersonatedRole !== 'ADMIN') {
            try {
                const { db } = await import("@/services/db");

                const rolePerms = await db.query<{ path: string; method: string }>(`
          SELECT p.route_path as path, p.method 
          FROM role_permissions rp
          JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = $1
        `, [parseInt(impersonatedRoleId, 10)]);

                result.activePermissions = rolePerms.map(p => ({
                    path: p.path,
                    method: p.method
                }));
            } catch (error) {
                console.error("Ошибка при динамическом сборе прав для тестируемой роли:", error);
                // В случае сбоя сбрасываем права в безопасный пустой массив
                result.activePermissions = [];
            }
        }
    }

    return result;
}
