"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown, ListFilter, RotateCcw, Search, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchStore } from "./branch-store";
import { BranchPeriodField, useBranchLocation } from "./BranchFrame";
import {
    branchMonth,
    brigadeName,
    employeesOf,
    fixedPremium,
    inCalculation,
    indicatorPremiums,
    payFacts,
    PREMIUM_INDICATORS,
    roleCaption,
    SERVICE_INDICATORS,
    servicePremiums,
    totalPremium,
    withBranchQuery,
    type PremiumIndicatorId,
    type ServiceIndicatorId,
} from "./mock";

type BonusColumn = "name" | "role" | "brigade" | "schedule" | "timesheet" | "salary" | "fixed" | "current" | "forecast" | "total" | PremiumIndicatorId | ServiceIndicatorId;
type SortDirection = "asc" | "desc";
type BonusSort = { key: BonusColumn; direction: SortDirection };

interface BonusRow {
    employee: ReturnType<typeof employeesOf>[number];
    roleId: string | null;
    role: string;
    pay: ReturnType<typeof payFacts>;
    fixed: number;
    premiums: ReturnType<typeof indicatorPremiums>;
    services: ReturnType<typeof servicePremiums>;
    total: number;
    brigade: string | null;
}

const TEXT_COLUMNS = new Set<BonusColumn>(["name", "role", "brigade"]);
const HEAD_TONE: Record<"name" | "role" | "base" | "fixed" | "current" | "forecast" | "total" | "basket" | "service", string> = {
    name: "bg-amber-100 text-amber-950 shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--color-amber-100)] dark:bg-amber-950 dark:text-amber-50 dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--color-amber-950)]",
    role: "bg-rose-100 text-rose-950 shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--color-rose-100),4px_0_8px_-4px_rgba(0,0,0,0.28)] dark:bg-rose-950 dark:text-rose-50 dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--color-rose-950),4px_0_8px_-4px_rgba(0,0,0,0.28)]",
    base: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    fixed: "bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50",
    current: "bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-50",
    forecast: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    total: "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-50",
    basket: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    service: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-50",
};

function headTone(column: BonusColumn): string | undefined {
    if (column === "name") {
        return HEAD_TONE.name;
    }
    if (column === "role") {
        return HEAD_TONE.role;
    }
    if (column === "schedule" || column === "timesheet" || column === "salary") {
        return HEAD_TONE.base;
    }
    if (column === "fixed") {
        return HEAD_TONE.fixed;
    }
    if (column === "current") {
        return HEAD_TONE.current;
    }
    if (column === "forecast") {
        return HEAD_TONE.forecast;
    }
    if (column === "total") {
        return HEAD_TONE.total;
    }
    if (PREMIUM_INDICATORS.some((indicator) => indicator.id === column)) {
        return HEAD_TONE.basket;
    }
    if (SERVICE_INDICATORS.some((indicator) => indicator.id === column)) {
        return HEAD_TONE.service;
    }
    return undefined;
}

function payRatio(values: number[], value: number): number {
    if (values.length <= 1) {
        return 0.5;
    }
    let lower = 0;
    let same = 0;
    for (const item of values) {
        if (item < value) {
            lower += 1;
        } else if (item === value) {
            same += 1;
        }
    }
    return (lower + (same - 1) / 2) / (values.length - 1);
}

