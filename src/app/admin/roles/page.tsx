// src/app/admin/roles/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Role, Mapping, UserException, AdminSectionType } from '@/types/admin';
import { RolesTable } from './_components/RolesTable';
import { MappingsTable } from './_components/MappingsTable';
import { ExceptionsTable } from './_components/ExceptionsTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Users, Briefcase, UserCheck} from "lucide-react";

export default function AdminRolesManagementPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [exceptions, setExceptions] = useState<UserException[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refreshData = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/roles');
            const json = await res.json();
            if (json.success) {
                setRoles(json.data.roles);
                setMappings(json.data.mappings);
                setExceptions(json.data.exceptions);
            } else {
                setError(json.error.message);
            }
        } catch {
            setError('Ошибка сети при обновлении справочников');
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function fetchInitialData() {
            try {
                const res = await fetch('/api/admin/roles');
                const json = await res.json();
                if (isMounted) {
                    if (json.success) {
                        setRoles(json.data.roles);
                        setMappings(json.data.mappings);
                        setExceptions(json.data.exceptions);
                    } else {
                        setError(json.error.message);
                    }
                }
            } catch {
                if (isMounted) setError('Ошибка сети при первоначальной загрузке данных');
            }
        }
        fetchInitialData();
        return () => { isMounted = false; };
    }, []);

    const handleApiSubmit = async (type: AdminSectionType, payload: object): Promise<boolean> => {
        setError(null);
        try {
            const res = await fetch('/api/admin/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, ...payload }),
            });
            const json = await res.json();
            if (json.success) {
                refreshData();
                return true;
            }
            setError(json.error.message);
            return false;
        } catch {
            setError('Не удалось отправить данные.');
            return false;
        }
    };

    return (
        <div className="w-full">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Управление доступами LDAP</h1>
                <p className="text-muted-foreground font-normal text-sm">Конфигурация системных ролей, кадровых соответствий AD и принудительных исключений.</p>
            </div>

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Ошибка операции</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="roles" className="w-full mt-6">
                <TabsList className="flex w-full h-12 mb-6 bg-muted/60 p-1 rounded-lg border items-center justify-between gap-1 overflow-hidden select-none">
                    <TabsTrigger value="roles" className="flex-1 flex items-center justify-center gap-2 h-full text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"><Users className="w-4 h-4 shrink-0"/> Системные роли</TabsTrigger>
                    <TabsTrigger value="mappings" className="flex-1 flex items-center justify-center gap-2 h-full text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"><Briefcase className="w-4 h-4 shrink-0"/> Должности LDAP</TabsTrigger>
                    <TabsTrigger value="exceptions" className="flex-1 flex items-center justify-center gap-2 h-full text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"><UserCheck className="w-4 h-4 shrink-0"/> Ручные исключения</TabsTrigger>
                </TabsList>

                <TabsContent value="roles">
                    <RolesTable
                        roles={roles}
                        onRefresh={refreshData}
                        onAddSubmit={(p) => handleApiSubmit('ROLE', p)}
                    />
                </TabsContent>

                <TabsContent value="mappings">
                    <MappingsTable
                        mappings={mappings}
                        roles={roles}
                        onRefresh={refreshData}
                        onAddSubmit={(p) => handleApiSubmit('MAPPING', p)}
                    />
                </TabsContent>

                <TabsContent value="exceptions">
                    <ExceptionsTable
                        exceptions={exceptions}
                        roles={roles}
                        onRefresh={refreshData}
                        onAddSubmit={(p) => handleApiSubmit('EXCEPTION', p)}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
