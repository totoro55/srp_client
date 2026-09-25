'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Role, Mapping, UserException, AdminTab } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Users, Briefcase, UserCheck, Search } from "lucide-react";
import { useHasAccess } from "@/hooks/useHasAccess";
import { AdminFormDialog, FieldConfig } from './_components/AdminFormDialog';

export default function AdminRolesPage() {
    const [activeTab, setActiveTab] = useState<AdminTab>('roles');
    const [data, setData] = useState<{ roles: Role[]; mappings: Mapping[]; exceptions: UserException[] }>({ roles: [], mappings: [], exceptions: [] });
    const [search, setSearch] = useState('');

    // Стейт для универсального модального окна
    const [dialog, setDialog] = useState<{ isOpen: boolean; mode: 'create' | 'edit'; targetData?: any }>({ isOpen: false, mode: 'create' });

    const canWrite = useHasAccess("/api/admin/roles", "POST");

    const loadData = useCallback(async () => {
        const res = await fetch('/api/admin/roles');
        const json = await res.json();
        if (json.success) setData(json.data);
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Конфигурация полей диалога в зависимости от активной вкладки
    const formFieldsConfig = useMemo<FieldConfig[]>(() => {
        if (activeTab === 'roles') return [
            { key: 'name', label: 'Название роли', type: 'text', required: true },
            { key: 'description', label: 'Описание', type: 'text' }
        ];
        if (activeTab === 'mappings') return [
            { key: 'ldapPosition', label: 'Должность в LDAP', type: 'text', required: true },
            { key: 'roleId', label: 'Системная роль ИБ', type: 'select', required: true }
        ];
        return [
            { key: 'username', label: 'Имя пользователя (UID)', type: 'text', required: true },
            { key: 'roleId', label: 'Временная роль', type: 'select', required: true },
            { key: 'reason', label: 'Обоснование', type: 'text' },
            { key: 'expiresAt', label: 'Срок действия до', type: 'date' }
        ];
    }, [activeTab]);

    const handleSave = async (formData: any) => {
        const method = dialog.mode === 'create' ? 'POST' : 'PUT';
        await fetch('/api/admin/roles', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: activeTab.toUpperCase().slice(0, -1), ...formData })
        });
        loadData();
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить эту запись?')) return;
        await fetch(`/api/admin/roles?type=${activeTab.toUpperCase().slice(0, -1)}&id=${id}`, { method: 'DELETE' });
        loadData();
    };

    // Декларативная фильтрация списков
    const filteredItems = useMemo(() => {
        const query = search.toLowerCase();
        if (activeTab === 'roles') return data.roles.filter(r => r.name.toLowerCase().includes(query));
        if (activeTab === 'mappings') return data.mappings.filter(m => m.ldapPosition.toLowerCase().includes(query));
        return data.exceptions.filter(e => e.username.toLowerCase().includes(query));
    }, [data, activeTab, search]);

    return (
        <div className="w-full space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Управление доступами LDAP</h1>
                <p className="text-muted-foreground text-xs">Конфигурация ролей, соответствий должностей AD и исключений.</p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as AdminTab); setSearch(''); }} className="w-full">
                <TabsList className="grid grid-cols-3 max-w-[600px] h-10 border bg-muted/50 p-1 rounded-md">
                    <TabsTrigger value="roles" className="text-xs gap-1.5"><Users className="w-3.5 h-3.5"/> Роли</TabsTrigger>
                    <TabsTrigger value="mappings" className="text-xs gap-1.5"><Briefcase className="w-3.5 h-3.5"/> Должности</TabsTrigger>
                    <TabsTrigger value="exceptions" className="text-xs gap-1.5"><UserCheck className="w-3.5 h-3.5"/> Исключения</TabsTrigger>
                </TabsList>

                <Card className="mt-4 border shadow-sm">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Быстрый поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
                        </div>
                        {canWrite && (
                            <Button size="sm" onClick={() => setDialog({ isOpen: true, mode: 'create' })} className="text-xs h-8 gap-1.5">
                                <Plus className="w-3.5 h-3.5"/> Добавить запись
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
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
                                {filteredItems.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">Записей не найдено</TableCell></TableRow>
                                ) : filteredItems.map((item: any) => (
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
                                            <div className="flex justify-end gap-0.5">
                                                {canWrite && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ isOpen: true, mode: 'edit', targetData: item })}><Pencil className="h-3.5 w-3.5"/></Button>}
                                                {canWrite && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5"/></Button>}
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
        </div>
    );
}