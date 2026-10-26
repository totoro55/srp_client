"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LookupSkeleton } from "@/components/loading-state";

export interface RoleOption {
    id: number;
    name: string;
}

export function RolePicker({
    roles,
    rolesError,
    selected,
    disabled,
    onChange,
}: {
    roles: RoleOption[] | null;
    rolesError: string | null;
    selected: number[];
    disabled: boolean;
    onChange: (roleIds: number[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const visible = useMemo(() => {
        const list = roles ?? [];
        const needle = query.trim().toLowerCase();
        if (!needle) return list;
        return list.filter((role) => role.name.toLowerCase().includes(needle));
    }, [query, roles]);
    const allIds = (roles ?? []).map((role) => role.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
    const label = selected.length === 0 ? "Не выбраны" : allSelected ? "Все роли" : `Выбрано: ${selected.length}`;

    return (
        <Popover open={open} onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
        }}>
            <PopoverTrigger
                render={<Button type="button" variant="outline" size="sm" className="w-fit">{label}</Button>}
            />
            <PopoverContent className="w-80 gap-2 p-3" align="start">
                <Input
                    value={query}
                    placeholder="Найти роль"
                    aria-label="Найти роль"
                    onChange={(event) => setQuery(event.target.value)}
                />
                {roles && !rolesError && roles.length > 0 ? (
                    <label className="flex items-center gap-2 border-b pb-2 text-sm">
                        <Checkbox
                            checked={allSelected}
                            disabled={disabled}
                            aria-label="Выбрать все роли"
                            onCheckedChange={(value) => onChange(value === true ? allIds : [])}
                        />
                        <span>Все</span>
                    </label>
                ) : null}
                <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
                    {roles === null ? <LookupSkeleton rows={3} lines={1} /> : null}
                    {rolesError ? <p className="text-sm text-destructive">{rolesError}</p> : null}
                    {roles && !rolesError && visible.length === 0 ? <p className="text-sm text-muted-foreground">Ролей не найдено.</p> : null}
                    {visible.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={selected.includes(role.id)}
                                disabled={disabled}
                                aria-label={role.name}
                                onCheckedChange={(value) => {
                                    onChange(value === true
                                        ? [...selected, role.id]
                                        : selected.filter((id) => id !== role.id));
                                }}
                            />
                            <span className="min-w-0 flex-1 truncate">{role.name}</span>
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
