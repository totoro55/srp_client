'use client';

import { useState, useMemo, ReactNode } from 'react';
import { Permission } from '@/types/api';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditPermissionDialog } from './dialogs/EditPermissionDialog';
import { ConfirmDialog } from '@/app/admin/_components/ConfirmDialog';
import { AdminTableSkeleton } from '@/app/admin/_components/AdminTableSkeleton';
import { AdminToolbar } from '@/app/admin/_components/AdminToolbar';
import {Trash2, Pencil, Filter} from "lucide-react";
import {useHasAccess} from "@/hooks/useHasAccess";
import {cn} from "@/lib/utils";

interface PermissionTableProps {
    permissions: Permission[];
    isLoading?: boolean;
    onRefresh: () => void;
    headerAction?: ReactNode;
}

export function PermissionTable({ permissions, isLoading = false, onRefresh, headerAction }: PermissionTableProps) {
    const [activePermission, setActivePermission] = useState<Permission | null>(null);
    const [dialogType, setDialogType] = useState<'edit' | 'delete' | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [methodFilter, setMethodFilter] = useState('ALL_METHODS');
    const [isDeleting, setIsDeleting] = useState(false);

    const canUpdate = useHasAccess("/api/admin/permissions", "PUT");
    const canDelete = useHasAccess("/api/admin/permissions", "DELETE");

    const handleUpdate = async (method: string, routePath: string, description: string): Promise<boolean> => {
        if (!activePermission) return false;
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
            if (res.ok) {
                onRefresh();
                return true;
            }
            return false;
        } catch {
            console.error('Ошибка сети при обновлении');
            return false;
        }
    };

    const handleDelete = async () => {
        if (!activePermission) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/permissions?id=${activePermission.id}`, { method: 'DELETE' });
            if (res.ok) {
                onRefresh();
                setDialogType(null);
            }
        } catch {
            console.error('Ошибка сети при удалении');
        } finally {
            setIsDeleting(false);
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
            <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                <CardHeader className="shrink-0">
                    <AdminToolbar
                        search={searchQuery}
                        onSearchChange={setSearchQuery}
                        searchPlaceholder="Поиск по пути или описанию..."
                    >
                        <Select value={methodFilter} onValueChange={(val) => setMethodFilter(val ?? 'ALL_METHODS')}>
                            <SelectTrigger className="h-9 w-full text-xs sm:w-[180px]">
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
                        {headerAction}
                    </AdminToolbar>
                </CardHeader>

                <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <Table containerClassName="h-full min-h-0 rounded-md border" className="w-full">
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-[100px]">Метод</TableHead>
                                <TableHead>Путь</TableHead>
                                <TableHead>Описание</TableHead>
                                <TableHead className="w-[100px] text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <AdminTableSkeleton columns={4} />
                            ) : filteredPermissions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">Роуты не найдены по заданным фильтрам.</TableCell>
                                </TableRow>
                            ) : (
                                filteredPermissions.map((p) => (
                                        <TableRow key={p.id} className="text-xs">
                                            <TableCell>
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-muted">
                          {p.method}
                        </span>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate font-mono">{p.route_path}</TableCell>
                                            <TableCell className="text-muted-foreground">{p.description || '—'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        disabled={!canUpdate}
                                                        onClick={() => { setActivePermission(p); setDialogType('edit'); }}
                                                        title={canUpdate ? "Редактировать описание" : "Редактирование ограничено"}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn("h-8 w-8", canDelete ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/40")}
                                                        disabled={!canDelete}
                                                        onClick={() => { setActivePermission(p); setDialogType('delete'); }}
                                                        title={canDelete ? "Удалить роут из системы" : "Удаление ограничено"}
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
                </CardContent>
            </Card>

            <EditPermissionDialog
                isOpen={dialogType === 'edit'}
                permission={activePermission}
                onClose={() => setDialogType(null)}
                onSave={handleUpdate}
            />

            <ConfirmDialog
                open={dialogType === 'delete'}
                title="Удалить защищаемый роут?"
                description={
                    activePermission
                        ? `${activePermission.method} ${activePermission.route_path} будет удалён из каталога прав.`
                        : "Запись будет удалена из каталога прав."
                }
                confirmLabel="Удалить"
                isPending={isDeleting}
                onConfirm={handleDelete}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) {
                        setDialogType(null);
                    }
                }}
            />
        </>
    );
}
