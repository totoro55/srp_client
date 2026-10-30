import { isDevLoginName } from "@/services/dev-auth";
import { db } from "@/services/db";
import type { LoginAccessSource } from "@/lib/login-journal";
import type { ScopeKind } from "@/lib/permissions";

export interface MatchedRole {
    id: number;
    code: string;
    name: string;
    scope_kind: ScopeKind;
    is_system: boolean;
}

export interface AccessDecision {
    source: LoginAccessSource;
    role: MatchedRole | null;
}

interface RuleRow extends MatchedRole {
    priority: number;
    match_type: "login" | "title";
}

/**
 * Тот же порядок, что у проверки доступа на запросе:
 * исключение на логин старше должности, затем роль по справочнику сотрудников.
 */
export async function decideAccess(username: string, title: string): Promise<AccessDecision> {
    if (isDevLoginName(username)) {
        const admin = await loadRoleByCode("admin");
        return { source: "dev", role: admin };
    }

    const rules = await db.query<RuleRow>(
        `
        SELECT rr.priority, rr.match_type, r.id, r.code, r.name, r.scope_kind, r.is_system
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
            return { source: "conflict", role: null };
        }

        const source: LoginAccessSource = top.some((rule) => rule.match_type === "login")
            ? "login_rule"
            : "title_rule";
        return { source, role: top[0] };
    }

    const employees = await db.query<{ uuid: string }>(
        "SELECT uuid FROM employees WHERE lower(login) = lower($1) AND NOT deleted LIMIT 1",
        [username]
    );
    if (employees.length > 0) {
        const linear = await loadRoleByCode("linear");
        if (linear) {
            return { source: "linear", role: linear };
        }
    }

    return { source: "none", role: null };
}

async function loadRoleByCode(code: string): Promise<MatchedRole | null> {
    const rows = await db.query<MatchedRole>(
        "SELECT id, code, name, scope_kind, is_system FROM roles WHERE code = $1",
        [code]
    );
    return rows[0] ?? null;
}
