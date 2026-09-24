// src/services/ldap.ts
import { Client } from "ldapts";
import { User } from "next-auth";

export async function authenticateLDAPUser(username: string, password: string): Promise<User | null> {
    const client = new Client({ url: process.env.LDAP_URL! });

    try {
        // 1. Подключение сервисной учеткой и поиск в Active Directory
        await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);

        const { searchEntries } = await client.search(process.env.LDAP_BASE_DN!, {
            scope: "sub",
            filter: `(sAMAccountName=${username})`,
            attributes: ["dn", "displayName", "mail", "sAMAccountName", "title", "department"],
        });

        if (!searchEntries.length) return null;

        const ldapUser = searchEntries[0];
        const userDn = ldapUser.dn as string;

        // 2. Валидация доменного пароля пользователя
        await client.bind(userDn, password);

        const accountName = ldapUser.sAMAccountName as string;
        const ldapPosition = (ldapUser.title as string) || "";

        // 3. Запрос роли и матрицы путей из PostgreSQL
        const { db } = await import("@/services/db");
        const authData = await db.getUserPermissions(accountName, ldapPosition);

        // ШАГ 3: ПОДСТРАХОВКА ДЛЯ РОЛИ GUEST ПО УМОЛЧАНИЮ
        let finalRole = authData?.role;
        let userPermissions = authData?.permissions || [];

        if (!finalRole) {
            console.log(`[ИБ Уведомление]: Должность "${ldapPosition}" у пользователя ${accountName} отсутствует в СУБД. Присвоена роль по умолчанию: GUEST`);

            finalRole = "GUEST";

            // Запрашиваем из базы данных разрешения, которые привязаны к роли GUEST
            const guestPerms = await db.query(`
        SELECT p.route_path as path, p.method 
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = 'GUEST'
      `);

            userPermissions = guestPerms.map(p => ({ path: p.path, method: p.method }));
        }

        // Подстраховка для ADMIN (если матрица пуста — даем сквозной wildcard)
        if (finalRole === 'ADMIN' && userPermissions.length === 0) {
            userPermissions = [{ path: '*', method: 'ALL' }];
        }

        return {
            id: userDn,
            username: accountName,
            displayName: ldapUser.displayName as string,
            email: ldapUser.mail as string | undefined,
            role: finalRole,
            permissions: userPermissions,
            department: (ldapUser.department as string) || "—",
        };
    } catch (error) {
        console.error("Ошибка в службе LDAP/ИБ:", error);
        return null;
    } finally {
        await client.unbind();
    }
}
