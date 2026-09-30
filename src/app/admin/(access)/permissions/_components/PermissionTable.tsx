'use client';

import { Permission } from '@/types/api';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminTableSkeleton } from '@/app/admin/_components/AdminTableSkeleton';
import { AdminToolbar } from '@/app/admin/_components/AdminToolbar';
import { useMemo, useState } from 'react';

interface PermissionTableProps {
    permissions: Permission[];
    isLoading?: boolean;
}

export function PermissionTable({ permissions, isLoading = false }: PermissionTableProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPermissions = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return permissions.filter((permission) =>
            permission.code.toLowerCase().includes(query) ||
            permission.title.toLowerCase().includes(query) ||
            (permission.description ?? '').toLowerCase().includes(query)
        );
    }, [permissions, searchQuery]);

    return (
        <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0">
                <AdminToolbar
                    search={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="Поиск по коду или описанию..."
                />
            </CardHeader>
            <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Table containerClassName="h-full min-h-0 rounded-md border" className="w-full">
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[220px]">Код</TableHead>
                            <TableHead>Название</TableHead>
                            <TableHead>Описание</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <AdminTableSkeleton columns={3} />
                        ) : filteredPermissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-10 text-center text-xs text-muted-foreground">
                                    Права не найдены по заданным фильтрам.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPermissions.map((permission) => (
                                <TableRow key={permission.id} className="text-xs">
                                    <TableCell className="font-mono">{permission.code}</TableCell>
                                    <TableCell className="font-semibold">{permission.title}</TableCell>
                                    <TableCell className="text-muted-foreground">{permission.description || '—'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
