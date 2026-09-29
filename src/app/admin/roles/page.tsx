'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, Mapping, UserException, AdminTab } from '@/types/admin';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Users, Briefcase, UserCheck } from "lucide-react";
import { useHasAccess } from "@/hooks/useHasAccess";
import { AdminFormDialog, AdminFormValues, FieldConfig } from './_components/AdminFormDialog';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import { AdminTableSkeleton } from '@/app/admin/_components/AdminTableSkeleton';
import { AdminPageShell } from '@/app/admin/_components/AdminPageShell';
import { AdminToolbar } from '@/app/admin/_components/AdminToolbar';
import { ApiResponse } from '@/types/api';

type MutationEntityType = 'ROLE' | 'MAPPING' | 'EXCEPTION';

function entityTypeFromTab(tab: AdminTab): MutationEntityType {
    if (tab === 'roles') return 'ROLE';
    if (tab === 'mappings') return 'MAPPING';
    return 'EXCEPTION';
}

function deleteDescription(tab: AdminTab, item: Role | Mapping | UserException): string {
    if (tab === 'roles' && 'name' in item) {
        return `Роль «${item.name}» будет удалена безвозвратно. Связанные назначения должностей и исключения могут быть затронуты.`;
    }
    if (tab === 'mappings' && 'ldapPosition' in item) {
        return `Соответствие должности «${item.ldapPosition}» роли «${item.roleName}» будет удалено.`;
    }
    if (tab === 'exceptions' && 'username' in item) {
        return `Исключение для пользователя «${item.username}» будет удалено.`;
    }
    return 'Запись будет удалена безвозвратно.';
}

function apiErrorMessage(json: { success: boolean; error?: string | { message?: string } }): string {
    if (json.success) return '';
    if (typeof json.error === 'string') return json.error;
    return json.error?.message || 'Не удалось сохранить запись';
}

