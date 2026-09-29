'use client';

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { useImpersonationMask } from "@/hooks/useImpersonationMask";
import { isAdminRole } from "@/lib/roles";
import { UserPermission } from "@/types/next-auth";

function permissionMatches(
    perm: UserPermission,
    requiredPath: string,
    requiredMethod: string
): boolean {
    const methodMatches =
        perm.method === "ALL" || perm.method.toUpperCase() === requiredMethod.toUpperCase();
    if (!methodMatches) return false;

    const [cleanPath] = requiredPath.split("?");
    const regexPattern = perm.path
        .replace(/([.+?^${}()|[\]\\])/g, "\\$1")
        .replace(/\*/g, ".*");

    return new RegExp(`^${regexPattern}$`, "i").test(cleanPath);
}

export function useHasAccess(requiredPath: string, requiredMethod: string = "GET"): boolean {
    const { data: session } = useSession();
    const { impersonatedRole, permissions: maskPermissions } = useImpersonationMask();

    return useMemo(() => {
        const originalRole = session?.user?.role;
        if (!originalRole) return false;

        const isMasked = isAdminRole(originalRole) && Boolean(impersonatedRole);
        const activeRole = isMasked ? impersonatedRole : originalRole;

        if (isAdminRole(activeRole)) return true;

        const userPermissions: UserPermission[] = isMasked
            ? maskPermissions
            : session?.user?.permissions ?? [];

        return userPermissions.some((perm) => permissionMatches(perm, requiredPath, requiredMethod));
    }, [
        session?.user?.role,
        session?.user?.permissions,
        impersonatedRole,
        maskPermissions,
        requiredPath,
        requiredMethod,
    ]);
}
