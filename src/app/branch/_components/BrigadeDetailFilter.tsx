"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface BrigadeMemberOption {
    id: string;
    name: string;
}

export function useBrigadeMemberFilter(members: readonly BrigadeMemberOption[] | undefined) {
    const list = members ?? [];
    const key = list.map((member) => member.id).join("|");
    const [storedKey, setStoredKey] = useState(key);
    const [selected, setSelected] = useState<string[]>(() => list.map((member) => member.id));
    if (storedKey !== key) {
        setStoredKey(key);
        setSelected(list.map((member) => member.id));
    }
    function toggle(id: string) {
        setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    }
    function allows(employeeId?: string) {
        if (list.length === 0 || !employeeId) {
            return true;
        }
        return selected.includes(employeeId);
    }
    return { members: list, selected, toggle, allows, active: list.length > 0 };
}

export function BrigadeMemberFilter({
    members,
    selected,
    onToggle,
    className,
}: {
    members: readonly BrigadeMemberOption[];
    selected: readonly string[];
    onToggle: (id: string) => void;
    className?: string;
}) {
    if (members.length === 0) {
        return null;
    }
    const narrowed = selected.length !== members.length;
    const label = narrowed ? `Сотрудники: ${selected.length} из ${members.length}` : "Сотрудники";
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="icon-sm" aria-label={label} className={cn("shrink-0", narrowed && "text-primary", className)}>
                        <Users />
                    </Button>
                }
            />
            <PopoverContent align="start" className="flex max-h-80 w-72 flex-col gap-2 overflow-y-auto p-2">
                {members.map((member) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <Checkbox checked={selected.includes(member.id)} onCheckedChange={() => onToggle(member.id)} />
                        <span className="min-w-0 truncate">{member.name}</span>
                    </label>
                ))}
            </PopoverContent>
        </Popover>
    );
}

export function brigadePerson(name?: string): string {
    return name ? `${name} · ` : "";
}
