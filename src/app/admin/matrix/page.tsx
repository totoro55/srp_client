// src/app/admin/matrix/page.tsx
'use client';

import {useState, useEffect, useCallback, useTransition} from 'react';
import { MatrixGrid } from './_components/MatrixGrid';
import { ShieldAlert, Loader2 } from "lucide-react";

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

interface MatrixApiResponse {
    success: boolean;
    data?: {
        roles: Role[];
        permissions: Permission[];
        relations: Relation[];
    };
    error?: string;
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
                setError(json.error || 'Не удалось загрузить конфигурацию матрицы доступов');
            }
        } catch (err) {
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
                setError(json.error || 'СУБД отклонила изменение прав');
                await fetchMatrixData();
            }
        } catch (err) {
            setError('Ошибка сети. Не удалось сохранить изменения матрицы.');
            await fetchMatrixData();
        }
    };

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-300">
            {/* Заголовок страницы */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Матрица прав безопасности</h1>
                <p className="text-muted-foreground font-normal text-sm">
                    Динамическое разграничение ролевых политик (RBAC) [INDEX]. Настройки применяются бэкендом в реальном времени.
                </p>
            </div>

            {/* Вывод критических ошибок */}
            {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm">Ошибка конфигурации ИБ</span>
                        <span className="text-xs opacity-90">{error}</span>
                    </div>
                </div>
            )}

            {/* Экран загрузки (Спиннер) */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-xs font-medium">Загрузка справочников СУБД...</span>
                </div>
            ) : (
                /* САМА МАТРИЦА С ФИЛЬТРАМИ */
                <MatrixGrid
                    roles={roles}
                    permissions={permissions}
                    relations={relations}
                    onTogglePermission={handleTogglePermission}
                />
            )}
        </div>
    );
}
