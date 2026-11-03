import { isWritePermission, type PermissionCode } from "@/lib/permissions";

export interface AccessDecision {
    role: { code: string } | null;
    permissions: readonly string[];
    conflict: boolean;
    previewRoleName: string | null;
}

export function granted(access: AccessDecision, permission: PermissionCode): boolean {
    if (access.conflict || !access.role) {
        return false;
    }
    return access.permissions.includes(permission);
}

export function can(access: AccessDecision, permission: PermissionCode): boolean {
    if (access.previewRoleName && isWritePermission(permission)) {
        return false;
    }
    return granted(access, permission);
}
