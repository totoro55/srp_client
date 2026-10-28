"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    FEEDBACK_CATEGORIES,
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_KINDS,
    FEEDBACK_KIND_LABELS,
    FEEDBACK_STATUS_LABELS,
    FEEDBACK_STATUSES,
    type FeedbackStatus,
} from "@/lib/content";

export const OPEN_STATUSES: FeedbackStatus[] = ["new", "progress", "waiting"];
const KIND_OPTIONS = [...FEEDBACK_KINDS, "none"] as const;
const CATEGORY_OPTIONS = [...FEEDBACK_CATEGORIES, "none"] as const;
export type KindOption = (typeof KIND_OPTIONS)[number];
export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

export function sameMembers(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && right.every((item) => left.includes(item));
}

function toggleValue<T extends string>(current: readonly T[], value: T): T[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function countLabel(count: number, forms: [string, string, string]): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const form = mod10 === 1 && mod100 !== 11
        ? forms[0]
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? forms[1]
            : forms[2];
    return `${count} ${form}`;
}

function statusSummary(selected: readonly FeedbackStatus[]): string {
    if (selected.length === 0 || sameMembers(selected, FEEDBACK_STATUSES)) {
        return "Все состояния";
    }
    if (sameMembers(selected, OPEN_STATUSES)) {
        return "Незавершенные";
    }
    if (selected.length === 1) {
        return FEEDBACK_STATUS_LABELS[selected[0]];
    }
    return countLabel(selected.length, ["состояние", "состояния", "состояний"]);
}

function optionSummary(emptyLabel: string, forms: [string, string, string], selected: readonly string[], labels: Record<string, string>): string {
    if (selected.length === 0) {
        return emptyLabel;
    }
    if (selected.length === 1) {
        return labels[selected[0]] ?? emptyLabel;
    }
    return countLabel(selected.length, forms);
}

export function feedbackFiltersActive(
    query: string,
    statuses: readonly FeedbackStatus[],
    kinds: readonly string[],
    categories: readonly string[],
): boolean {
    return query.trim() !== "" || !sameMembers(statuses, OPEN_STATUSES) || kinds.length > 0 || categories.length > 0;
}

export function FeedbackFilters({
    query,
    statuses,
    kinds,
    categories,
    onQuery,
    onStatuses,
    onKinds,
    onCategories,
    onReset,
}: {
    query: string;
    statuses: FeedbackStatus[];
    kinds: KindOption[];
    categories: CategoryOption[];
    onQuery: (value: string) => void;
    onStatuses: (value: FeedbackStatus[]) => void;
    onKinds: (value: KindOption[]) => void;
    onCategories: (value: CategoryOption[]) => void;
    onReset: () => void;
}) {
    const active = feedbackFiltersActive(query, statuses, kinds, categories);
    return (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
            <InputGroup>
                <InputGroupAddon>
                    <Search />
                </InputGroupAddon>
                <InputGroupInput
                    value={query}
                    placeholder="Поиск"
                    aria-label="Поиск"
                    onChange={(event) => onQuery(event.target.value)}
                />
                {query.trim() !== "" ? (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton aria-label="Очистить поиск" size="icon-xs" onClick={() => onQuery("")}>
                            <X />
                        </InputGroupButton>
                    </InputGroupAddon>
                ) : null}
            </InputGroup>
            <div className="flex flex-wrap items-center gap-2">
                <MultiFilter
                    summary={statusSummary(statuses)}
                    options={FEEDBACK_STATUSES.map((item) => ({ value: item, label: FEEDBACK_STATUS_LABELS[item] }))}
                    selected={statuses}
                    onToggle={(value) => onStatuses(toggleValue(statuses, value))}
                />
                <MultiFilter
                    summary={optionSummary("Все виды", ["вид", "вида", "видов"], kinds, { ...FEEDBACK_KIND_LABELS, none: "Вид не указан" })}
                    options={KIND_OPTIONS.map((item) => ({ value: item, label: item === "none" ? "Не указан" : FEEDBACK_KIND_LABELS[item] }))}
                    selected={kinds}
                    onToggle={(value) => onKinds(toggleValue(kinds, value))}
                />
                <MultiFilter
                    summary={optionSummary("Все категории", ["категория", "категории", "категорий"], categories, { ...FEEDBACK_CATEGORY_LABELS, none: "Категория не указана" })}
                    options={CATEGORY_OPTIONS.map((item) => ({ value: item, label: item === "none" ? "Не указана" : FEEDBACK_CATEGORY_LABELS[item] }))}
                    selected={categories}
                    onToggle={(value) => onCategories(toggleValue(categories, value))}
                />
                {active ? (
                    <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                        Сбросить
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function MultiFilter<T extends string>({
    summary,
    options,
    selected,
    onToggle,
}: {
    summary: string;
    options: { value: T; label: string }[];
    selected: readonly T[];
    onToggle: (value: T) => void;
}) {
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="sm" className="h-9 max-w-full gap-2 font-normal">
                        <span className="truncate">{summary}</span>
                        <ChevronDown className="text-muted-foreground" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-60 gap-1 p-2">
                {options.map((option) => (
                    <Label key={option.value} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                        <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => onToggle(option.value)} />
                        <span className="truncate">{option.label}</span>
                    </Label>
                ))}
            </PopoverContent>
        </Popover>
    );
}
