'use client';

import { useState, useMemo } from 'react';
import { Permission } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditPermissionDialog } from './dialogs/EditPermissionDialog';
import { DeleteConfirmDialog } from '../../roles/_components/dialogs/DeleteConfirmDialog'; // переиспользуем созданный ранее диалог удаления
import { Trash2, Pencil, Search, Filter } from "lucide-react";

interface PermissionTableProps {
    permissions: Permission[];
    onRefresh: () => void;
}

export function PermissionTable({ permissions, onRefresh }: PermissionTableProps) {
    const [activePermission, setActivePermission] = useState<Permission | null>(null);
    const [dialogType, setDialogType] = useState<'edit' | 'delete' | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [methodFilter, setMethodFilter] = useState('ALL_METHODS');

    const handleUpdate = async (method: string, routePath: string, description: string) => {
        if (!activePermission) return;
        try {
            const res = await fetch('/api/admin/permissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activePermission.id,
                    route_path: routePath,
                    method: method,
                    description: description
                })
            });
            if (res.ok) onRefresh();
        } catch (err) {
            console.error('Ошибка сети при обновлении');
        }
    };

    const handleDelete = async () => {
        if (!activePermission) return;
        try {
            const res = await fetch(`/api/admin/permissions?id=${activePermission.id}`, { method: 'DELETE' });
            if (res.ok) onRefresh();
        } catch {
            console.error('Ошибка сети при удалении');
        }
    };

    const filteredPermissions = useMemo(() => {
        return permissions.filter(p => {
            const matchesSearch = p.route_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesMethod = methodFilter === 'ALL_METHODS' || p.method === methodFilter;
            return matchesSearch && matchesMethod;
        });
    }, [permissions, searchQuery, methodFilter]);

    return (
        <>
            <Card className="w-full min-w-0">
                <CardHeader className="space-y-4">
                    <div className="flex flex-row items-center justify-between w-full">
                        <div>
                            <CardTitle className="text-lg">Контролируемые роуты</CardTitle>
                            <CardDescription>Список путей, находящихся под защитой системы</CardDescription>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-muted/50">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Поиск по пути или описанию..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={methodFilter} onValueChange={(val) => setMethodFilter(val ?? 'ALL_METHODS')}>
                                <SelectTrigger className="w-full">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                        <SelectValue placeholder="Метод" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL_METHODS">Все методы</SelectItem>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                    <SelectItem value="DELETE">DELETE</SelectItem>
                                    <SelectItem value="ALL">ALL (Любой)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="w-full min-w-0 grid grid-cols-1">
                    <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                        <Table className="w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">Метод</TableHead>
                                    <TableHead>Путь</TableHead>
                                    <TableHead>Описание</TableHead>
                                    <TableHead className="w-[100px] text-right">Действия</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPermissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-10">Роуты не найдены по заданным фильтрам.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPermissions.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium ring-1 ring-inset ring-muted">
                          {p.method}
                        </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm max-w-[200px] truncate">{p.route_path}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{p.description || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => { setActivePermission(p); setDialogType('edit'); }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>

                                                    {/* ИСПРАВЛЕНИЕ: Избавляемся от вложенных кнопок */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => { setActivePermission(p); setDialogType('delete'); }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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

            {/* Изолированный диалог изменения */}
            <EditPermissionDialog
                isOpen={dialogType === 'edit'}
                permission={activePermission}
                onClose={() => setDialogType(null)}
                onSave={handleUpdate}
            />

            {/* Изолированный диалог удаления */}
            <DeleteConfirmDialog
                isOpen={dialogType === 'delete'}
                title="Удалить защищаемый роут?"
                description={`Вы собираетесь удалить правила контроля доступа для пути "${activePermission?.route_path}". Это действие может открыть доступ неавторизованным пользователям.`}
                onClose={() => setDialogType(null)}
                onConfirm={handleDelete}
            />
        </>
    );
}
