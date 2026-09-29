export function isAdminRole(role: string | undefined | null): boolean {
    return role === "ADMIN" || role === "admin";
}

export function isSuperuser(flag: boolean | undefined | null, role?: string | null): boolean {
    if (flag === true) {
        return true;
    }
    return isAdminRole(role);
}
