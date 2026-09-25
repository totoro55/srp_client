export interface Role {
    id: number;
    name: string;
    description: string | null;
}

export interface Mapping {
    id: number;
    ldapPosition: string;
    roleId: number;
    roleName: string;
}

export interface UserException {
    id: number;
    username: string;
    roleId: number;
    roleName: string;
    reason: string | null;
    grantedBy: string | null;
    expiresAt: string | null;
}

export type AdminTab = 'roles' | 'mappings' | 'exceptions';