function payHeat(ratio: number): { backgroundColor: string } {
    const t = Math.min(1, Math.max(0, (ratio - 0.08) / 0.72));
    const eased = t * t * (3 - 2 * t);
    const hue = 20 + eased * 145;
    const strength = 42 + eased * 28;
    return { backgroundColor: `color-mix(in oklab, oklch(0.64 0.21 ${hue.toFixed(1)}) ${strength.toFixed(0)}%, var(--background))` };
}
const CELL = "border-r border-b border-border px-1.5 py-1 shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent] [@media(max-height:500px)]:py-0.5";
const EDGE = "border-r-2";
const SHORTFALL = "font-medium text-amber-700 dark:text-amber-300";
const ROLE_MARK: Record<string, string> = {
    "УСМ": "bg-muted text-foreground",
    "СВМ": "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    "Кладовщик": "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    "Мерчендайзер": "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    "Без подписи": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};
const NAME_COL = "w-[10.5rem] min-w-[10.5rem] max-w-[10.5rem]";
const ROLE_COL = "w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem]";
const HOUR_COL = "w-[5.75rem] min-w-[5.75rem] tabular-nums";
const MONEY_COL = "w-[7.75rem] min-w-[7.75rem] tabular-nums";
const PIN_NAME = "sticky left-0 z-20 border-l bg-background shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--background)]";
const PIN_ROLE = "sticky left-[10.5rem] z-20 bg-background shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_transparent,1px_0_0_0_var(--background),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const AIM_COL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent)]";
const AIM_ROW = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent)]";
const AIM_CELL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent)]";
const AIM_NAME_COL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background)]";
const AIM_NAME_ROW = "shadow-[inset_2px_0_0_0_color-mix(in_oklab,var(--foreground)_20%,transparent),inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background)]";
const AIM_NAME_CELL = "shadow-[inset_2px_0_0_0_color-mix(in_oklab,var(--foreground)_20%,transparent),inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background)]";
const AIM_ROLE = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const AIM_ROLE_ROW = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const AIM_ROLE_CELL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--background),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const AIM_NAME_HEAD = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-amber-100)] dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-amber-950)]";
const AIM_NAME_HEAD_CELL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-amber-100)] dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-amber-950)]";
const AIM_ROLE_HEAD = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-rose-100),4px_0_8px_-4px_rgba(0,0,0,0.28)] dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-rose-950),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const AIM_ROLE_HEAD_CELL = "shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-rose-100),4px_0_8px_-4px_rgba(0,0,0,0.28)] dark:shadow-[inset_2px_0_0_0_transparent,inset_0_-2px_0_0_transparent,inset_0_0_0_2px_transparent,inset_0_0_0_999px_color-mix(in_oklab,var(--foreground)_5%,transparent),1px_0_0_0_var(--color-rose-950),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const PIN_NAME_HEAD = "sticky left-0 z-30 border-l bg-card shadow-[1px_0_0_0_var(--card)]";
const PIN_ROLE_HEAD = "sticky left-[10.5rem] z-30 bg-card shadow-[1px_0_0_0_var(--card),4px_0_8px_-4px_rgba(0,0,0,0.28)]";
const BASKET_LAST = PREMIUM_INDICATORS[PREMIUM_INDICATORS.length - 1].id;
const SERVICE_LAST = SERVICE_INDICATORS[SERVICE_INDICATORS.length - 1].id;
const WASH_BASE = "bg-[color-mix(in_oklab,var(--color-sky-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-sky-950)_62%,var(--background))]";
const WASH_FIXED = "bg-[color-mix(in_oklab,var(--color-indigo-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-indigo-950)_62%,var(--background))]";
const WASH_TOTAL = "bg-[color-mix(in_oklab,var(--color-fuchsia-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-fuchsia-950)_62%,var(--background))]";
const WASH_BASKET = "bg-[color-mix(in_oklab,var(--color-violet-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-violet-950)_62%,var(--background))]";
const WASH_SERVICE = "bg-[color-mix(in_oklab,var(--color-orange-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-orange-950)_62%,var(--background))]";

function endsGroup(column: BonusColumn): boolean {
    return column === "name"
        || column === "role"
        || column === "brigade"
        || column === "salary"
        || column === "fixed"
        || column === "current"
        || column === "forecast"
        || column === "total"
        || column === BASKET_LAST
        || column === SERVICE_LAST;
}

function bodyWash(column: BonusColumn): string | undefined {
    if (column === "schedule" || column === "timesheet" || column === "salary") {
        return WASH_BASE;
    }
    if (column === "fixed") {
        return WASH_FIXED;
    }
    if (column === "total") {
        return WASH_TOTAL;
    }
    if (PREMIUM_INDICATORS.some((indicator) => indicator.id === column)) {
        return WASH_BASKET;
    }
    if (SERVICE_INDICATORS.some((indicator) => indicator.id === column)) {
        return WASH_SERVICE;
    }
    return undefined;
}

function timesheetIsShort(scheduleHours: number, timesheetHours: number): boolean {
    return timesheetHours < scheduleHours;
}

