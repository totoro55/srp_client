import { Client } from "ldapts";
import { User } from "next-auth";
import { escapeLdapFilterValue } from "@/lib/ldap-filter";

const MAX_SAM_ACCOUNT_NAME_LENGTH = 64;

export async function authenticateLDAPUser(username: string, password: string): Promise<User | null> {
    const normalizedUsername = username.trim();

    if (!normalizedUsername || normalizedUsername.length > MAX_SAM_ACCOUNT_NAME_LENGTH) {
        return null;
    }

    if (!password) {
        return null;
    }

    const client = new Client({ url: process.env.LDAP_URL! });

    try {
        await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);

        const { searchEntries } = await client.search(process.env.LDAP_BASE_DN!, {
            scope: "sub",
            filter: `(sAMAccountName=${escapeLdapFilterValue(normalizedUsername)})`,
            attributes: ["dn", "displayName", "mail", "sAMAccountName", "title", "department"],
        });

        if (!searchEntries.length) return null;

        const ldapUser = searchEntries[0];
        const userDn = ldapUser.dn as string;

        await client.bind(userDn, password);

        const accountName = ldapUser.sAMAccountName as string;
        const ldapPosition = (ldapUser.title as string) || "";

        const { db } = await import("@/services/db");
        const authData = await db.getUserAuthContext(accountName, ldapPosition);

        let role = authData?.role;
        let roleId = authData?.role_id;
        let isSuperuser = authData?.is_superuser ?? false;

        if (!role || !roleId) {
            console.log(
                `[ИБ Уведомление]: Должность "${ldapPosition}" у пользователя ${accountName} отсутствует в СУБД. Присвоена роль по умолчанию: GUEST`
            );
            const guest = await db.getRoleByName("GUEST");
            if (!guest) {
                return null;
            }
            role = guest.name;
            roleId = guest.id;
            isSuperuser = guest.is_superuser;
        }

        return {
            id: userDn,
            username: accountName,
            displayName: ldapUser.displayName as string,
            email: ldapUser.mail as string | undefined,
            role,
            roleId,
            isSuperuser,
            department: (ldapUser.department as string) || "—",
        };
    } catch (error) {
        console.error("Ошибка в службе LDAP/ИБ:", error);
        return null;
    } finally {
        await client.unbind();
    }
}
