'use client';

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
    id: number;
    name: string;
}

interface MatrixRolesFilterProps {
    roles: Role[];
    selectedRoleIds: number[];
    onToggleRole: (roleId: number) => void;
    onClearFilters: () => void;
}

export function MatrixRolesFilter({ roles, selectedRoleIds, onToggleRole, onClearFilters }: MatrixRolesFilterProps) {
    return (
        <Popover>
            <PopoverTrigger render={
                                 <Button variant="outline" size="sm" className="w-full h-9 justify-between border-dashed rounded-md px-3 font-normal text-xs">
                                    <div className="flex items-center gap-2 truncate">
                                        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate">Фильтр ролей</span>

                                        {selectedRoleIds.length > 0 && (
                                            <>
                                                <Separator orientation="vertical" className="mx-1 h-4" />
                                                <Badge variant="secondary" className="rounded-sm px-1 font-semibold text-[10px] sm:hidden">
                                                    {selectedRoleIds.length}
                                                </Badge>
                                                <div className="hidden space-x-1 sm:flex shrink-0">
                                                    {selectedRoleIds.length > 2 ? (
                                                        <Badge variant="secondary" className="rounded-sm px-1 font-semibold text-[10px]">
                                                            Выбрано: {selectedRoleIds.length}
                                                        </Badge>
                                                    ) : (
                                                        roles
                                                            .filter((r) => selectedRoleIds.includes(r.id))
                                                            .map((role) => (
                                                                <Badge variant="secondary" key={role.id} className="rounded-sm px-1 text-[10px] font-medium">
                                                                    {role.name}
                                                                </Badge>
                                                            ))
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </Button>
                            }>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Поиск роли..." className="text-xs h-9" />
                    <CommandList>
                        <CommandEmpty><span className="text-xs p-3 block text-muted-foreground">Роли не найдены.</span></CommandEmpty>
                        <CommandGroup>
                            {roles.map((role) => {
                                const isSelected = selectedRoleIds.includes(role.id);
                                return (
                                    <CommandItem
                                        key={role.id}
                                        onSelect={() => onToggleRole(role.id)}
                                        className="text-xs flex items-center gap-2 cursor-pointer py-2"
                                    >
                                        <div className={cn(
                                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary transition-all",
                                            isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <span className="font-medium truncate">{role.name}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>

                        {selectedRoleIds.length > 0 && (
                            <>
                                <Separator />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={onClearFilters}
                                        className="justify-center text-center text-xs text-destructive font-medium py-2 cursor-pointer hover:bg-destructive/5"
                                    >
                                        Сбросить фильтры
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
