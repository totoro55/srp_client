import { Client, InvalidCredentialsError } from "ldapts";
import { parseLdapObjectGuid } from "@/lib/ldap-guid";
import type { LoginFailureReason } from "@/lib/login-journal";
import { escapeLdapFilterValue } from "@/lib/ldap-filter";

const MAX_SAM_ACCOUNT_NAME_LENGTH = 64;

export interface DirectoryUser {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    title: string;
    department: string;
    objectGuid: string | null;
}

export type DirectoryAuthResult =
    | { ok: true; user: DirectoryUser }
    | { ok: false; reason: LoginFailureReason };

export async function authenticateLDAPUser(username: string, password: string): Promise<DirectoryAuthResult> {
    const normalizedUsername = username.trim();

    if (!normalizedUsername || normalizedUsername.length > MAX_SAM_ACCOUNT_NAME_LENGTH || !password) {
        return { ok: false, reason: "invalid_credentials" };
    }

    const client = new Client({ url: process.env.LDAP_URL! });

    try {
        try {
            await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);
        } catch (error) {
            console.error("Ошибка в службе LDAP/ИБ:", error);
            return { ok: false, reason: "unavailable" };
        }

        let searchEntries;
        try {
            const search = await client.search(process.env.LDAP_BASE_DN!, {
                scope: "sub",
                filter: `(sAMAccountName=${escapeLdapFilterValue(normalizedUsername)})`,
                attributes: ["dn", "displayName", "mail", "sAMAccountName", "title", "department", "objectGUID"],
            });
            searchEntries = search.searchEntries;
        } catch (error) {
            console.error("Ошибка в службе LDAP/ИБ:", error);
            return { ok: false, reason: "unavailable" };
        }

        if (!searchEntries.length) {
            return { ok: false, reason: "not_found" };
        }

        const ldapUser = searchEntries[0];
        const userDn = ldapText(ldapUser.dn);
        if (!userDn) {
            return { ok: false, reason: "not_found" };
        }

        try {
            await client.bind(userDn, password);
        } catch (error) {
            if (error instanceof InvalidCredentialsError) {
                return { ok: false, reason: "invalid_credentials" };
            }
            console.error("Ошибка в службе LDAP/ИБ:", error);
            return { ok: false, reason: "unavailable" };
        }

        const accountName = ldapText(ldapUser.sAMAccountName) || normalizedUsername;
        const title = ldapText(ldapUser.title);
        const department = ldapText(ldapUser.department);
        const email = ldapText(ldapUser.mail);

        return {
            ok: true,
            user: {
                id: userDn,
                username: accountName,
                displayName: ldapText(ldapUser.displayName) || accountName,
                email: email || null,
                title,
                department,
                objectGuid: parseLdapObjectGuid(ldapUser.objectGUID),
            },
        };
    } finally {
        await client.unbind().catch(() => undefined);
    }
}

function ldapText(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return ldapText(value[0]);
    }
    if (Buffer.isBuffer(value)) {
        return value.toString("utf8");
    }
    return "";
}
