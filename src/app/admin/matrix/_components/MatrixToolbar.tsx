'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import {RoleMultiSelect} from "@/app/admin/_componenets/RoleMultiSelect";

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
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-muted/50 items-center w-full">
            <div className="relative w-full md:flex-[3.5]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    placeholder="Поиск защищаемого пути, метода или описания..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 pr-9 w-full h-9 text-xs bg-muted/10 focus-visible:bg-background transition-colors rounded-md"
                />
                {searchQuery && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => onSearchChange('')} className="absolute right-1 top-1 h-7 w-7 text-muted-foreground rounded-md">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="w-full md:flex-1 min-w-[220px] shrink-0">
                <RoleMultiSelect
                    roles={roles}
                    selectedRoleIds={selectedRoleIds}
                    onToggleRole={onToggleRole}
                    onClearFilters={onClearFilters}
                    triggerText="Фильтр ролей (Столбцы)"
                />
            </div>
        </div>
    );
}