function dataClass(column: BonusColumn, value?: number): string {
    const hours = column === "schedule" || column === "timesheet";
    const text = column === "name" || column === "role" || column === "brigade";
    const heat = column === "current" || column === "forecast";
    return cn(
        CELL,
        endsGroup(column) && EDGE,
        !heat && (bodyWash(column) ?? "bg-background"),
        column === "name" && cn(PIN_NAME, NAME_COL, "font-medium whitespace-nowrap"),
        column === "role" && cn(PIN_ROLE, ROLE_COL),
        hours && HOUR_COL,
        !text && !hours && MONEY_COL,
        !text && "text-center tabular-nums",
        value === 0 && "text-muted-foreground",
    );
}

type CellHover = { row: string; column: number };
type AimPin = "name" | "role" | "name-head" | "role-head";
const HEAD_ROW = "head";

function columnIndex(column: BonusColumn, brigadeOn: boolean): number {
    const order: BonusColumn[] = [
        "name",
        "role",
        ...(brigadeOn ? ["brigade" as const] : []),
        "schedule",
        "timesheet",
        "salary",
        "fixed",
        "current",
        "forecast",
        "total",
        ...PREMIUM_INDICATORS.map((indicator) => indicator.id),
        ...SERVICE_INDICATORS.map((indicator) => indicator.id),
    ];
    return order.indexOf(column);
}

function aimClass(hover: CellHover | null, row: string, column: number, pin?: AimPin): string | undefined {
    if (!hover || (hover.row !== row && hover.column !== column)) {
        return undefined;
    }
    const active = hover.row === row && hover.column === column;
    if (pin === "name") {
        if (active) {
            return AIM_NAME_CELL;
        }
        return hover.row === row ? AIM_NAME_ROW : AIM_NAME_COL;
    }
    if (pin === "role") {
        if (active) {
            return AIM_ROLE_CELL;
        }
        return hover.row === row ? AIM_ROLE_ROW : AIM_ROLE;
    }
    if (pin === "name-head") {
        return active ? AIM_NAME_HEAD_CELL : AIM_NAME_HEAD;
    }
    if (pin === "role-head") {
        return active ? AIM_ROLE_HEAD_CELL : AIM_ROLE_HEAD;
    }
    if (active) {
        return AIM_CELL;
    }
    return hover.row === row ? AIM_ROW : AIM_COL;
}

