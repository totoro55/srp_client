'use client';

import { useState, useEffect, useCallback } from 'react';
import { Permission, ApiResponse } from '@/types/api';
import { PermissionForm } from './_components/PermissionForm';
import { PermissionTable } from './_components/PermissionTable';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import {useHasAccess} from "@/hooks/useHasAccess";

export default function AdminPermissionsPage() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [globalError, setGlobalError] = useState<string | null>(null);
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
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function fetchInitialPermissions() {
            try {
                const res = await fetch('/api/admin/permissions');
                const json: ApiResponse<Permission[]> = await res.json();

                if (isMounted) {
                    if (json.success) {
                        setPermissions(json.data);
                        setGlobalError(null);
                    } else {
                        setGlobalError(json.error.message);
                    }
                }
            } catch {
                if (isMounted) {
                    setGlobalError('Сетевая ошибка при первоначальной загрузке данных');
                }
            }
        }

        fetchInitialPermissions();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleFormSubmit = async (payload: { route_path: string; method: string; description: string }): Promise<boolean> => {
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
                return true;
            }
            setGlobalError(json.error.message);
            return false;
        } catch {
            setGlobalError('Не удалось отправить форму. Проверьте подключение.');
            return false;
        }
    };

    return (
        <div className="w-full">
            {/* Шапка с кнопкой вовнутрь */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="pb-3">
                    <h1 className="text-3xl font-bold tracking-tight">Управление роутами безопасности</h1>
                    <p className="text-muted-foreground text-sm">Список защищаемых эндпоинтов и интерфейсных страниц системы.</p>
                </div>
                {canCreate && <PermissionForm onSubmit={handleFormSubmit} />}
            </div>

            {globalError && (
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Произошла ошибка</AlertTitle>
                    <AlertDescription>{globalError}</AlertDescription>
                </Alert>
            )}

            {/* Таблица занимает всю ширину */}
            <div className="w-full">
                <PermissionTable permissions={permissions} onRefresh={refreshPermissions} />
            </div>
        </div>
    );
}
