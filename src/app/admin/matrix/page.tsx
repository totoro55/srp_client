'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { MatrixGrid } from './_components/MatrixGrid';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import { AdminPageShell } from '@/app/admin/_components/AdminPageShell';
import { useAccess } from '@/hooks/useAccess';
import type { ScopeKind } from '@/lib/permissions';

interface Role {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    scopeKind: ScopeKind;
    isSystem: boolean;
}

interface Permission {
    code: string;
    group: string;
    title: string;
    description?: string;
}

interface Relation {
    role_id: number;
    permission_code: string;
}

interface MatrixApiError {
    code?: string;
    message?: string;
}

interface MatrixApiResponse {
    success: boolean;
    data?: {
        roles: Role[];
        permissions: Permission[];
        relations: Relation[];
    };
    error?: string | MatrixApiError;
}

function matrixErrorMessage(error: MatrixApiResponse["error"], fallback: string): string {
    if (typeof error === "string" && error.length > 0) return error;
    if (error && typeof error === "object" && error.message) return error.message;
    return fallback;
}

export default function AdminMatrixPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [relations, setRelations] = useState<Relation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    const access = useAccess();
    const canWrite = access.has("access.write");

    const fetchMatrixData = useCallback(async (showLoader = false) => {
        if (showLoader) setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/matrix');
            const json: MatrixApiResponse = await res.json();

            if (json.success && json.data) {
                setRoles(json.data.roles);
                setPermissions(json.data.permissions);
                setRelations(json.data.relations);
            } else {
                setError(matrixErrorMessage(json.error, "Не удалось загрузить матрицу"));
            }
        } catch {
            setError('Ошибка сети при обращении к серверу');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        startTransition(() => {
            void fetchMatrixData(true);
        });
    }, [fetchMatrixData]);

    const handleTogglePermission = async (roleId: number, permissionCode: string, checked: boolean) => {
        const previous = relations;
        setRelations((prev) => {
            if (checked) {
                return [...prev, { role_id: roleId, permission_code: permissionCode }];
            }
            return prev.filter((rel) => !(rel.role_id === roleId && rel.permission_code === permissionCode));
        });

        try {
            const res = await fetch('/api/admin/matrix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, permissionCode, checked }),
            });
            const json = await res.json();
            if (!json.success) {
                setRelations(previous);
                setError(matrixErrorMessage(json.error, "Сервер отклонил изменение прав"));
            }
        } catch {
            setRelations(previous);
            setError('Ошибка сети. Не удалось сохранить изменения матрицы.');
        }
    };

    return (
        <AdminPageShell>
            <ConfirmDialog
                open={error !== null}
                title="Ошибка настройки доступа"
                description={error ?? ''}
                confirmLabel="Понятно"
                confirmVariant="default"
                showCancel={false}
                onConfirm={() => setError(null)}
                onOpenChange={(open) => {
                    if (!open) setError(null);
                }}
            />
            {access.username && !canWrite ? (
                <p className="mb-3 text-xs text-muted-foreground">
                    {access.previewRoleName
                        ? "Просмотр от имени роли. Изменения недоступны."
                        : "Нет права менять доступ."}
                </p>
            ) : null}
            <MatrixGrid
                roles={roles}
                permissions={permissions}
                relations={relations}
                isLoading={isLoading}
                canWrite={canWrite}
                onTogglePermission={handleTogglePermission}
            />
        </AdminPageShell>
    );
}
