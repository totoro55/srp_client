// src/app/admin/matrix/page.tsx
'use client';

import {useState, useEffect, useCallback, useTransition} from 'react';
import { MatrixGrid } from './_components/MatrixGrid';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import { AdminPageShell } from '@/app/admin/_components/AdminPageShell';

interface Role {
    id: number;
    name: string;
    description?: string;
}

interface Permission {
    id: number;
    route_path: string;
    method: string;
    description?: string;
}

interface Relation {
    role_id: number;
    permission_id: number;
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

    // Функция реактивного обновления данных с сервера
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
                setError(matrixErrorMessage(json.error, "Не удалось загрузить конфигурацию матрицы доступов"));
            }
        } catch {
            setError('Ошибка сети при обращении к серверу ИБ');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Первоначальная загрузка данных при монтировании страницы
    useEffect(() => {
        startTransition(()=>{
            fetchMatrixData(true);
        })
    }, [fetchMatrixData]);

    // Обработчик переключения чекбоксов (отправка изменений в СУБД)
    const handleTogglePermission = async (roleId: number, permissionId: number, checked: boolean) => {
        try {
            // 1. Оптимистичное обновление UI для мгновенного отклика без ожидания сети
            setRelations(prev => {
                if (checked) {
                    return [...prev, { role_id: roleId, permission_id: permissionId }];
                } else {
                    return prev.filter(rel => !(rel.role_id === roleId && rel.permission_id === permissionId));
                }
            });

            // 2. Отправка POST запроса на бэкенд
            const res = await fetch('/api/admin/matrix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roleId, permissionId, checked })
            });

            const json = await res.json();

            // Если сервер вернул ошибку, откатываем данные назад и запрашиваем актуальное состояние
            if (!json.success) {
                setError(matrixErrorMessage(json.error, "СУБД отклонила изменение прав"));
                await fetchMatrixData();
            }
        } catch {
            setError('Ошибка сети. Не удалось сохранить изменения матрицы.');
            await fetchMatrixData();
        }
    };

    return (
        <AdminPageShell>
            <ConfirmDialog
                open={error !== null}
                title="Ошибка конфигурации ИБ"
                description={error ?? ''}
                confirmLabel="Понятно"
                confirmVariant="default"
                showCancel={false}
                onConfirm={() => setError(null)}
                onOpenChange={(open) => {
                    if (!open) {
                        setError(null);
                    }
                }}
            />

            <MatrixGrid
                roles={roles}
                permissions={permissions}
                relations={relations}
                isLoading={isLoading}
                onTogglePermission={handleTogglePermission}
            />
        </AdminPageShell>
    );
}
