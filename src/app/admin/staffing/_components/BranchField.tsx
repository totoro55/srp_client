"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { StaffingBranch } from "@/services/staffing";

export function BranchField({
    branches,
    selectedIds,
    onChange,
    className,
}: {
    branches: StaffingBranch[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<string[]>([]);
    const groups = useMemo(() => groupByTerritory(branches), [branches]);
    const selected = useMemo(() => new Set(selectedIds.map((id) => id.toLowerCase())), [selectedIds]);
    const needle = search.trim().toLowerCase();

    function emit(next: Set<string>) {
        if (next.size === 0 || next.size === branches.length) {
            onChange([]);
            return;
        }
        onChange(branches.filter((branch) => next.has(branch.id.toLowerCase())).map((branch) => branch.id));
    }

    function toggleBranch(id: string) {
        const next = new Set(selected);
        const key = id.toLowerCase();
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        emit(next);
    }

    function toggleGroup(group: TerritoryGroup) {
        const next = new Set(selected);
        const all = group.branches.every((branch) => next.has(branch.id.toLowerCase()));
        for (const branch of group.branches) {
            if (all) {
                next.delete(branch.id.toLowerCase());
            } else {
                next.add(branch.id.toLowerCase());
            }
        }
        emit(next);
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                    setExpanded(groups
                        .filter((group) => group.branches.some((branch) => selected.has(branch.id.toLowerCase())))
                        .map((group) => group.key));
                    return;
                }
                setSearch("");
            }}
        >
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        id="staffing-branch"
                        variant="outline"
                        className={cn("w-full justify-between px-2 font-normal sm:px-2.5", className)}
                    >
                        <span className="min-w-0 truncate">{caption(selectedIds, groups)}</span>
                        <ChevronDown className="text-muted-foreground" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
                <div className="border-b p-2">
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                            }
                        }}
                        placeholder="РРС или филиал"
                        aria-label="РРС или филиал"
                        className="h-8"
                    />
                </div>
                <div className="max-h-80 overflow-y-auto py-1">
                    {needle || selectedIds.length === 0 ? null : (
                        <button
                            type="button"
                            className="w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                            onClick={() => onChange([])}
                        >
                            Сбросить выбор
                        </button>
                    )}
                    {groups.map((group) => {
                        const visible = visibleBranches(group, needle);
                        if (visible.length === 0) {
                            return null;
                        }
                        const chosen = group.branches.filter((branch) => selected.has(branch.id.toLowerCase())).length;
                        const opened = needle.length > 0 || expanded.includes(group.key);
                        return (
                            <div key={group.key}>
                                <div className="flex items-center gap-1 pr-2">
                                    <button
                                        type="button"
                                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                                        aria-label={opened ? "Свернуть" : "Развернуть"}
                                        onClick={() => setExpanded((current) =>
                                            current.includes(group.key)
                                                ? current.filter((key) => key !== group.key)
                                                : [...current, group.key],
                                        )}
                                    >
                                        {opened ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                    </button>
                                    <CheckRow
                                        className="min-w-0 flex-1 px-0"
                                        checked={chosen === group.branches.length && chosen > 0}
                                        indeterminate={chosen > 0 && chosen < group.branches.length}
                                        label={group.name}
                                        onCheckedChange={() => toggleGroup(group)}
                                    />
                                </div>
                                {opened ? visible.map((branch) => (
                                    <CheckRow
                                        key={branch.id}
                                        className="pr-2 pl-8"
                                        checked={selected.has(branch.id.toLowerCase())}
                                        label={branch.name}
                                        onCheckedChange={() => toggleBranch(branch.id)}
                                    />
                                )) : null}
                            </div>
                        );
                    })}
                    {groups.every((group) => visibleBranches(group, needle).length === 0) ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</p>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function CheckRow({
    checked,
    indeterminate = false,
    label,
    onCheckedChange,
    className,
}: {
    checked: boolean;
    indeterminate?: boolean;
    label: string;
    onCheckedChange: () => void;
    className?: string;
}) {
    return (
        <Label className={cn("rounded-md px-2 py-1.5 font-normal hover:bg-muted", className)}>
            <Checkbox
                checked={checked}
                indeterminate={indeterminate}
                onCheckedChange={onCheckedChange}
            />
            <span className="min-w-0 truncate">{label}</span>
        </Label>
    );
}

interface TerritoryGroup {
    key: string;
    id: string;
    name: string;
    branches: StaffingBranch[];
}

function groupByTerritory(branches: StaffingBranch[]): TerritoryGroup[] {
    const groups = new Map<string, TerritoryGroup>();
    for (const branch of branches) {
        const key = branch.territoryId.toLowerCase() || branch.territoryName;
        const group = groups.get(key) ?? { key, id: branch.territoryId, name: branch.territoryName, branches: [] };
        group.branches.push(branch);
        groups.set(key, group);
    }
    return [...groups.values()];
}

function visibleBranches(group: TerritoryGroup, needle: string): StaffingBranch[] {
    if (!needle) {
        return group.branches;
    }
    if (group.name.toLowerCase().includes(needle)) {
        return group.branches;
    }
    return group.branches.filter((branch) => branch.name.toLowerCase().includes(needle));
}

function caption(ids: string[], groups: TerritoryGroup[]): string {
    if (ids.length === 0) {
        return "Филиал не выбран";
    }
    if (ids.length === 1) {
        const only = ids[0]?.toLowerCase();
        return groups.flatMap((group) => group.branches).find((branch) => branch.id.toLowerCase() === only)?.name ?? "1 филиал";
    }
    const selected = new Set(ids.map((id) => id.toLowerCase()));
    const full = groups.filter((group) => group.branches.length > 0 && group.branches.every((branch) => selected.has(branch.id.toLowerCase())));
    const covered = full.reduce((sum, group) => sum + group.branches.length, 0);
    if (covered === ids.length && full.length === 1) {
        return full[0]?.name ?? "РРС";
    }
    if (covered === ids.length) {
        return `РРС: ${full.length}`;
    }
    return `Филиалы: ${ids.length}`;
}