export function BranchBonuses() {
    const router = useRouter();
    const { branchId, period } = useBranchLocation();
    const store = useBranchStore();
    const [query, setQuery] = useState("");
    const [roles, setRoles] = useState<string[]>([]);
    const [brigades, setBrigades] = useState<string[]>([]);
    const [sort, setSort] = useState<BonusSort>({ key: "role", direction: "desc" });
    const [hover, setHover] = useState<CellHover | null>(null);
    const tableFrame = useRef<HTMLDivElement>(null);
    const month = branchMonth(branchId, period);
    const slice = store.slice(branchId, period);
    const brigadeOn = slice.savedBrigades.mode !== "off";
    const rows = employeesOf(branchId).flatMap((employee) => {
        const roleId = slice.savedRoles[employee.id] ?? null;
        if (!inCalculation(employee, roleId)) {
            return [];
        }
        const premiums = indicatorPremiums(employee);
        const total = totalPremium(premiums);
        return [{
            employee,
            roleId,
            role: roleCaption(employee, roleId),
            services: servicePremiums(employee),
            pay: payFacts(employee, period, total),
            fixed: fixedPremium(employee),
            premiums,
            total,
            brigade: brigadeName(employee.id, slice.savedBrigades, true),
        } satisfies BonusRow];
    });
    const roleOptions = uniqueSorted(rows.map((row) => row.role));
    const brigadeOptions = uniqueSorted(rows.flatMap((row) => row.brigade ? [row.brigade] : []));
    const activeSort = sort.key === "brigade" && !brigadeOn ? { key: "role" as const, direction: "desc" as const } : sort;
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
        if (roles.length > 0 && !roles.includes(row.role)) {
            return false;
        }
        if (brigadeOn && brigades.length > 0 && !brigades.includes(row.brigade ?? "")) {
            return false;
        }
        if (!needle) {
            return true;
        }
        const haystack = `${row.employee.name} ${row.employee.title} ${row.role} ${row.brigade ?? ""}`.toLowerCase();
        return haystack.includes(needle);
    });
    const visible = filtered.slice().sort((left, right) => compareRows(left, right, activeSort));
    const currentPays = visible.map((row) => row.pay.currentPay);
    const forecastPays = visible.map((row) => row.pay.forecastPay);
    const filtersActive = needle !== "" || roles.length > 0 || (brigadeOn && brigades.length > 0);
    const columnCount = 9 + PREMIUM_INDICATORS.length + SERVICE_INDICATORS.length + (brigadeOn ? 1 : 0);

    const placeholder = !month.inMotivation
        ? "Филиал в этом месяце не участвует в мотивации."
        : !month.calculated
            ? "Расчёт за этот месяц ещё не готов."
            : null;

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 [@media(max-height:500px)]:gap-2!">
            <div className="flex shrink-0 flex-col gap-1.5 p-0.5 sm:flex-row sm:items-center sm:gap-2">
                <BranchPeriodField />
                <div className="flex min-w-0 items-center gap-1.5 sm:ml-auto sm:flex-none sm:gap-2">
                    <InputGroup className="w-auto min-w-0 flex-1 sm:w-72 sm:flex-none">
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupInput
                            value={query}
                            placeholder="Сотрудник"
                            aria-label="Сотрудник"
                            className="text-xs sm:text-sm"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        {query.trim() !== "" ? (
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton aria-label="Очистить поиск" size="icon-xs" onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery("")}>
                                    <X />
                                </InputGroupButton>
                            </InputGroupAddon>
                        ) : null}
                    </InputGroup>
                    <div className="flex shrink-0 items-center gap-1">
                        <MobileFilters
                            roleOptions={roleOptions}
                            roles={roles}
                            onToggleRole={(value) => setRoles(toggleValue(roles, value))}
                            brigadeOn={brigadeOn}
                            brigadeOptions={brigadeOptions}
                            brigades={brigades}
                            onToggleBrigade={(value) => setBrigades(toggleValue(brigades, value))}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Сбросить фильтры"
                            className="size-9"
                            disabled={!filtersActive}
                            onClick={() => {
                                setQuery("");
                                setRoles([]);
                                setBrigades([]);
                            }}
                        >
                            <RotateCcw />
                        </Button>
                        <div className="sm:hidden">
                            <SortMenu sort={activeSort} brigadeOn={brigadeOn} onSort={setSort} />
                        </div>
                    </div>
                </div>
            </div>
            {placeholder ? <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{placeholder}</p> : null}
            {placeholder ? null : <>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border sm:hidden">
                {visible.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">Никого не найдено по этим фильтрам.</p>
                ) : visible.map((row) => (
                    <BonusListItem
                        key={row.employee.id}
                        row={row}
                        brigadeOn={brigadeOn}
                        branchId={branchId}
                        period={period}
                        href={withBranchQuery(`/branch/bonuses/${row.employee.id}`, branchId, period)}
                        currentHeat={payHeat(payRatio(currentPays, row.pay.currentPay))}
                        forecastHeat={payHeat(payRatio(forecastPays, row.pay.forecastPay))}
                    />
                ))}
            </div>
            <div
                ref={tableFrame}
                className="relative hidden min-h-0 flex-1 flex-col sm:flex"
                onMouseLeave={() => setHover((current) => current === null ? current : null)}
                onWheel={() => setHover((current) => current === null ? current : null)}
            >
            <AimFrame hover={hover} root={tableFrame} />
            <Table containerClassName="min-h-0 max-w-full flex-1" className="w-max cursor-default border-separate border-spacing-0 text-xs">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <SortHead label="Сотрудник" column="name" sort={activeSort} pin={PIN_NAME_HEAD} widthClass={NAME_COL} hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Роль" column="role" sort={activeSort} pin={PIN_ROLE_HEAD} widthClass={ROLE_COL} hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        {brigadeOn ? <SortHead label="Бригада" column="brigade" sort={activeSort} hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} /> : null}
                        <SortHead label="Часов по графику" column="schedule" sort={activeSort} fit="hour" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Часов по табелю" column="timesheet" sort={activeSort} fit="hour" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Оклад" column="salary" sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Фиксированная премия" column="fixed" sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Текущая ЗП" column="current" sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Прогноз ЗП" column="forecast" sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        <SortHead label="Общая премия" column="total" sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        {PREMIUM_INDICATORS.map((indicator) => (
                            <SortHead key={indicator.id} label={indicator.title} column={indicator.id} sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        ))}
                        {SERVICE_INDICATORS.map((indicator) => (
                            <SortHead key={indicator.id} label={indicator.title} column={indicator.id} sort={activeSort} fit="money" hover={hover} brigadeOn={brigadeOn} onSort={setSort} onHover={setHover} />
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columnCount} className={cn(CELL, "border-l border-r py-10 text-center whitespace-normal text-muted-foreground")}>
                                Никого не найдено по этим фильтрам.
                            </TableCell>
                        </TableRow>
                    ) : visible.map((row) => {
                        const href = withBranchQuery(`/branch/bonuses/${row.employee.id}`, branchId, period);
                        const currentHeat = payHeat(payRatio(currentPays, row.pay.currentPay));
                        const forecastHeat = payHeat(payRatio(forecastPays, row.pay.forecastPay));
                        const timesheetShort = timesheetIsShort(row.pay.scheduleHours, row.pay.timesheetHours);
                        const rowId = row.employee.id;
                        return (
                            <TableRow key={rowId} className="hover:bg-transparent">
                                <AimedCell hover={hover} row={rowId} column={columnIndex("name", brigadeOn)} pin="name" className={dataClass("name")} onOpen={() => router.push(href)} onHover={setHover}>
                                    {row.employee.name}
                                </AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("role", brigadeOn)} pin="role" className={dataClass("role")} onHover={setHover}>
                                    <RoleLabel role={row.role} />
                                </AimedCell>
                                {brigadeOn ? <AimedCell hover={hover} row={rowId} column={columnIndex("brigade", brigadeOn)} className={dataClass("brigade")} onHover={setHover}>{row.brigade}</AimedCell> : null}
                                <AimedCell hover={hover} row={rowId} column={columnIndex("schedule", brigadeOn)} className={dataClass("schedule", row.pay.scheduleHours)} onHover={setHover}>{row.pay.scheduleHours}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("timesheet", brigadeOn)} className={cn(dataClass("timesheet", row.pay.timesheetHours), timesheetShort && SHORTFALL)} onHover={setHover}>{row.pay.timesheetHours}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("salary", brigadeOn)} className={dataClass("salary", row.pay.salary)} onHover={setHover}>{formatAmount(row.pay.salary)}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("fixed", brigadeOn)} className={dataClass("fixed", row.fixed)} onHover={setHover}>{formatAmount(row.fixed)}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("current", brigadeOn)} className={dataClass("current", row.pay.currentPay)} style={currentHeat} onHover={setHover}>{formatAmount(row.pay.currentPay)}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("forecast", brigadeOn)} className={dataClass("forecast", row.pay.forecastPay)} style={forecastHeat} onHover={setHover}>{formatAmount(row.pay.forecastPay)}</AimedCell>
                                <AimedCell hover={hover} row={rowId} column={columnIndex("total", brigadeOn)} className={dataClass("total", row.total)} onHover={setHover}>{formatAmount(row.total)}</AimedCell>
                                {PREMIUM_INDICATORS.map((indicator) => (
                                    <AimedCell
                                        key={indicator.id}
                                        hover={hover}
                                        row={rowId}
                                        column={columnIndex(indicator.id, brigadeOn)}
                                        className={dataClass(indicator.id, row.premiums[indicator.id])}
                                        onOpen={() => router.push(withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id))}
                                        onHover={setHover}
                                    >
                                        {formatAmount(row.premiums[indicator.id])}
                                    </AimedCell>
                                ))}
                                {SERVICE_INDICATORS.map((indicator) => (
                                    <AimedCell key={indicator.id} hover={hover} row={rowId} column={columnIndex(indicator.id, brigadeOn)} className={dataClass(indicator.id, row.services[indicator.id])} onHover={setHover}>{formatAmount(row.services[indicator.id])}</AimedCell>
                                ))}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            </div>
            </>}
        </div>
    );
}

