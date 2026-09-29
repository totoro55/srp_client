export type ApiErrorCode =
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'INTERNAL_SERVER_ERROR'
    | 'DATABASE_ERROR';

export interface ApiErrorResponse {
    success: false;
    error: {
        code: ApiErrorCode;
        message: string;
        details?: unknown;
    };
}

export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface Permission {
    id: number;
    code: string;
    title: string;
    description: string | null;
}

export interface Role {
    id: number;
    name: string;
    description: string | null;
}

export interface MatrixToggleRequest {
    roleId?: number;
    permissionId?: number;
    checked?: boolean;
    role_id?: number;
    permission_id?: number;
    is_checked?: boolean;
}

export interface SessionAccess {
    role: string | null;
    roleId: number | null;
    isSuperuser: boolean;
    originalIsSuperuser: boolean;
    codes: string[];
    impersonatedRole: string | null;
    impersonatedRoleId: number | null;
}

export interface ImpersonationStatus {
    impersonatedRole: string | null;
    impersonatedRoleId: number | null;
    codes: string[];
}
