import { Client } from "ldapts";
import getRole from "@/lib/getRole";

export interface LDAPUser {
    id: string;
    username: string;
    displayName: string;
    email?: string;
    role: string;
    department: string;
}

const LDAP_URL = process.env.LDAP_URL!;
const LDAP_BASE_DN = process.env.LDAP_BASE_DN!;
const LDAP_BIND_DN = process.env.LDAP_BIND_DN!;
const LDAP_BIND_PASSWORD = process.env.LDAP_BIND_PASSWORD!;

export async function authenticateLDAP(
    username: string,
    password: string
): Promise<LDAPUser | null> {
    const client = new Client({
        url: LDAP_URL,
    });

    try {
        // Подключаемся сервисной учеткой
        await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

        const { searchEntries } = await client.search(LDAP_BASE_DN, {
            scope: "sub",
            filter: `(sAMAccountName=${username})`,
        attributes: [
            "dn",
            "displayName",
            "mail",
            "sAMAccountName",
            "title",
            "department",
            "company"
        ],
    });

        if (!searchEntries.length) {
            return null;
        }

        const user = searchEntries[0];

        const userDn = user.dn as string;

        // Проверяем пароль пользователя
        await client.bind(userDn, password);

        //проверяем есть ли роль у должности
        const role = getRole(user.title as string);

        if (!role) {
            return null;
        }


        return {
            id: userDn,
            username: user.sAMAccountName as string,
            displayName: user.displayName as string,
            email: user.mail as string | undefined,
            role: role,
            department: user.department as string,
        };
    } catch {
        return null;
    } finally {
        await client.unbind();
    }
}