function formatAmount(value: number): string {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function RoleLabel({ role }: { role: string }) {
    const tone = ROLE_MARK[role] ?? "bg-muted text-foreground";
    return <span className={cn("inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-medium", tone)}>{role}</span>;
}

function nextSort(current: BonusSort, column: BonusColumn): BonusSort {
    if (current.key === column) {
        return { key: column, direction: current.direction === "asc" ? "desc" : "asc" };
    }
    return { key: column, direction: TEXT_COLUMNS.has(column) ? "asc" : "desc" };
}

function sortColumns(brigadeOn: boolean): { key: BonusColumn; label: string }[] {
    return [
        { key: "name", label: "Сотрудник" },
        { key: "role", label: "Роль" },
        ...(brigadeOn ? [{ key: "brigade" as const, label: "Бригада" }] : []),
        { key: "schedule", label: "Часов по графику" },
        { key: "timesheet", label: "Часов по табелю" },
        { key: "salary", label: "Оклад" },
        { key: "fixed", label: "Фиксированная премия" },
        { key: "current", label: "Текущая ЗП" },
        { key: "forecast", label: "Прогноз ЗП" },
        { key: "total", label: "Общая премия" },
        ...PREMIUM_INDICATORS.map((indicator) => ({ key: indicator.id, label: indicator.title })),
        ...SERVICE_INDICATORS.map((indicator) => ({ key: indicator.id, label: indicator.title })),
    ];
}

function BonusListItem({
    row,
    brigadeOn,
    branchId,
    period,
    href,
    currentHeat,
    forecastHeat,
}: {
    row: BonusRow;
    brigadeOn: boolean;
    branchId: string;
    period: string;
    href: string;
    currentHeat: { backgroundColor: string };
    forecastHeat: { backgroundColor: string };
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const timesheetShort = timesheetIsShort(row.pay.scheduleHours, row.pay.timesheetHours);
    const details = [
        { label: "Оклад", amount: row.pay.salary },
        { label: "Фиксированная премия", amount: row.fixed },
        { label: "Текущая ЗП", amount: row.pay.currentPay, heat: currentHeat },
        { label: "Общая премия", amount: row.total },
        ...PREMIUM_INDICATORS.map((indicator) => ({
            label: indicator.title,
            amount: row.premiums[indicator.id],
            open: withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id),
        })),
        ...SERVICE_INDICATORS.map((indicator) => ({ label: indicator.title, amount: row.services[indicator.id] })),
    ];
    return (
        <Collapsible open={open} onOpenChange={setOpen} className="border-b last:border-b-0">
            <CollapsibleTrigger className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                    <span
                        role="link"
                        tabIndex={0}
                        className="block text-sm font-medium"
                        onClick={(event) => {
                            event.stopPropagation();
                            router.push(href);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                router.push(href);
                            }
                        }}
                    >
                        {row.employee.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                        <RoleLabel role={row.role} />
                        {brigadeOn && row.brigade ? <span>· {row.brigade}</span> : null}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                        график {row.pay.scheduleHours}
                        {" · табель "}
                        <span className={timesheetShort ? SHORTFALL : undefined}>{row.pay.timesheetHours}</span>
                    </span>
                </span>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-right" style={forecastHeat}>
                    <span className="block text-xs text-muted-foreground">Прогноз</span>
                    <span className="block text-sm font-medium tabular-nums">{formatAmount(row.pay.forecastPay)}</span>
                </span>
                <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <dl className="border-t px-3 py-1">
                    {details.map((item) => (
                        <div
                            key={item.label}
                            role={"open" in item && item.open ? "link" : undefined}
                            tabIndex={"open" in item && item.open ? 0 : undefined}
                            className={cn(
                                "flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1.5 text-sm",
                                "open" in item && item.open && "cursor-pointer hover:bg-muted/60",
                            )}
                            style={"heat" in item ? item.heat : undefined}
                            onClick={"open" in item && item.open ? () => router.push(item.open) : undefined}
                            onKeyDown={"open" in item && item.open ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    router.push(item.open);
                                }
                            } : undefined}
                        >
                            <dt className="text-muted-foreground">{item.label}</dt>
                            <dd className={cn("tabular-nums", item.amount === 0 && "text-muted-foreground")}>{formatAmount(item.amount)}</dd>
                        </div>
                    ))}
                </dl>
            </CollapsibleContent>
        </Collapsible>
    );
}

