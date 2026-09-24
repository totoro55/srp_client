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

// Тип сущности Permission из БД
export interface Permission {
    id: number;
    route_path: string;
    method: string;
    description: string | null;
    created_at: string;
}

export interface Role {
    id: number;
    name: string;
    description: string | null;
}

// Структура связи, которую мы получаем из БД
export interface RolePermissionMatrixRow {
    permission_id: number;
    route_path: string;
    method: string;
    allowed_roles: number[]; // Массив ID ролей, у которых есть доступ к этому роуту
}

export interface MatrixDataResponse {
    roles: Role[];
    matrix: RolePermissionMatrixRow[];
}