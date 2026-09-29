import {
    PERMISSION_CODES,
    ROUTE_POLICIES,
    type PermissionCode,
    type RoutePolicy,
} from "@/lib/permissions";

function globToRegExp(pattern: string): RegExp {
    const regexPattern = pattern
        .replace(/([.+?^${}()|[\]\\])/g, "\\$1")
        .replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`, "i");
}

export function pathMatches(pattern: string, pathname: string): boolean {
    const [cleanPath] = pathname.split("?");
    return globToRegExp(pattern).test(cleanPath);
}

function policyScore(policy: RoutePolicy): number {
    const methodBonus = policy.method === "ALL" ? 0 : 1000;
    return policy.pattern.replace(/\*/g, "").length + methodBonus;
}

export function matchRoutePolicy(pathname: string, method: string): RoutePolicy | null {
    const upperMethod = method.toUpperCase();
    let best: RoutePolicy | null = null;
    let bestScore = -1;

    for (const policy of ROUTE_POLICIES) {
        if (policy.method !== "ALL" && policy.method !== upperMethod) {
            continue;
        }
        if (!pathMatches(policy.pattern, pathname)) {
            continue;
        }
        const score = policyScore(policy);
        if (score > bestScore) {
            best = policy;
            bestScore = score;
        }
    }

    return best;
}

export function hasPermissionCode(
    codes: readonly string[],
    required: PermissionCode
): boolean {
    return codes.includes(required);
}

export function catalogCodes(): PermissionCode[] {
    return [...PERMISSION_CODES];
}