export default function AdminRolesPage() {
    const [activeTab, setActiveTab] = useState<AdminTab>('roles');
    const [data, setData] = useState<{ roles: Role[]; mappings: Mapping[]; exceptions: UserException[] }>({ roles: [], mappings: [], exceptions: [] });
    const [ldapPositions, setLdapPositions] = useState<string[]>([]);
    const [search, setSearch] = useState('');

    const [dialog, setDialog] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; targetData?: Record<string, unknown> }>({ isOpen: false, mode: 'create' });
    const [deleteTarget, setDeleteTarget] = useState<(Role | Mapping | UserException) | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const canWrite = useHasAccess("/api/admin/roles", "POST");

    const loadData = useCallback(async (showLoader = false) => {
        if (showLoader) setIsLoading(true);
        try {
            const res = await fetch('/api/admin/roles');
            const json = await res.json();
            if (json.success) setData(json.data);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(true); }, [loadData]);

    useEffect(() => {
        fetch('/api/admin/available-positions')
            .then((res) => res.json() as Promise<ApiResponse<string[]>>)
            .then((json) => {
                if (json.success) setLdapPositions(json.data);
            })
            .catch(() => {
                setLdapPositions([]);
            });
    }, []);

    const formFieldsConfig = useMemo<FieldConfig[]>(() => {
        if (activeTab === 'roles') return [
            { key: 'name', label: 'Название роли', type: 'text', required: true },
            { key: 'description', label: 'Описание', type: 'text' }
        ];
        if (activeTab === 'mappings') return [
            { key: 'ldapPosition', label: 'Должность в LDAP', type: 'text', required: true, suggestions: ldapPositions },
            { key: 'roleId', label: 'Системная роль ИБ', type: 'select', required: true }
        ];
        return [
            { key: 'username', label: 'Имя пользователя (UID)', type: 'text', required: true },
            { key: 'roleId', label: 'Временная роль', type: 'select', required: true },
            { key: 'reason', label: 'Обоснование', type: 'text' },
            { key: 'expiresAt', label: 'Срок действия до', type: 'date' }
        ];
    }, [activeTab, ldapPositions]);

    const handleSave = async (formData: AdminFormValues) => {
        const method = dialog.mode === 'create' ? 'POST' : 'PUT';
        const expiresAt = typeof formData.expiresAt === 'string' && formData.expiresAt.length > 0
            ? formData.expiresAt
            : null;
        const res = await fetch('/api/admin/roles', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: entityTypeFromTab(activeTab),
                ...formData,
                expiresAt,
            })
        });
        const json = await res.json() as { success: boolean; error?: string | { message?: string } };
        if (!json.success) {
            throw new Error(apiErrorMessage(json));
        }
        await loadData();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await fetch(`/api/admin/roles?type=${entityTypeFromTab(activeTab)}&id=${deleteTarget.id}`, { method: 'DELETE' });
            setDeleteTarget(null);
            await loadData();
        } finally {
            setIsDeleting(false);
        }
    };

    // Декларативная фильтрация списков
    const filteredItems = useMemo(() => {
        const query = search.toLowerCase();
        if (activeTab === 'roles') return data.roles.filter(r => r.name.toLowerCase().includes(query));
        if (activeTab === 'mappings') return data.mappings.filter(m => m.ldapPosition.toLowerCase().includes(query));
        return data.exceptions.filter(e => e.username.toLowerCase().includes(query));
    }, [data, activeTab, search]);

    return (
        <AdminPageShell>
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as AdminTab); setSearch(''); setDeleteTarget(null); }} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                <TabsList className="grid h-9 w-full max-w-[540px] shrink-0 grid-cols-3">
                    <TabsTrigger value="roles" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5"/> Роли</TabsTrigger>
                    <TabsTrigger value="mappings" className="gap-1.5 text-xs"><Briefcase className="h-3.5 w-3.5"/> Должности</TabsTrigger>
                    <TabsTrigger value="exceptions" className="gap-1.5 text-xs"><UserCheck className="h-3.5 w-3.5"/> Исключения</TabsTrigger>
                </TabsList>

                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <CardHeader className="shrink-0">
                        <AdminToolbar
                            search={search}
                            onSearchChange={setSearch}
                            searchPlaceholder="Поиск по таблице..."
                        >
                            {canWrite && (
                                <Button size="sm" onClick={() => setDialog({ isOpen: true, mode: 'create' })} className="h-9 gap-1.5 text-xs">
                                    <Plus className="h-3.5 w-3.5"/> Добавить запись
                                </Button>
                            )}
                        </AdminToolbar>
                    </CardHeader>
                    <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <Table containerClassName="h-full min-h-0 rounded-md border">
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    {activeTab === 'roles' && <>
                                        <TableHead className="w-16">ID</TableHead>
                                        <TableHead>Название роли</TableHead>
                                        <TableHead>Описание</TableHead>
                                    </>}
                                    {activeTab === 'mappings' && <>
                                        <TableHead>Должность LDAP</TableHead>
                                        <TableHead>Выдаваемая роль</TableHead>
                                    </>}
                                    {activeTab === 'exceptions' && <>
                                        <TableHead>Сотрудник</TableHead>
                                        <TableHead>Роль</TableHead>
                                        <TableHead>Обоснование</TableHead>
                                        <TableHead>До какого числа</TableHead>
                                    </>}
                                    <TableHead className="w-20 text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <AdminTableSkeleton columns={activeTab === 'exceptions' ? 5 : activeTab === 'roles' ? 4 : 3} />
                                ) : filteredItems.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Записей не найдено</TableCell></TableRow>
                                ) : filteredItems.map((item) => (
                                    <TableRow key={item.id} className="text-xs">
                                        {activeTab === 'roles' && <>
                                            <TableCell className="text-muted-foreground">{item.id}</TableCell>
                                            <TableCell className="font-semibold">{item.name}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.description || '—'}</TableCell>
                                        </>}
                                        {activeTab === 'mappings' && <>
                                            <TableCell className="font-medium">{item.ldapPosition}</TableCell>
                                            <TableCell><span className="bg-secondary/70 px-2 py-0.5 rounded font-medium">{item.roleName}</span></TableCell>
                                        </>}
                                        {activeTab === 'exceptions' && <>
                                            <TableCell className="font-medium">{item.username}</TableCell>
                                            <TableCell><span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded font-medium">{item.roleName}</span></TableCell>
                                            <TableCell className="text-muted-foreground">{item.reason || '—'}</TableCell>
                                            <TableCell className="text-muted-foreground">{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Бессрочно'}</TableCell>
                                        </>}
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ isOpen: true, mode: 'edit', targetData: item as unknown as Record<string, unknown> })}><Pencil className="h-4 w-4"/></Button>}
                                                {canWrite && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4"/></Button>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </Tabs>

            <AdminFormDialog
                isOpen={dialog.isOpen}
                title={dialog.mode === 'create' ? 'Создание новой записи' : 'Редактирование записи'}
                fields={formFieldsConfig}
                roles={data.roles}
                initialData={dialog.targetData}
                onClose={() => setDialog({ isOpen: false, mode: 'create' })}
                onSave={handleSave}
            />
            <ConfirmDialog
                open={deleteTarget !== null}
                title="Удалить запись?"
                description={deleteTarget ? deleteDescription(activeTab, deleteTarget) : ''}
                confirmLabel="Удалить"
                isPending={isDeleting}
                onConfirm={handleDelete}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) {
                        setDeleteTarget(null);
                    }
                }}
            />
        </AdminPageShell>
    );
}