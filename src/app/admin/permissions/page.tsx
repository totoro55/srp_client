'use client';

import { useState, useEffect, useCallback } from 'react';
import { Permission, ApiResponse } from '@/types/api';
import { PermissionForm } from './_components/PermissionForm';
import { PermissionTable } from './_components/PermissionTable';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import {useHasAccess} from "@/hooks/useHasAccess";

export default function AdminPermissionsPage() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const canCreate = useHasAccess("/api/admin/permissions", "POST");


    const refreshPermissions = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/permissions');
            const json: ApiResponse<Permission[]> = await res.json();
            if (json.success) {
                setPermissions(json.data);
                setGlobalError(null);
            } else {
                setGlobalError(json.error.message);
            }
        } catch {
            setGlobalError('Сетевая ошибка при обновлении данных');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshPermissions();
    }, [refreshPermissions]);

    const handleFormSubmit = async (payload: { route_path: string; method: string; description: string }): Promise<'created' | 'duplicate' | 'error'> => {
        setGlobalError(null);
        try {
            const response = await fetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json: ApiResponse<{ id: number }> = await response.json();

            if (json.success) {
                refreshPermissions();
                return 'created';
            }
            if (json.error.message.includes('уже существует')) {
                return 'duplicate';
            }
            setGlobalError(json.error.message);
            return 'error';
        } catch {
            setGlobalError('Не удалось отправить форму. Проверьте подключение.');
            return 'error';
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Управление роутами безопасности</h1>
                    <p className="text-muted-foreground text-sm">Список защищаемых эндпоинтов и интерфейсных страниц системы.</p>
                </div>
                {canCreate && <PermissionForm onSubmit={handleFormSubmit} />}
            </div>

            <ConfirmDialog
                open={globalError !== null}
                title="Произошла ошибка"
                description={globalError ?? ''}
                confirmLabel="Понятно"
                confirmVariant="default"
                showCancel={false}
                onConfirm={() => setGlobalError(null)}
                onOpenChange={(open) => {
                    if (!open) {
                        setGlobalError(null);
                    }
                }}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <PermissionTable permissions={permissions} isLoading={isLoading} onRefresh={refreshPermissions} />
            </div>
        </div>
    );
}