function MobileFilters({
    roleOptions,
    roles,
    onToggleRole,
    brigadeOn,
    brigadeOptions,
    brigades,
    onToggleBrigade,
}: {
    roleOptions: string[];
    roles: readonly string[];
    onToggleRole: (value: string) => void;
    brigadeOn: boolean;
    brigadeOptions: string[];
    brigades: readonly string[];
    onToggleBrigade: (value: string) => void;
}) {
    const active = roles.length > 0 || (brigadeOn && brigades.length > 0);
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="icon" aria-label="Фильтр" className={cn("size-9", active && "text-primary")}>
                        <ListFilter />
                    </Button>
                }
            />
            <PopoverContent align="end" className="max-h-80 w-64 gap-3 overflow-y-auto p-2">
                <FilterOptions title="Роли" options={roleOptions} selected={roles} onToggle={onToggleRole} />
                {brigadeOn ? <FilterOptions title="Бригады" options={brigadeOptions} selected={brigades} onToggle={onToggleBrigade} /> : null}
            </PopoverContent>
        </Popover>
    );
}

function FilterOptions({
    title,
    options,
    selected,
    onToggle,
}: {
    title: string;
    options: string[];
    selected: readonly string[];
    onToggle: (value: string) => void;
}) {
    return (
        <div className="flex flex-col gap-1">
            <p className="px-2 text-xs font-medium text-muted-foreground">{title}</p>
            {options.map((option) => (
                <Label key={option} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                    <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
                    <span className="truncate">{option}</span>
                </Label>
            ))}
        </div>
    );
}

