'use client';

import { useState } from 'react';
import { Role } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RoleFormDialog } from './RoleFormDialog'; // Импортируем форму внутрь
import { EditDialog } from './dialogs/EditDialog';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { Trash2, Pencil, Plus } from "lucide-react";

interface RolesTableProps {
    roles: Role[];
    onRefresh: () => void;
    onAddSubmit: (payload: { role_name: string; description: string }) => Promise<boolean>;
}

export function RolesTable({ roles, onRefresh, onAddSubmit }: RolesTableProps) {
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [dialogType, setDialogType] = useState<'edit' | 'delete' | 'create' | null>(null);

    const handleUpdate = async (formData: Record<string, string>) => {
        if (!activeRole) return;
        await fetch('/api/admin/roles', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ROLE', id: activeRole.id, role_name: formData.name, description: formData.description })
        });
        onRefresh();
    };

    const handleDelete = async () => {
        if (!activeRole) return;
        await fetch(`/api/admin/roles?type=ROLE&id=${activeRole.id}`, { method: 'DELETE' });
        onRefresh();
    };

    return (
        <>
            <Card className="w-full min-w-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg">Доступные роли в системе</CardTitle>
                    {/* Кнопка создания рендерится нативно, открывая локальный стейт 'create' */}
                    <Button onClick={() => setDialogType('create')} size="sm" className="flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5"/> Создать роль
                    </Button>
                </CardHeader>
                <CardContent className="w-full min-w-0 grid grid-cols-1">
                    <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead>Описание</TableHead>
                                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell>{r.id}</TableCell>
                                        <TableCell className="font-bold">{r.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{r.description || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveRole(r); setDialogType('edit'); }}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setActiveRole(r); setDialogType('delete'); }}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ФОРМА СОЗДАНИЯ РОЛИ */}
            <RoleFormDialog
                isOpen={dialogType === 'create'}
                onClose={() => setDialogType(null)}
                onSubmit={onAddSubmit}
            />

            <EditDialog
                isOpen={dialogType === 'edit'}
                title="Редактировать роль"
                fields={[
                    { label: 'Название роли', value: activeRole?.name ?? '', key: 'name', required: true },
                    { label: 'Описание', value: activeRole?.description ?? '', key: 'description' }
                ]}
                onClose={() => setDialogType(null)}
                onSave={handleUpdate}
            />

            <DeleteConfirmDialog
                isOpen={dialogType === 'delete'}
                title="Удалить системную роль?"
                description={`Удаление роли "${activeRole?.name}" каскадно сотрет все её маппинги должностей.`}
                onClose={() => setDialogType(null)}
                onConfirm={handleDelete}
            />
        </>
    );
}
