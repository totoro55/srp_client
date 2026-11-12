'use client';

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { RoleMultiSelect } from "./RoleMultiSelect";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";

interface Role { id: number; name: string; }

interface MatrixToolbarProps {
    roles: Role[];
    groups: string[];
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedRoleIds: number[];
    group: string;
    onGroupChange: (value: string) => void;
    onToggleRole: (roleId: number) => void;
    onClearFilters: () => void;
}

export function MatrixToolbar({
    roles,
    groups,
    searchQuery,
    onSearchChange,
    selectedRoleIds,
    group,
    onGroupChange,
    onToggleRole,
    onClearFilters
}: MatrixToolbarProps) {
    const filtersActive = Boolean(searchQuery || group || selectedRoleIds.length > 0);
    return (
        <AdminToolbar
            search={searchQuery}
            onSearchChange={onSearchChange}
            searchPlaceholder="Код, название или описание"
        >
            {filtersActive ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Сбросить фильтры"
                    title="Сбросить фильтры"
                    className="size-9 shrink-0"
                    onClick={() => {
                        onSearchChange("");
                        onGroupChange("");
                        onClearFilters();
                    }}
                >
                    <X />
                </Button>
            ) : null}
            <select
                value={group}
                onChange={(event) => onGroupChange(event.target.value)}
                aria-label="Группа"
                className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-40"
            >
                <option value="">Все группы</option>
                {groups.map((item) => (
                    <option key={item} value={item}>{item}</option>
                ))}
            </select>
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
