// src/app/admin/roles/_components/ExceptionsTable.tsx
'use client';

import { useState, useMemo } from 'react';
import { UserException, Role } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { ExceptionFormDialog } from './ExceptionFormDialog'; // Убедитесь в верности относительного пути
import { EditExceptionDialog } from './dialogs/EditExceptionDialog';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { Trash2, Pencil, Search, Filter, Plus } from "lucide-react";

interface ExceptionsTableProps {
    exceptions: UserException[];
    roles: Role[];
    onRefresh: () => void;
    onAddSubmit: (payload: { username: string; role_id: number; reason: string }) => Promise<boolean>;
}

export function ExceptionsTable({ exceptions, roles, onRefresh, onAddSubmit }: ExceptionsTableProps) {
    const [activeException, setActiveException] = useState<UserException | null>(null);
    const [dialogType, setDialogType] = useState<'edit' | 'delete' | 'create' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL_ROLES');

    const handleUpdate = async (roleId: number, reason: string) => {
        if (!activeException) return;
        await fetch('/api/admin/roles', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'EXCEPTION', id: activeException.id, username: activeException.username, role_id: roleId, reason })
        });
        onRefresh();
    };

    const handleDelete = async () => {
        if (!activeException) return;
        await fetch(`/api/admin/roles?type=EXCEPTION&id=${activeException.id}`, { method: 'DELETE' });
        onRefresh();
    };

    const filteredExceptions = useMemo(() => {
        return exceptions.filter(e => {
            const matchesSearch = e.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (e.reason && e.reason.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesRole = roleFilter === 'ALL_ROLES' || e.role_id.toString() === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [exceptions, searchQuery, roleFilter]);

    return (
        <>
            <Card className="w-full min-w-0">
                <CardHeader className="flex flex-col space-y-4 pb-4">
                    <div className="flex flex-row items-center justify-between w-full space-y-0">
                        <CardTitle className="text-lg">Индивидуальные исключения пользователей</CardTitle>
                        <Button onClick={() => setDialogType('create')} size="sm" className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5"/> Выдать роль лично
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-muted/50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Поиск по username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val ?? 'ALL_ROLES')}>
                                <SelectTrigger className="w-full">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{roleFilter === 'ALL_ROLES' ? 'Все роли' : (roles.find(r => r.id.toString() === roleFilter)?.name ?? 'Все роли')}</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL_ROLES">Все роли</SelectItem>
                                    {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="w-full min-w-0 grid grid-cols-1">
                    <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Пользователь</TableHead>
                                    <TableHead className="w-40">Роль</TableHead>
                                    <TableHead>Причина выдачи</TableHead>
                                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredExceptions.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Исключения не найдены.</TableCell></TableRow>
                                ) : (
                                    filteredExceptions.map(e => (
                                        <TableRow key={e.id}>
                                            <TableCell className="font-mono text-sm">{e.username}</TableCell>
                                            <TableCell><span className="rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs font-bold">{e.role_name}</span></TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{e.reason || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveException(e); setDialogType('edit'); }}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setActiveException(e); setDialogType('delete'); }}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ExceptionFormDialog isOpen={dialogType === 'create'} onClose={() => setDialogType(null)} roles={roles} onSubmit={onAddSubmit} />
            <EditExceptionDialog isOpen={dialogType === 'edit'} exception={activeException} roles={roles} onClose={() => setDialogType(null)} onSave={handleUpdate} />
            <DeleteConfirmDialog isOpen={dialogType === 'delete'} title="Удалить ручное исключение?" description={`Вы собираетесь аннулировать ручные права для аккаунта "${activeException?.username}".`} onClose={() => setDialogType(null)} onConfirm={handleDelete} />
        </>
    );
}
