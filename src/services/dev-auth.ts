import { createHash, timingSafeEqual } from "crypto";
import type { User } from "next-auth";

const DEFAULT_DEV_USERNAME = "admin";

export function isDevAuthBypassEnabled(): boolean {
    return process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "true";
}

export function devLoginHint(): string | null {
    if (!isDevAuthBypassEnabled()) {
        return null;
    }

    const username = process.env.AUTH_DEV_USERNAME?.trim() || DEFAULT_DEV_USERNAME;
    return username || null;
}

export function isDevLoginName(username: string): boolean {
    const expected = devLoginHint();
    if (!expected) {
        return false;
    }

    return username.trim().toLowerCase() === expected.toLowerCase();
}

export async function authenticateDevUser(username: string, password: string): Promise<User | null> {
    if (!isDevLoginName(username)) {
        return null;
    }

    const expectedPassword = process.env.AUTH_DEV_PASSWORD;
    if (!expectedPassword || !passwordsMatch(password, expectedPassword)) {
        return null;
    }

    try {
        const { db } = await import("@/services/db");
        const admin = await db.getRoleByName("ADMIN");
        if (!admin) {
            console.error("Локальный вход: в базе нет роли ADMIN");
            return null;
        }

        const accountName = devLoginHint() ?? DEFAULT_DEV_USERNAME;
        console.info(`Локальный вход ${accountName}: LDAP пропущен`);

        return {
            id: `dev:${accountName}`,
            username: accountName,
            displayName: "Администратор (разработка)",
            role: admin.name,
            roleId: admin.id,
            isSuperuser: true,
            department: "Разработка",
        };
    } catch (error) {
        console.error("Локальный вход не смог прочитать роль ADMIN:", error);
        return null;
    }
}

function passwordsMatch(input: string, expected: string): boolean {
    const left = createHash("sha256").update(input).digest();
    const right = createHash("sha256").update(expected).digest();
    return timingSafeEqual(left, right);
}