function SortMenu({ sort, brigadeOn, onSort }: { sort: BonusSort; brigadeOn: boolean; onSort: (sort: BonusSort) => void }) {
    const columns = sortColumns(brigadeOn);
    const current = columns.find((column) => column.key === sort.key) ?? columns[0];
    const mark = sort.direction === "asc" ? "↑" : "↓";
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="icon" aria-label={`Сортировка: ${current.label} ${mark}`} className="size-9">
                        <ArrowUpDown />
                    </Button>
                }
            />
            <PopoverContent align="end" className="max-h-80 w-64 gap-0 overflow-y-auto p-1">
                {columns.map((column) => {
                    const active = sort.key === column.key;
                    return (
                        <button
                            key={column.key}
                            type="button"
                            className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", active && "bg-muted")}
                            onClick={() => onSort(nextSort(sort, column.key))}
                        >
                            <span>{column.label}</span>
                            {active ? <span aria-hidden="true">{mark}</span> : null}
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

const AIM_FADE_MS = 160;
const AIM_BORDER = "color-mix(in oklab, var(--foreground) 80%, transparent)";
const AIM_FILL = "color-mix(in oklab, var(--foreground) 6%, transparent)";

function AimFrame({ hover, root }: { hover: CellHover | null; root: RefObject<HTMLDivElement | null> }) {
    const frameRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const frame = frameRef.current;
        const scope = root.current;
        if (!frame || !scope) {
            return;
        }
        if (!hover) {
            frame.style.opacity = "0";
            frame.style.borderColor = "transparent";
            frame.style.backgroundColor = "transparent";
            frame.style.transition = "none";
            return;
        }
        const cell = scope.querySelector<HTMLElement>(`[data-aim="${hover.row}:${hover.column}"]`);
        if (!cell) {
            return;
        }
        const scopeBox = scope.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        frame.style.transition = "none";
        frame.style.opacity = "1";
        frame.style.borderColor = "transparent";
        frame.style.backgroundColor = "transparent";
        frame.style.width = `${box.width}px`;
        frame.style.height = `${box.height}px`;
        frame.style.transform = `translate3d(${box.left - scopeBox.left}px, ${box.top - scopeBox.top}px, 0)`;
        frame.getBoundingClientRect();
        frame.style.transition = `border-color ${AIM_FADE_MS}ms ease-out, background-color ${AIM_FADE_MS}ms ease-out`;
        frame.style.borderColor = AIM_BORDER;
        frame.style.backgroundColor = AIM_FILL;
    }, [hover, root]);
    return (
        <div
            ref={frameRef}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-40 border-2 border-transparent bg-transparent opacity-0 motion-reduce:transition-none"
        />
    );
}

function AimedCell({
    hover,
    row,
    column,
    pin,
    className,
    style,
    onOpen,
    onHover,
    children,
}: {
    hover: CellHover | null;
    row: string;
    column: number;
    pin?: "name" | "role";
    className?: string;
    style?: { backgroundColor: string };
    onOpen?: () => void;
    onHover: (hover: CellHover) => void;
    children: ReactNode;
}) {
    return (
        <TableCell
            data-aim={`${row}:${column}`}
            className={cn(className, aimClass(hover, row, column, pin), onOpen && "cursor-pointer")}
            style={style}
            onMouseEnter={() => onHover({ row, column })}
            onClick={onOpen}
        >
            {children}
        </TableCell>
    );
}

function SortHead({
    label,
    column,
    sort,
    onSort,
    fit,
    pin,
    widthClass,
    hover,
    brigadeOn,
    onHover,
}: {
    label: string;
    column: BonusColumn;
    sort: BonusSort;
    onSort: (sort: BonusSort) => void;
    fit?: "hour" | "money";
    pin?: string;
    widthClass?: string;
    hover: CellHover | null;
    brigadeOn: boolean;
    onHover: (hover: CellHover) => void;
}) {
    const active = sort.key === column;
    const next = nextSort(sort, column);
    const mark = sort.direction === "asc" ? "↑" : "↓";
    const width = fit === "hour" ? HOUR_COL : fit === "money" ? MONEY_COL : widthClass;
    const index = columnIndex(column, brigadeOn);
    const headPin = column === "name" ? "name-head" : column === "role" ? "role-head" : undefined;
    return (
        <TableHead
            data-aim={`${HEAD_ROW}:${index}`}
            aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
            className={cn(CELL, endsGroup(column) && EDGE, "h-auto border-t text-center whitespace-normal", width, pin, headTone(column), aimClass(hover, HEAD_ROW, index, headPin))}
            onMouseEnter={() => onHover({ row: HEAD_ROW, column: index })}
        >
            <button
                type="button"
                className="relative block w-full cursor-default text-center whitespace-normal hover:text-foreground"
                onClick={() => onSort(next)}
            >
                {label}
                {active ? <span className="absolute top-0 right-0" aria-hidden="true">{mark}</span> : null}
            </button>
        </TableHead>
    );
}

function compareRows(left: BonusRow, right: BonusRow, sort: BonusSort): number {
    const primary = directedCompare(left, right, sort.key, sort.direction);
    if (primary !== 0) {
        return primary;
    }
    if (sort.key !== "role") {
        const byRole = directedCompare(left, right, "role", "desc");
        if (byRole !== 0) {
            return byRole;
        }
    }
    if (sort.key !== "forecast") {
        const byForecast = directedCompare(left, right, "forecast", "desc");
        if (byForecast !== 0) {
            return byForecast;
        }
    }
    return left.employee.name.localeCompare(right.employee.name, "ru");
}

function directedCompare(left: BonusRow, right: BonusRow, column: BonusColumn, direction: SortDirection): number {
    const factor = direction === "asc" ? 1 : -1;
    if (column === "name") {
        return left.employee.name.localeCompare(right.employee.name, "ru") * factor;
    }
    if (column === "role" || column === "brigade") {
        const leftText = column === "role" ? left.role : left.brigade ?? "";
        const rightText = column === "role" ? right.role : right.brigade ?? "";
        return leftText.localeCompare(rightText, "ru") * factor;
    }
    return (numericColumn(left, column) - numericColumn(right, column)) * factor;
}

function numericColumn(row: BonusRow, column: BonusColumn): number {
    if (column === "schedule") {
        return row.pay.scheduleHours;
    }
    if (column === "timesheet") {
        return row.pay.timesheetHours;
    }
    if (column === "salary") {
        return row.pay.salary;
    }
    if (column === "fixed") {
        return row.fixed;
    }
    if (column === "current") {
        return row.pay.currentPay;
    }
    if (column === "forecast") {
        return row.pay.forecastPay;
    }
    if (column === "total") {
        return row.total;
    }
    if (SERVICE_INDICATORS.some((indicator) => indicator.id === column)) {
        return row.services[column as ServiceIndicatorId];
    }
    return row.premiums[column as PremiumIndicatorId];
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ru"));
}

function toggleValue(current: readonly string[], value: string): string[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}
