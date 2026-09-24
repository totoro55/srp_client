// src/app/admin/roles/_components/MappingsTable.tsx
'use client';

import { useState, useMemo } from 'react';
import { Mapping, Role } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { MappingFormDialog } from './MappingFormDialog';
import { EditMappingDialog } from './dialogs/EditMappingDialog';
import { DeleteConfirmDialog } from './dialogs/DeleteConfirmDialog';
import { Trash2, Pencil, Search, Filter, Plus } from "lucide-react";

interface MappingsTableProps {
    mappings: Mapping[];
    roles: Role[];
    onRefresh: () => void;
    onAddSubmit: (payload: { ldap_position: string; role_id: number }) => Promise<boolean>;
}

export function MappingsTable({ mappings, roles, onRefresh, onAddSubmit }: MappingsTableProps) {
    const [activeMapping, setActiveMapping] = useState<Mapping | null>(null);
    const [dialogType, setDialogType] = useState<'edit' | 'delete' | 'create' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL_ROLES');

    const handleUpdate = async (roleId: number) => {
        if (!activeMapping) return;
        await fetch('/api/admin/roles', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'MAPPING', id: activeMapping.id, ldap_position: activeMapping.ldap_position, role_id: roleId })
        });
        onRefresh();
    };

    const handleDelete = async () => {
        if (!activeMapping) return;
        await fetch(`/api/admin/roles?type=MAPPING&id=${activeMapping.id}`, { method: 'DELETE' });
        onRefresh();
    };

    const filteredMappings = useMemo(() => {
        return mappings.filter(m => {
            const matchesSearch = m.ldap_position.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'ALL_ROLES' || m.role_id.toString() === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [mappings, searchQuery, roleFilter]);

    return (
        <>
            <Card className="w-full min-w-0">
                <CardHeader className="flex flex-col space-y-4 pb-4">
                    <div className="flex flex-row items-center justify-between w-full space-y-0">
                        <CardTitle className="text-lg">Правила назначения по должностям</CardTitle>
                        <Button onClick={() => setDialogType('create')} size="sm" className="flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5"/> Добавить правило
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-muted/50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Поиск по должности LDAP..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
                                    <TableHead>Должность в LDAP</TableHead>
                                    <TableHead className="w-40">Выдаваемая роль</TableHead>
                                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMappings.length === 0 ? (
                                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10">Маппинги не найдены.</TableCell></TableRow>
                                ) : (
                                    filteredMappings.map(m => (
                                        <TableRow key={m.id}>
                                            <TableCell className="font-medium">{m.ldap_position}</TableCell>
                                            <TableCell><span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold">{m.role_name}</span></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveMapping(m); setDialogType('edit'); }}><Pencil className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setActiveMapping(m); setDialogType('delete'); }}><Trash2 className="h-4 w-4" /></Button>
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

            <MappingFormDialog isOpen={dialogType === 'create'} onClose={() => setDialogType(null)} roles={roles} onSubmit={onAddSubmit} />
            <EditMappingDialog isOpen={dialogType === 'edit'} mapping={activeMapping} roles={roles} onClose={() => setDialogType(null)} onSave={handleUpdate} />
            <DeleteConfirmDialog isOpen={dialogType === 'delete'} title="Удалить маппинг должности?" description={`Вы собираетесь удалить связь роли для должности "${activeMapping?.ldap_position}".`} onClose={() => setDialogType(null)} onConfirm={handleDelete} />
        </>
    );
}
