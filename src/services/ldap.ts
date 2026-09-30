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

        return {
            id: userDn,
            username: accountName,
            displayName: (ldapUser.displayName as string) || accountName,
            email: ldapUser.mail as string | undefined,
            title: ldapPosition,
            department: (ldapUser.department as string) || "—",
        };
    } catch (error) {
        console.error("Ошибка в службе LDAP/ИБ:", error);
        return null;
    } finally {
        await client.unbind();
    }
}
