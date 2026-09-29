'use client';

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { RoleMultiSelect } from "@/app/admin/_componenets/RoleMultiSelect";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";

interface Role { id: number; name: string; }

interface MatrixToolbarProps {
    roles: Role[];
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedRoleIds: number[];
    onToggleRole: (roleId: number) => void;
    onClearFilters: () => void;
}

export function MatrixToolbar({
    roles,
    searchQuery,
    onSearchChange,
    selectedRoleIds,
    onToggleRole,
    onClearFilters
}: MatrixToolbarProps) {
    return (
        <AdminToolbar
            search={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="Поиск пути, метода или описания..."
        >
            {searchQuery ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onSearchChange('')} className="h-9 text-xs">
                    <X className="h-4 w-4" />
                    Сбросить
                </Button>
            ) : null}
            <div className="w-full min-w-[200px] sm:w-[220px]">
                <RoleMultiSelect
                    roles={roles}
                    selectedRoleIds={selectedRoleIds}
                    onToggleRole={onToggleRole}
                    onClearFilters={onClearFilters}
                    triggerText="Фильтр ролей"
                />
            </div>
        </AdminToolbar>
    );
}
