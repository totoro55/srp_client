'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { MatrixToolbar } from './MatrixToolbar';
import { AdminTableSkeleton } from '@/app/admin/_components/AdminTableSkeleton';

interface Role { id: number; name: string; description?: string | null; isSystem?: boolean }
interface Permission { code: string; group: string; title: string; description?: string }
interface Relation { role_id: number; permission_code: string }

interface MatrixGridProps {
    roles: Role[];
    permissions: Permission[];
    relations: Relation[];
    isLoading?: boolean;
    canWrite?: boolean;
    onTogglePermission: (roleId: number, permissionCode: string, checked: boolean) => Promise<void>;
}

export function MatrixGrid({ roles, permissions, relations, isLoading = false, canWrite = false, onTogglePermission }: MatrixGridProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [group, setGroup] = useState("");
    const [loadingKeys, setLoadingKeys] = useState<string[]>([]);
    const groups = useMemo(
        () => [...new Set(permissions.map((permission) => permission.group))],
        [permissions]
    );

    const filteredPermissions = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        return permissions.filter((permission) => {
            if (group && permission.group !== group) return false;
            if (!needle) return true;
            return permission.code.toLowerCase().includes(needle)
                || permission.title.toLowerCase().includes(needle)
                || permission.group.toLowerCase().includes(needle)
                || (permission.description?.toLowerCase().includes(needle) ?? false);
        });
    }, [permissions, searchQuery, group]);

    // 2. Фильтрация столбцов-ролей по выбранным id
    const filteredRoles = useMemo(() => {
        if (selectedRoleIds.length === 0) return roles;
        return roles.filter(r => selectedRoleIds.includes(r.id));
    }, [roles, selectedRoleIds]);

    const isChecked = (role: Role, permissionCode: string) => {
        if (role.isSystem) return true;
        return relations.some((rel) => rel.role_id === role.id && rel.permission_code === permissionCode);
    };

    const handleCheckboxChange = async (roleId: number, permissionCode: string, checked: boolean) => {
        const key = `${roleId}-${permissionCode}`;
        setLoadingKeys(prev => [...prev, key]);
        try { await onTogglePermission(roleId, permissionCode, checked); } finally {
            setLoadingKeys(prev => prev.filter(k => k !== key));
        }
    };

    const handleToggleRole = (roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    };

    return (
        <Card className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="shrink-0">
                <MatrixToolbar
                    roles={roles}
                    groups={groups}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedRoleIds={selectedRoleIds}
                    group={group}
                    onGroupChange={setGroup}
                    onToggleRole={handleToggleRole}
                    onClearFilters={() => setSelectedRoleIds([])}
                />
            </CardHeader>

            <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <Table containerClassName="h-full min-h-0 rounded-md border" className="w-full min-w-[640px]">
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[320px] min-w-[280px]">Код доступа</TableHead>
                            {isLoading
                                ? Array.from({ length: 3 }, (_, index) => (
                                    <TableHead key={index} className="min-w-[120px] text-center">
                                        <Skeleton className="mx-auto h-4 w-16" />
                                    </TableHead>
                                ))
                                : filteredRoles.map(role => (
                                    <TableHead key={role.id} className="text-center min-w-[120px] max-w-[180px] truncate" title={role.description ?? undefined}>
                                        {role.name}
                                    </TableHead>
                                ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <AdminTableSkeleton columns={4} rows={10} />
                        ) : filteredPermissions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={filteredRoles.length + 1} className="py-10 text-center text-xs text-muted-foreground">
                                    Роли и права не найдены по заданным фильтрам.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPermissions.map(perm => (
                                    <TableRow key={perm.code} className="hover:bg-muted/30">
                                        <TableCell className="align-middle py-3">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[11px] text-muted-foreground">{perm.group}</span>
                                                    <span className="truncate text-xs font-medium">{perm.title}</span>
                                                </div>
                                                {perm.description && <span className="text-[11px] text-muted-foreground truncate" title={perm.description}>{perm.description}</span>}
                                            </div>
                                        </TableCell>
                                        {filteredRoles.map(role => {
                                            const key = `${role.id}-${perm.code}`;
                                            const locked = Boolean(role.isSystem);
                                            return (
                                                <TableCell key={role.id} className="text-center align-middle py-3">
                                                    <div className="flex items-center justify-center">
                                                        <Checkbox
                                                            checked={isChecked(role, perm.code)}
                                                            disabled={!canWrite || locked || loadingKeys.includes(key)}
                                                            title={locked ? "Полный доступ администратора" : undefined}
                                                            onCheckedChange={(checked) => {
                                                                if (locked) return;
                                                                void handleCheckboxChange(role.id, perm.code, !!checked);
                                                            }}
                                                            className="h-4 w-4 transition-transform data-[state=checked]:scale-105"
                                                        />
                                                    </div>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
            </CardContent>
        </Card>
    );
}
