'use client';

import { useState, useEffect, useCallback } from 'react';
import { Permission, ApiResponse } from '@/types/api';
import { PermissionTable } from './_components/PermissionTable';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import { AdminPageShell } from '@/app/admin/_components/AdminPageShell';

export default function AdminPermissionsPage() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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

    return (
        <AdminPageShell>
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

            <PermissionTable
                permissions={permissions}
                isLoading={isLoading}
            />
        </AdminPageShell>
    );
}
