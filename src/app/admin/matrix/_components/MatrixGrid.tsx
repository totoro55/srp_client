'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { MatrixToolbar } from './MatrixToolbar';
import { ShieldCheck } from "lucide-react";

interface Role { id: number; name: string; description?: string; }
interface Permission { id: number; route_path: string; method: string; description?: string; }
interface Relation { role_id: number; permission_id: number; }

interface MatrixGridProps {
    roles: Role[];
    permissions: Permission[];
    relations: Relation[];
    onTogglePermission: (roleId: number, permissionId: number, checked: boolean) => Promise<void>;
}

export function MatrixGrid({ roles, permissions, relations, onTogglePermission }: MatrixGridProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [loadingKeys, setLoadingKeys] = useState<string[]>([]);

    // 1. Фильтрация путей по поисковому запросу
    const filteredPermissions = useMemo(() => {
        return permissions.filter(p => {
            const pathMatches = p.route_path.toLowerCase().includes(searchQuery.toLowerCase());
            const descMatches = p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
            const methodMatches = p.method.toLowerCase().includes(searchQuery.toLowerCase());
            return pathMatches || descMatches || methodMatches;
        });
    }, [permissions, searchQuery]);

    // 2. Фильтрация столбцов-ролей по выбранным id
    const filteredRoles = useMemo(() => {
        if (selectedRoleIds.length === 0) return roles;
        return roles.filter(r => selectedRoleIds.includes(r.id));
    }, [roles, selectedRoleIds]);

    const isChecked = (roleId: number, permissionId: number) => {
        return relations.some(rel => rel.role_id === roleId && rel.permission_id === permissionId);
    };

    const handleCheckboxChange = async (roleId: number, permissionId: number, checked: boolean) => {
        const key = `${roleId}-${permissionId}`;
        setLoadingKeys(prev => [...prev, key]);
        try { await onTogglePermission(roleId, permissionId, checked); } finally {
            setLoadingKeys(prev => prev.filter(k => k !== key));
        }
    };

    const handleToggleRole = (roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    };

    return (
        <Card className="w-full min-w-0">
            <CardHeader className="flex flex-col space-y-4 pb-4">
                <div className="flex flex-row items-center justify-between w-full">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" /> Матрица доступов
                        </CardTitle>
                        <CardDescription>Управление пересечениями системных ролей и защищаемых эндпоинтов</CardDescription>
                    </div>
                </div>

                {/* 🔥 ВЫЗОВ ДЕКОМПОЗИРОВАННОЙ ПАНЕЛИ ТУЛБАРА */}
                <MatrixToolbar
                    roles={roles}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    selectedRoleIds={selectedRoleIds}
                    onToggleRole={handleToggleRole}
                    onClearFilters={() => setSelectedRoleIds([])}
                />
            </CardHeader>

            <CardContent className="w-full min-w-0 grid grid-cols-1">
                <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                    <Table className="w-full table-fixed">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[320px] min-w-[280px]">Защищаемый роут / Метод</TableHead>
                                {filteredRoles.map(role => (
                                    <TableHead key={role.id} className="text-center min-w-[120px] max-w-[180px] truncate" title={role.description}>
                                        {role.name}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPermissions.length === 0 ? (
                                <TableRow><TableCell colSpan={filteredRoles.length + 1} className="text-center text-muted-foreground py-12">Роуты не найдены.</TableCell></TableRow>
                            ) : (
                                filteredPermissions.map(perm => (
                                    <TableRow key={perm.id} className="hover:bg-muted/30">
                                        <TableCell className="align-middle py-3">
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="inline-flex shrink-0 items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-muted">{perm.method}</span>
                                                    <span className="font-mono text-xs font-semibold text-foreground truncate" title={perm.route_path}>{perm.route_path}</span>
                                                </div>
                                                {perm.description && <span className="text-[11px] text-muted-foreground truncate" title={perm.description}>{perm.description}</span>}
                                            </div>
                                        </TableCell>
                                        {filteredRoles.map(role => {
                                            const key = `${role.id}-${perm.id}`;
                                            return (
                                                <TableCell key={role.id} className="text-center align-middle py-3">
                                                    <div className="flex items-center justify-center">
                                                        <Checkbox
                                                            checked={isChecked(role.id, perm.id)}
                                                            disabled={loadingKeys.includes(key)}
                                                            onCheckedChange={(checked) => handleCheckboxChange(role.id, perm.id, !!checked)}
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
                </div>
            </CardContent>
        </Card>
    );
}
