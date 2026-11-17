"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, ChevronDown, ListFilter, RotateCcw, Search, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableSkeleton } from "@/components/loading-state";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchDirectory } from "./branch-directory";
import { useBranchStore } from "./branch-store";
import { BranchPeriodField, useBranchLocation } from "./BranchFrame";
import { EmployeeNameLine, EmployeeStatusNote, movementLabel, movementNameClass, movementValueClass } from "./EmployeeMovementMark";
import {
    brigadeName,
    inCalculation,
    roleCaption,
    SERVICE_INDICATORS,
    withBranchQuery,
    type EmployeeMovement,
    type ServiceIndicatorId,
} from "./mock";
import { currentPay, earnedPremium, fixedPremium, forecastPay, formatHours, hasTimesheetHours, monthHasEnded, roleKey, salaryFromTimesheet, segmentHref, type StaffEmployee } from "./staff";

type BonusColumn = "name" | "role" | "brigade" | "schedule" | "timesheet" | "salary" | "fixed" | "current" | "forecast" | "total" | ServiceIndicatorId | (string & {});

interface CabinetIndicator {
    id: string;
    title: string;
}

interface CabinetColumns {
    baskets: CabinetIndicator[];
    basketIds: ReadonlySet<string>;
    basketLast?: string;
}

const SERVICE_TITLES = new Set<string>(SERVICE_INDICATORS.map((indicator) => indicator.title));

function cabinetColumns(indicators: readonly CabinetIndicator[]): CabinetColumns {
    const baskets = indicators.filter((indicator) => !SERVICE_TITLES.has(indicator.title));
    return {
        baskets,
        basketIds: new Set(baskets.map((indicator) => indicator.id)),
        basketLast: baskets.at(-1)?.id,
    };
}
type SortDirection = "asc" | "desc";
type BonusSort = { key: BonusColumn; direction: SortDirection };

const DEFAULT_HIDDEN_MOVEMENTS: EmployeeMovement[] = ["dismissed", "transferred", "absent"];

function sameMovements(left: readonly EmployeeMovement[], right: readonly EmployeeMovement[]): boolean {
    return left.length === right.length && right.every((item) => left.includes(item));
}

interface StaffPay {
    scheduleHours: number | null;
    timesheetHours: number | null;
    salary: number | null;
    currentPay: number | null;
    forecastPay: number | null;
}

interface BonusRow {
    employee: StaffEmployee;
    roleId: string | null;
    role: string;
    pay: StaffPay;
    fixed: number | null;
    premiums: Record<string, number | null>;
    services: Record<ServiceIndicatorId, number | null>;
    total: number | null;
    brigade: string | null;
    brigadeKey: string;
    brigadeRank: number;
}

function blankPremiums(indicators: readonly CabinetIndicator[]): Record<string, number | null> {
    return Object.fromEntries(indicators.map((indicator) => [indicator.id, null]));
}

function rowPremiums(
    indicators: readonly CabinetIndicator[],
    byTitle: Record<string, number | undefined>,
): Record<string, number | null> {
    const premiums = blankPremiums(indicators);
    for (const indicator of indicators) {
        const amount = byTitle[indicator.title];
        if (amount !== undefined) {
            premiums[indicator.id] = amount;
        }
    }
    return premiums;
}

function blankServices(): Record<ServiceIndicatorId, number | null> {
    return Object.fromEntries(SERVICE_INDICATORS.map((indicator) => [indicator.id, null])) as Record<ServiceIndicatorId, number | null>;
}

const TEXT_COLUMNS = new Set<BonusColumn>(["name", "role", "brigade"]);
const HEAD_TONE: Record<"name" | "role" | "base" | "fixed" | "current" | "forecast" | "total" | "basket" | "service", string> = {
    name: "bg-amber-100 text-amber-950 shadow-[1px_0_0_0_var(--color-amber-100)] dark:bg-amber-950 dark:text-amber-50 dark:shadow-[1px_0_0_0_var(--color-amber-950)]",
    role: "bg-rose-100 text-rose-950 shadow-[1px_0_0_0_var(--color-rose-100),2px_0_0_0_rgba(0,0,0,0.12)] dark:bg-rose-950 dark:text-rose-50 dark:shadow-[1px_0_0_0_var(--color-rose-950),2px_0_0_0_rgba(0,0,0,0.28)]",
    base: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    fixed: "bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50",
    current: "bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-50",
    forecast: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    total: "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-50",
    basket: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    service: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-50",
};

function headTone(column: BonusColumn, columns: CabinetColumns): string | undefined {
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
    if (columns.basketIds.has(column)) {
        return HEAD_TONE.basket;
    }
    if (SERVICE_INDICATORS.some((indicator) => indicator.id === column)) {
        return HEAD_TONE.service;
    }
    return undefined;
}

/** Недобор до среднего УОТ в пределах этой суммы ещё считается «выше». */
const PAY_HEAT_TOLERANCE = 2000;

function averagePayLevel(levels: readonly (number | null | undefined)[]): number | null {
    let sum = 0;
    let count = 0;
    for (const level of levels) {
        if (level === null || level === undefined) {
            continue;
        }
        sum += level;
        count += 1;
    }
    return count === 0 ? null : sum / count;
}

/** Midrank внутри стороны: один человек — середина половины, иначе 0…1 по возрастанию. */
function sideRatioLookup(values: number[], low: number, high: number): Map<number, number> {
    const ranks = new Map<number, number>();
    if (values.length === 0) {
        return ranks;
    }
    if (values.length === 1) {
        ranks.set(values[0]!, (low + high) / 2);
        return ranks;
    }
    const sorted = values.slice().sort((left, right) => left - right);
    let index = 0;
    while (index < sorted.length) {
        const value = sorted[index]!;
        let next = index + 1;
        while (next < sorted.length && sorted[next] === value) {
            next += 1;
        }
        const mid = (index + (next - index - 1) / 2) / (sorted.length - 1);
        ranks.set(value, low + mid * (high - low));
        index = next;
    }
    return ranks;
}

/** Ниже порога — лёгкий красный, на пороге и выше — зелёный. */
function payHeatLookup(values: number[], avgPayLevel: number | null): Map<number, number> {
    const ranks = new Map<number, number>();
    if (avgPayLevel === null || values.length === 0) {
        return ranks;
    }
    const threshold = avgPayLevel - PAY_HEAT_TOLERANCE;
    const below: number[] = [];
    const above: number[] = [];
    for (const value of values) {
        if (value < threshold) {
            below.push(value);
        } else {
            above.push(value);
        }
    }
    for (const [value, ratio] of sideRatioLookup(below, 0, 0.5)) {
        ranks.set(value, ratio);
    }
    for (const [value, ratio] of sideRatioLookup(above, 0.5, 1)) {
        ranks.set(value, ratio);
    }
    return ranks;
}

function payHeat(ratio: number): { backgroundColor: string } {
    const t = Math.min(1, Math.max(0, (ratio - 0.08) / 0.72));
    const eased = t * t * (3 - 2 * t);
    // Красный только в нижней половине и слабее зелёного; середина быстрее уходит в зелень.
    const hue = 28 + Math.pow(eased, 0.55) * 137;
    const edge = Math.min(1, Math.abs(ratio - 0.5) * 2);
    const edgeEase = edge * edge * (3 - 2 * edge);
    const below = ratio < 0.5;
    const chroma = below ? 0.05 + edgeEase * 0.08 : 0.08 + edgeEase * 0.14;
    const strength = below ? 16 + edgeEase * 22 : 28 + edgeEase * 42;
    return { backgroundColor: `color-mix(in oklab, oklch(0.74 ${chroma.toFixed(3)} ${hue.toFixed(1)}) ${strength.toFixed(0)}%, var(--background))` };
}

function payHeatStyle(ranks: Map<number, number>, amount: number | null): { backgroundColor: string } | undefined {
    if (amount === null) {
        return undefined;
    }
    const ratio = ranks.get(amount);
    return ratio === undefined ? undefined : payHeat(ratio);
}
const CELL = "border-r border-b border-border px-1.5 py-1 [@media(max-height:500px)]:py-0.5";
const EDGE = "border-r-2";
const SHORTFALL = "font-medium text-amber-700 dark:text-amber-300";
const ROLE_MARK: Record<string, string> = {
    "УСМ": "bg-muted text-foreground",
    "СВМ": "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    "Кладовщик": "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    "Мерчендайзер": "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    "Без подписи": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};
const NAME_COL = "w-max min-w-max whitespace-nowrap";
const ROLE_COL = "w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem]";
const HOUR_COL = "w-[5.75rem] min-w-[5.75rem] tabular-nums";
const MONEY_COL = "w-[7.75rem] min-w-[7.75rem] tabular-nums";
const PIN_NAME = "sticky left-0 z-20 border-l bg-background shadow-[1px_0_0_0_var(--background)] transform-gpu";
const PIN_ROLE = "sticky left-(--name-col) z-20 bg-background shadow-[1px_0_0_0_var(--background),2px_0_0_0_rgba(0,0,0,0.12)] transform-gpu";
const PIN_NAME_HEAD = "sticky left-0 z-30 border-l bg-card shadow-[1px_0_0_0_var(--card)] transform-gpu";
const PIN_ROLE_HEAD = "sticky left-(--name-col) z-30 bg-card shadow-[1px_0_0_0_var(--card),2px_0_0_0_rgba(0,0,0,0.12)] transform-gpu";
const SERVICE_LAST = SERVICE_INDICATORS[SERVICE_INDICATORS.length - 1].id;
const WASH_BASE = "bg-[color-mix(in_oklab,var(--color-sky-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-sky-950)_62%,var(--background))]";
const WASH_FIXED = "bg-[color-mix(in_oklab,var(--color-indigo-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-indigo-950)_62%,var(--background))]";
const WASH_TOTAL = "bg-[color-mix(in_oklab,var(--color-fuchsia-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-fuchsia-950)_62%,var(--background))]";
const WASH_BASKET = "bg-[color-mix(in_oklab,var(--color-violet-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-violet-950)_62%,var(--background))]";
const WASH_SERVICE = "bg-[color-mix(in_oklab,var(--color-orange-100)_58%,var(--background))] dark:bg-[color-mix(in_oklab,var(--color-orange-950)_62%,var(--background))]";

function endsGroup(column: BonusColumn, columns: CabinetColumns): boolean {
    return column === "name"
        || column === "role"
        || column === "brigade"
        || column === "salary"
        || column === "fixed"
        || column === "current"
        || column === "forecast"
        || column === "total"
        || column === columns.basketLast
        || column === SERVICE_LAST;
}

function bodyWash(column: BonusColumn, columns: CabinetColumns): string | undefined {
    if (column === "schedule" || column === "timesheet" || column === "salary") {
        return WASH_BASE;
    }
    if (column === "fixed") {
        return WASH_FIXED;
    }
    if (column === "total") {
        return WASH_TOTAL;
    }
    if (columns.basketIds.has(column)) {
        return WASH_BASKET;
    }
    if (SERVICE_INDICATORS.some((indicator) => indicator.id === column)) {
        return WASH_SERVICE;
    }
    return undefined;
}

function timesheetIsShort(scheduleHours: number | null, timesheetHours: number | null): boolean {
    return scheduleHours !== null && timesheetHours !== null && timesheetHours < scheduleHours;
}

function dataClass(column: BonusColumn, columns: CabinetColumns, value?: number): string {
    const hours = column === "schedule" || column === "timesheet";
    const text = column === "name" || column === "role" || column === "brigade";
    const heat = column === "current" || column === "forecast";
    return cn(
        CELL,
        endsGroup(column, columns) && EDGE,
        !heat && (bodyWash(column, columns) ?? "bg-background"),
        column === "name" && cn(PIN_NAME, NAME_COL, "font-medium"),
        column === "role" && cn(PIN_ROLE, ROLE_COL),
        hours && HOUR_COL,
        !text && !hours && MONEY_COL,
        !text && "text-center tabular-nums",
        value === 0 && "text-muted-foreground",
    );
}

const HEAD_ROW = "head";
const DESKTOP_QUERY = "(min-width: 640px)";

function subscribeDesktop(onChange: () => void) {
    const media = window.matchMedia(DESKTOP_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

function useIsDesktopCabinet(): boolean {
    return useSyncExternalStore(
        subscribeDesktop,
        () => window.matchMedia(DESKTOP_QUERY).matches,
        () => true,
    );
}

function buildColumnIndexes(brigadeOn: boolean, columns: CabinetColumns, showForecast: boolean): Map<BonusColumn, number> {
    const order: BonusColumn[] = [
        "name",
        "role",
        ...(brigadeOn ? ["brigade" as const] : []),
        "schedule",
        "timesheet",
        "salary",
        "fixed",
        "current",
        ...(showForecast ? ["forecast" as const] : []),
        "total",
        ...columns.baskets.map((indicator) => indicator.id),
        ...SERVICE_INDICATORS.map((indicator) => indicator.id),
    ];
    return new Map(order.map((column, index) => [column, index]));
}

function pointerOverScrollbar(scroller: HTMLElement, clientX: number, clientY: number): boolean {
    const rect = scroller.getBoundingClientRect();
    const overVertical = scroller.offsetWidth > scroller.clientWidth
        && clientX >= rect.left + scroller.clientWidth
        && clientX < rect.right;
    const overHorizontal = scroller.offsetHeight > scroller.clientHeight
        && clientY >= rect.top + scroller.clientHeight
        && clientY < rect.bottom;
    return overVertical || overHorizontal;
}

export function BranchBonuses() {
    const router = useRouter();
    const { branchId, period } = useBranchLocation();
    const store = useBranchStore();
    const directory = useBranchDirectory();
    const settings = useMotivationRoles();
    const [query, setQuery] = useState("");
    const [roles, setRoles] = useState<string[]>([]);
    const [brigades, setBrigades] = useState<string[]>([]);
    const [hiddenMovements, setHiddenMovements] = useState<EmployeeMovement[]>([...DEFAULT_HIDDEN_MOVEMENTS]);
    const [sort, setSort] = useState<BonusSort | null>(null);
    const tableFrame = useRef<HTMLDivElement>(null);
    const isDesktop = useIsDesktopCabinet();
    const slice = store.slice(branchId, period, directory.employees, settings);
    const brigadeOn = slice.savedBrigades.mode === "groups";
    const showForecast = !monthHasEnded(period);
    const columns = useMemo(() => cabinetColumns(directory.indicators), [directory.indicators]);
    const services = useMemo(() => blankServices(), []);
    const poolHref = withBranchQuery("/branch/bonuses/common", branchId, period);
    const rows = useMemo(() => directory.employees.flatMap((employee) => {
        const roleId = slice.savedRoles[roleKey(employee)] ?? null;
        if (!inCalculation(employee, roleId) || !hasTimesheetHours(employee.timesheetHours)) {
            return [];
        }
        const timesheetHours = employee.timesheetHours;
        const salary = salaryFromTimesheet(employee.hourly, timesheetHours);
        const fixed = fixedPremium(employee.payLevel, employee.hourly, directory.baseBonus, directory.priceGrowth, timesheetHours);
        const key = roleKey(employee);
        const premiums = rowPremiums(columns.baskets, {
            "Продажа товара": directory.salePremiums[key],
            "Выдача товара": directory.releasePremiums[key],
            "Кассовые операции": directory.kassaPremiums[key],
            "ОСНТ": directory.osntPremiums[key],
            "Складские операции": directory.warehousePremiums[key],
            "Разгрузка ТС": directory.unloadingPremiums[key],
        });
        const shared = directory.sharedPremiums[key] ?? 0;
        const earned = earnedPremium([...Object.values(premiums), ...Object.values(services), shared]);
        return [{
            employee,
            roleId,
            role: roleCaption(employee, roleId, settings),
            services,
            pay: {
                scheduleHours: employee.scheduleHours,
                timesheetHours,
                salary,
                currentPay: currentPay(salary, fixed, earned),
                forecastPay: forecastPay(employee.hourly, employee.payLevel, directory.baseBonus, directory.priceGrowth, employee.scheduleHours, timesheetHours, earned),
            },
            fixed,
            premiums,
            total: shared,
            brigade: brigadeName(employee.id, slice.savedBrigades, true),
            ...brigadePlace(employee.id, slice.savedBrigades.groups),
        } satisfies BonusRow];
    }), [
        columns.baskets,
        directory.baseBonus,
        directory.employees,
        directory.kassaPremiums,
        directory.osntPremiums,
        directory.priceGrowth,
        directory.releasePremiums,
        directory.salePremiums,
        directory.sharedPremiums,
        directory.unloadingPremiums,
        directory.warehousePremiums,
        services,
        settings,
        slice.savedBrigades,
        slice.savedRoles,
    ]);
    const roleOptions = useMemo(() => uniqueSorted(rows.map((row) => row.role)), [rows]);
    const brigadeOptions = useMemo(
        () => uniqueSorted(rows.flatMap((row) => row.brigade ? [row.brigade] : [])),
        [rows],
    );
    const sortable = useMemo(
        () => new Set(sortColumns(brigadeOn, columns, showForecast).map((item) => item.key)),
        [brigadeOn, columns, showForecast],
    );
    const explicitSort = sort && sort.key === "brigade" && !brigadeOn
        ? null
        : sort && sortable.has(sort.key) ? sort : null;
    const needle = query.trim().toLowerCase();
    const filtered = useMemo(() => rows.filter((row) => {
        if (roles.length > 0 && !roles.includes(row.role)) {
            return false;
        }
        if (brigadeOn && brigades.length > 0 && !brigades.includes(row.brigade ?? "")) {
            return false;
        }
        if (row.employee.movement && hiddenMovements.includes(row.employee.movement)) {
            return false;
        }
        if (!needle) {
            return true;
        }
        const movement = row.employee.movement ? movementLabel(row.employee.movement, row.employee.movementOn) : "";
        const movementAlias = row.employee.movement === "transferred" ? "переведен" : row.employee.movement === "title" ? "смена должности" : "";
        const haystack = `${row.employee.name} ${row.employee.title} ${row.role} ${row.brigade ?? ""} ${movement} ${movementAlias}`.toLowerCase();
        return haystack.includes(needle);
    }), [brigadeOn, brigades, hiddenMovements, needle, roles, rows]);
    const visibleBundle = useMemo(() => {
        const roleCounts = countKeys(filtered, (row) => row.role);
        const brigadeCounts = brigadeOn ? countKeys(filtered, (row) => row.brigadeKey) : null;
        const roleCountsByBrigade = brigadeOn ? countRolesByBrigade(filtered) : null;
        const visible = filtered.slice().sort((left, right) => explicitSort
            ? compareRows(left, right, explicitSort, showForecast)
            : compareDefault(left, right, {
                brigadeOn,
                roleCounts,
                brigadeCounts,
                roleCountsByBrigade,
            }));
        const roleCount = new Set(visible.map((row) => row.role)).size;
        const grouping = brigadeOn && (explicitSort === null || explicitSort.key === "brigade")
            ? "brigade"
            : explicitSort === null && roleCount > 1
                ? "role"
                : null;
        const places = grouping
            ? groupPlaces(visible, (row) => grouping === "brigade" ? row.brigadeKey : row.role)
            : visible.map(() => null);
        const avgPayLevel = averagePayLevel(rows.map((row) => row.employee.payLevel));
        const currentPays = visible.flatMap((row) => row.pay.currentPay === null ? [] : [row.pay.currentPay]);
        const forecastPays = visible.flatMap((row) => row.pay.forecastPay === null ? [] : [row.pay.forecastPay]);
        return {
            visible,
            places,
            currentHeat: payHeatLookup(currentPays, avgPayLevel),
            forecastHeat: payHeatLookup(forecastPays, avgPayLevel),
        };
    }, [brigadeOn, explicitSort, filtered, rows, showForecast]);
    const { visible, places, currentHeat: currentHeatRanks, forecastHeat: forecastHeatRanks } = visibleBundle;
    const columnIndexes = useMemo(
        () => buildColumnIndexes(brigadeOn, columns, showForecast),
        [brigadeOn, columns, showForecast],
    );
    const col = (column: BonusColumn) => columnIndexes.get(column) ?? -1;
    const movementFilterChanged = !sameMovements(hiddenMovements, DEFAULT_HIDDEN_MOVEMENTS);
    const filtersActive = needle !== "" || roles.length > 0 || movementFilterChanged || (brigadeOn && brigades.length > 0);
    const carriedRoster = directory.rosterPeriod !== null && directory.rosterPeriod !== period;
    const emptyText = carriedRoster
        ? "За этот месяц табель ещё не загружен."
        : rows.length === 0 ? "В этом филиале нет сотрудников в расчёте." : "Никого не найдено по этим фильтрам.";
    const columnCount = (showForecast ? 9 : 8) + columns.baskets.length + SERVICE_INDICATORS.length + (brigadeOn ? 1 : 0);
    const visibleNames = visible.map((row) => row.employee.name).join("\n");

    const staffReady = branchId !== ""
        && !directory.loading
        && directory.loadedBranchId.toLowerCase() === branchId.toLowerCase();
    const pending = !directory.error
        && !staffReady
        && directory.employees.length === 0
        && !(directory.branches.length === 0 && !directory.loading);
    const blocked = directory.error
        ?? (directory.branches.length === 0 && !directory.loading ? "За этот месяц штатное расписание не загружено." : null);
    useLayoutEffect(() => {
        const scope = tableFrame.current;
        const header = scope?.querySelector<HTMLElement>('[data-aim="head:0"]');
        if (!scope || !header) {
            return;
        }
        const apply = () => {
            const width = header.offsetWidth;
            if (width > 0) {
                scope.style.setProperty("--name-col", `${width}px`);
            }
        };
        apply();
        const observer = new ResizeObserver(apply);
        observer.observe(header);
        return () => observer.disconnect();
    }, [visibleNames, columnCount, pending]);
    useEffect(() => {
        if (!isDesktop || pending || blocked) {
            return;
        }
        const host = window as Window & { __cabinetScrollBench?: typeof runCabinetScrollBench };
        host.__cabinetScrollBench = runCabinetScrollBench;
        return () => {
            if (host.__cabinetScrollBench === runCabinetScrollBench) {
                delete host.__cabinetScrollBench;
            }
        };
    }, [blocked, isDesktop, pending]);

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 max-sm:h-auto max-sm:flex-none [@media(max-height:500px)]:gap-2!">
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
                            hiddenMovements={hiddenMovements}
                            onHiddenMovements={setHiddenMovements}
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
                                setHiddenMovements([...DEFAULT_HIDDEN_MOVEMENTS]);
                            }}
                        >
                            <RotateCcw />
                        </Button>
                        {!isDesktop ? (
                            <SortMenu sort={explicitSort} brigadeOn={brigadeOn} columns={columns} showForecast={showForecast} onSort={setSort} />
                        ) : null}
                    </div>
                </div>
            </div>
            {pending ? (
                <div className="rounded-md border" aria-busy="true">
                    <Table>
                        <TableBody>
                            <TableSkeleton columns={8} />
                        </TableBody>
                    </Table>
                </div>
            ) : null}
            {blocked ? <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{blocked}</p> : null}
            {pending || blocked ? null : isDesktop ? (
            <div
                ref={tableFrame}
                className="relative flex min-h-0 flex-1 flex-col [--name-col:15rem]"
            >
            <AimFrame root={tableFrame} />
            <Table containerClassName="min-h-0 max-w-full flex-1 overscroll-x-contain [transform:translateZ(0)]" className="w-max cursor-default border-separate border-spacing-0 text-xs">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <SortHead label="Сотрудник" column="name" sort={explicitSort} pin={PIN_NAME_HEAD} widthClass={NAME_COL} columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        <SortHead label="Роль" column="role" sort={explicitSort} pin={PIN_ROLE_HEAD} widthClass={ROLE_COL} columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        {brigadeOn ? <SortHead label="Бригада" column="brigade" sort={explicitSort} columnIndexes={columnIndexes} columns={columns} onSort={setSort} /> : null}
                        <SortHead label="Часов по графику" column="schedule" sort={explicitSort} fit="hour" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        <SortHead label="Часов по табелю" column="timesheet" sort={explicitSort} fit="hour" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        <SortHead label="Оклад" column="salary" sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        <SortHead label="Фиксированная премия" column="fixed" sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        <SortHead label="Текущая ЗП" column="current" sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        {showForecast ? <SortHead label="Прогноз ЗП" column="forecast" sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} /> : null}
                        <SortHead label="Общая премия" column="total" sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        {columns.baskets.map((indicator) => (
                            <SortHead key={indicator.id} label={indicator.title} column={indicator.id} sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        ))}
                        {SERVICE_INDICATORS.map((indicator) => (
                            <SortHead key={indicator.id} label={indicator.title} column={indicator.id} sort={explicitSort} fit="money" columnIndexes={columnIndexes} columns={columns} onSort={setSort} />
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columnCount} className={cn(CELL, "border-l border-r py-10 text-center whitespace-normal text-muted-foreground")}>
                                {emptyText}
                            </TableCell>
                        </TableRow>
                    ) : visible.map((row, index) => {
                        const href = segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}`, branchId, period), row.employee.activeFrom);
                        const lines = canOpenPersonalDetail(row.employee.id, directory.viewerEmployeeId, directory.foreignDetail);
                        const currentHeat = payHeatStyle(currentHeatRanks, row.pay.currentPay);
                        const forecastHeat = payHeatStyle(forecastHeatRanks, row.pay.forecastPay);
                        const timesheetShort = timesheetIsShort(row.pay.scheduleHours, row.pay.timesheetHours);
                        const rowId = roleKey(row.employee);
                        const movement = row.employee.movement;
                        const place = places[index];
                        const valued = (column: BonusColumn, value?: number | null) => cn(dataClass(column, columns, value ?? undefined), movementValueClass(movement), frameClass(place, "body"));
                        return (
                            <Fragment key={rowId}>
                            <TableRow className="hover:bg-transparent">
                                <AimedCell row={rowId} column={col("name")} className={cn(dataClass("name", columns), movementNameClass(movement), frameClass(place, "name"))} onOpen={() => router.push(href)}>
                                    <EmployeeNameLine name={row.employee.name} movement={movement} movementOn={row.employee.movementOn} partial={row.employee.partial} from={row.employee.activeFrom} until={row.employee.activeUntil} fit />
                                </AimedCell>
                                <AimedCell row={rowId} column={col("role")} className={cn(dataClass("role", columns), movementNameClass(movement), frameClass(place, "body"))}>
                                    <RoleLabel role={row.role} plain={movement !== undefined} />
                                </AimedCell>
                                {brigadeOn ? <AimedCell row={rowId} column={col("brigade")} className={valued("brigade")}>{row.brigade}</AimedCell> : null}
                                <AimedCell row={rowId} column={col("schedule")} className={valued("schedule", row.pay.scheduleHours ?? undefined)}>{formatHours(row.pay.scheduleHours)}</AimedCell>
                                <AimedCell row={rowId} column={col("timesheet")} className={cn(valued("timesheet", row.pay.timesheetHours ?? undefined), timesheetShort && SHORTFALL)}>{formatHours(row.pay.timesheetHours)}</AimedCell>
                                <AimedCell row={rowId} column={col("salary")} className={valued("salary", row.pay.salary)}>{formatAmount(row.pay.salary)}</AimedCell>
                                <AimedCell row={rowId} column={col("fixed")} className={valued("fixed", row.fixed)}>{formatAmount(row.fixed)}</AimedCell>
                                <AimedCell row={rowId} column={col("current")} className={valued("current", row.pay.currentPay)} style={currentHeat}>{formatAmount(row.pay.currentPay)}</AimedCell>
                                {showForecast ? <AimedCell row={rowId} column={col("forecast")} className={valued("forecast", row.pay.forecastPay)} style={forecastHeat}>{formatAmount(row.pay.forecastPay)}</AimedCell> : null}
                                <AimedCell row={rowId} column={col("total")} className={valued("total", row.total)} onOpen={() => router.push(poolHref)}>{formatAmount(row.total)}</AimedCell>
                                {columns.baskets.map((indicator) => (
                                    <AimedCell
                                        key={indicator.id}
                                        row={rowId}
                                        column={col(indicator.id)}
                                        className={valued(indicator.id, row.premiums[indicator.id])}
                                        onOpen={lines ? () => router.push(segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id), row.employee.activeFrom)) : undefined}
                                    >
                                        {formatAmount(row.premiums[indicator.id])}
                                    </AimedCell>
                                ))}
                                {SERVICE_INDICATORS.map((indicator) => (
                                    <AimedCell
                                        key={indicator.id}
                                        row={rowId}
                                        column={col(indicator.id)}
                                        className={cn(valued(indicator.id, row.services[indicator.id]), indicator.id === SERVICE_LAST && frameClass(place, "end"))}
                                        onOpen={lines ? () => router.push(segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id), row.employee.activeFrom)) : undefined}
                                    >
                                        {formatAmount(row.services[indicator.id])}
                                    </AimedCell>
                                ))}
                            </TableRow>
                            {place === "end" && index < visible.length - 1 ? (
                                <TableRow aria-hidden className="hover:bg-transparent">
                                    <TableCell colSpan={columnCount} className="h-2 border-0 bg-muted p-0" />
                                </TableRow>
                            ) : null}
                            </Fragment>
                        );
                    })}
                </TableBody>
            </Table>
            </div>
            ) : (
            <div className="overflow-visible rounded-lg border">
                {visible.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
                ) : groupRuns(visible, places).map((run) => {
                    const cards = run.rows.map((row) => (
                        <BonusListItem
                            key={roleKey(row.employee)}
                            row={row}
                            brigadeOn={brigadeOn}
                            branchId={branchId}
                            period={period}
                            href={segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}`, branchId, period), row.employee.activeFrom)}
                            lines={canOpenPersonalDetail(row.employee.id, directory.viewerEmployeeId, directory.foreignDetail)}
                            poolHref={poolHref}
                            baskets={columns.baskets}
                            currentHeat={payHeatStyle(currentHeatRanks, row.pay.currentPay)}
                            forecastHeat={showForecast ? payHeatStyle(forecastHeatRanks, row.pay.forecastPay) : undefined}
                            showForecast={showForecast}
                        />
                    ));
                    if (!run.framed) {
                        return cards;
                    }
                    return (
                        <div key={roleKey(run.rows[0].employee)} className="m-1 overflow-hidden rounded-md border border-primary/35">
                            {cards}
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );
}

function canOpenPersonalDetail(employeeId: string, viewerId: string | null, foreignDetail: boolean): boolean {
    return foreignDetail || (viewerId !== null && viewerId === employeeId.toLowerCase());
}

function formatAmount(value: number | null): string {
    if (value === null) {
        return "—";
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function RoleLabel({ role, plain = false }: { role: string; plain?: boolean }) {
    const tone = plain ? "bg-transparent text-inherit" : (ROLE_MARK[role] ?? "bg-muted text-foreground");
    return <span className={cn("inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-medium", tone)}>{role}</span>;
}

function nextSort(current: BonusSort | null, column: BonusColumn): BonusSort | null {
    const first: SortDirection = TEXT_COLUMNS.has(column) ? "asc" : "desc";
    if (current?.key !== column) {
        return { key: column, direction: first };
    }
    if (current.direction === first) {
        return { key: column, direction: first === "asc" ? "desc" : "asc" };
    }
    return null;
}

function sortColumns(brigadeOn: boolean, columns: CabinetColumns, showForecast: boolean): { key: BonusColumn; label: string }[] {
    return [
        { key: "name", label: "Сотрудник" },
        { key: "role", label: "Роль" },
        ...(brigadeOn ? [{ key: "brigade" as const, label: "Бригада" }] : []),
        { key: "schedule", label: "Часов по графику" },
        { key: "timesheet", label: "Часов по табелю" },
        { key: "salary", label: "Оклад" },
        { key: "fixed", label: "Фиксированная премия" },
        { key: "current", label: "Текущая ЗП" },
        ...(showForecast ? [{ key: "forecast" as const, label: "Прогноз ЗП" }] : []),
        { key: "total", label: "Общая премия" },
        ...columns.baskets.map((indicator) => ({ key: indicator.id, label: indicator.title })),
        ...SERVICE_INDICATORS.map((indicator) => ({ key: indicator.id, label: indicator.title })),
    ];
}

function BonusListItem({
    row,
    brigadeOn,
    branchId,
    period,
    href,
    poolHref,
    baskets,
    currentHeat,
    forecastHeat,
    showForecast,
    lines,
}: {
    row: BonusRow;
    brigadeOn: boolean;
    branchId: string;
    period: string;
    href: string;
    poolHref: string;
    baskets: readonly CabinetIndicator[];
    currentHeat?: { backgroundColor: string };
    forecastHeat?: { backgroundColor: string };
    showForecast: boolean;
    lines: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const timesheetShort = timesheetIsShort(row.pay.scheduleHours, row.pay.timesheetHours);
    const movement = row.employee.movement;
    const valueTone = movementValueClass(movement);
    const details = [
        { label: "Оклад", amount: row.pay.salary },
        { label: "Фиксированная премия", amount: row.fixed },
        { label: "Текущая ЗП", amount: row.pay.currentPay, heat: currentHeat },
        ...(showForecast ? [{ label: "Прогноз ЗП", amount: row.pay.forecastPay, heat: forecastHeat }] : []),
        { label: "Общая премия", amount: row.total, open: poolHref },
        ...baskets.map((indicator) => ({
            label: indicator.title,
            amount: row.premiums[indicator.id],
            ...(lines ? { open: segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id), row.employee.activeFrom) } : {}),
        })),
        ...SERVICE_INDICATORS.map((indicator) => ({
            label: indicator.title,
            amount: row.services[indicator.id],
            ...(lines ? { open: segmentHref(withBranchQuery(`/branch/bonuses/${row.employee.id}/lines`, branchId, period, indicator.id), row.employee.activeFrom) } : {}),
        })),
    ];
    return (
        <Collapsible open={open} onOpenChange={setOpen} data-scroll-row="" className="border-b last:border-b-0">
            <CollapsibleTrigger className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/60">
                <span className="min-w-0 flex-1">
                    <span className={cn("block rounded-md", movementNameClass(movement))}>
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
                            <EmployeeNameLine name={row.employee.name} movement={movement} movementOn={row.employee.movementOn} partial={row.employee.partial} from={row.employee.activeFrom} until={row.employee.activeUntil} spoiler={false} />
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                            <RoleLabel role={row.role} plain={movement !== undefined} />
                            {brigadeOn && row.brigade ? (
                                <span className={cn(
                                    "inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-medium",
                                    movement !== undefined ? "bg-transparent text-inherit" : "bg-muted text-foreground",
                                )}>
                                    {row.brigade}
                                </span>
                            ) : null}
                        </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                        график{" "}
                        <span className={cn("tabular-nums", valueTone)}>{formatHours(row.pay.scheduleHours)}</span>
                        {" · табель "}
                        <span className={cn("tabular-nums", timesheetShort && SHORTFALL, valueTone)}>{formatHours(row.pay.timesheetHours)}</span>
                    </span>
                </span>
                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-right" style={showForecast ? forecastHeat : currentHeat}>
                    <span className="block text-xs text-muted-foreground">{showForecast ? "Прогноз ЗП" : "Текущая ЗП"}</span>
                    <span className={cn("block text-sm font-medium tabular-nums", valueTone)}>{formatAmount(showForecast ? row.pay.forecastPay : row.pay.currentPay)}</span>
                </span>
                <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="border-t px-3 py-1">
                    <EmployeeStatusNote movement={movement} movementOn={row.employee.movementOn} partial={row.employee.partial} from={row.employee.activeFrom} until={row.employee.activeUntil} className="px-1.5 py-1" />
                    <dl>
                    {details.map((item) => {
                        const destination = "open" in item && item.open ? item.open : null;
                        return (
                        <div
                            key={item.label}
                            role={destination ? "link" : undefined}
                            tabIndex={destination ? 0 : undefined}
                            className={cn(
                                "flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1.5 text-sm",
                                destination && "cursor-pointer hover:bg-muted/60",
                            )}
                            style={"heat" in item ? item.heat : undefined}
                            onClick={destination ? () => router.push(destination) : undefined}
                            onKeyDown={destination ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    router.push(destination);
                                }
                            } : undefined}
                        >
                            <dt className="text-muted-foreground">{item.label}</dt>
                            <dd className={cn("tabular-nums", item.amount === 0 && !valueTone && "text-muted-foreground", valueTone)}>{formatAmount(item.amount)}</dd>
                        </div>
                        );
                    })}
                    </dl>
                </div>
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
    hiddenMovements,
    onHiddenMovements,
}: {
    roleOptions: string[];
    roles: readonly string[];
    onToggleRole: (value: string) => void;
    brigadeOn: boolean;
    brigadeOptions: string[];
    brigades: readonly string[];
    onToggleBrigade: (value: string) => void;
    hiddenMovements: readonly EmployeeMovement[];
    onHiddenMovements: (hidden: EmployeeMovement[]) => void;
}) {
    const active = roles.length > 0 || !sameMovements(hiddenMovements, DEFAULT_HIDDEN_MOVEMENTS) || (brigadeOn && brigades.length > 0);
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
                <MovementFilterOptions hidden={hiddenMovements} onChange={onHiddenMovements} />
                <FilterOptions title="Роли" options={roleOptions} selected={roles} onToggle={onToggleRole} />
                {brigadeOn ? <FilterOptions title="Бригады" options={brigadeOptions} selected={brigades} onToggle={onToggleBrigade} /> : null}
            </PopoverContent>
        </Popover>
    );
}

function MovementFilterOptions({
    hidden,
    onChange,
}: {
    hidden: readonly EmployeeMovement[];
    onChange: (hidden: EmployeeMovement[]) => void;
}) {
    function toggle(movement: EmployeeMovement) {
        onChange(hidden.includes(movement) ? hidden.filter((item) => item !== movement) : [...hidden, movement]);
    }
    return (
        <div className="flex flex-col gap-1 border-b pb-2">
            <p className="px-2 text-xs font-medium text-muted-foreground">Сотрудники</p>
            <Label className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                <Checkbox checked={hidden.length === 0} onCheckedChange={() => onChange([])} />
                <span>Показывать всех</span>
            </Label>
            <Label className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                <Checkbox checked={hidden.includes("dismissed")} onCheckedChange={() => toggle("dismissed")} />
                <span>Скрыть уволенных</span>
            </Label>
            <Label className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                <Checkbox checked={hidden.includes("transferred")} onCheckedChange={() => toggle("transferred")} />
                <span>Скрыть переведённых</span>
            </Label>
            <Label className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                <Checkbox checked={hidden.includes("absent")} onCheckedChange={() => toggle("absent")} />
                <span>Скрыть отсутствующих</span>
            </Label>
        </div>
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

function SortMenu({ sort, brigadeOn, columns, showForecast, onSort }: { sort: BonusSort | null; brigadeOn: boolean; columns: CabinetColumns; showForecast: boolean; onSort: (sort: BonusSort | null) => void }) {
    const options = sortColumns(brigadeOn, columns, showForecast);
    const current = options.find((column) => column.key === sort?.key);
    const mark = sort?.direction === "asc" ? "↑" : "↓";
    const groupedLabel = brigadeOn ? "Бригады и роли" : "Роли";
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="icon" aria-label={current ? `Сортировка: ${current.label} ${mark}` : `Сортировка: ${groupedLabel}`} className="size-9">
                        <ArrowUpDown />
                    </Button>
                }
            />
            <PopoverContent align="end" className="max-h-80 w-64 gap-0 overflow-y-auto p-1">
                <button
                    type="button"
                    className={cn("flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", sort === null && "bg-muted")}
                    onClick={() => onSort(null)}
                >
                    <span>{groupedLabel}</span>
                </button>
                {options.map((column) => {
                    const active = sort?.key === column.key;
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

type CabinetScrollPass = {
    mode: "current" | "legacy-paint";
    rows: number;
    cells: number;
    frames: number;
    avgFrameMs: number;
    p95FrameMs: number;
    maxFrameMs: number;
    over16ms: number;
    over33ms: number;
    longAnimationFrames: number;
    longAnimationFrameMs: number;
};

type CabinetScrollBench = {
    label: string;
    distance: number;
    maxScroll: number;
    durationMs: number;
    passes: CabinetScrollPass[];
};

async function measureCabinetScrollPass(
    scroller: HTMLElement,
    mode: CabinetScrollPass["mode"],
    distance: number,
    durationMs: number,
): Promise<CabinetScrollPass> {
    const round = (value: number) => Math.round(value * 100) / 100;
    const rows = scroller.querySelectorAll("tbody tr").length;
    const cells = scroller.querySelectorAll("td, th").length;
    const frameDeltas: number[] = [];
    let longAnimationFrames = 0;
    let longAnimationFrameMs = 0;
    let loafObserver: PerformanceObserver | null = null;
    try {
        loafObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                longAnimationFrames += 1;
                longAnimationFrameMs += entry.duration;
            }
        });
        loafObserver.observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit);
    } catch {
        loafObserver = null;
    }

    scroller.scrollLeft = 0;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    let last = performance.now();
    let measuring = true;
    const tick = (now: number) => {
        if (!measuring) {
            return;
        }
        frameDeltas.push(now - last);
        last = now;
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const started = performance.now();
    await new Promise<void>((resolve) => {
        const step = (now: number) => {
            const progress = Math.min(1, (now - started) / durationMs);
            scroller.scrollLeft = distance * progress;
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        };
        requestAnimationFrame(step);
    });
    measuring = false;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    loafObserver?.disconnect();

    const samples = frameDeltas.slice(2).sort((left, right) => left - right);
    const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
    const at = (quantile: number) => samples[Math.min(samples.length - 1, Math.floor(samples.length * quantile))] ?? 0;
    return {
        mode,
        rows,
        cells,
        frames: samples.length,
        avgFrameMs: round(average),
        p95FrameMs: round(at(0.95)),
        maxFrameMs: round(samples[samples.length - 1] ?? 0),
        over16ms: samples.filter((value) => value > 16.67).length,
        over33ms: samples.filter((value) => value > 33.34).length,
        longAnimationFrames,
        longAnimationFrameMs: round(longAnimationFrameMs),
    };
}

async function runCabinetScrollBench(label = "run"): Promise<CabinetScrollBench | null> {
    const scroller = document.querySelector<HTMLElement>("[data-slot=table-container]");
    const body = scroller?.querySelector("tbody");
    if (!scroller || !body) {
        return null;
    }
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) {
        return null;
    }
    const distance = Math.min(maxScroll, Math.max(600, Math.floor(maxScroll * 0.7)));
    const durationMs = 1200;
    const originalRows = Array.from(body.querySelectorAll(":scope > tr"));
    const clones: HTMLTableRowElement[] = [];
    const targetRows = Math.max(160, originalRows.length);
    while (originalRows.length + clones.length < targetRows) {
        for (const row of originalRows) {
            if (originalRows.length + clones.length >= targetRows) {
                break;
            }
            const clone = row.cloneNode(true) as HTMLTableRowElement;
            clone.setAttribute("data-scroll-bench-clone", "");
            body.append(clone);
            clones.push(clone);
        }
    }
    const legacyStyle = document.createElement("style");
    legacyStyle.setAttribute("data-scroll-bench-style", "");
    legacyStyle.textContent = `
      [data-slot="table-container"][data-scroll-bench-legacy] {
        transform: none !important;
      }
      [data-slot="table-container"][data-scroll-bench-legacy] td,
      [data-slot="table-container"][data-scroll-bench-legacy] th {
        transform: none !important;
        box-shadow:
          inset 2px 0 0 transparent,
          inset 0 -2px 0 transparent,
          inset 0 0 0 2px transparent,
          inset 0 0 0 999px transparent,
          4px 0 8px -4px rgba(0,0,0,0.28) !important;
      }
    `;
    document.head.append(legacyStyle);

    const current = await measureCabinetScrollPass(scroller, "current", distance, durationMs);
    scroller.setAttribute("data-scroll-bench-legacy", "");
    const legacy = await measureCabinetScrollPass(scroller, "legacy-paint", distance, durationMs);
    scroller.removeAttribute("data-scroll-bench-legacy");
    for (const clone of clones) {
        clone.remove();
    }
    legacyStyle.remove();
    scroller.scrollLeft = 0;

    return {
        label,
        distance,
        maxScroll,
        durationMs,
        passes: [current, legacy],
    };
}

function placeAimFrame(frame: HTMLElement, scope: HTMLElement, cell: HTMLElement) {
    const scopeBox = scope.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    frame.style.width = `${box.width}px`;
    frame.style.height = `${box.height}px`;
    frame.style.transform = `translate3d(${box.left - scopeBox.left}px, ${box.top - scopeBox.top}px, 0)`;
}

function AimFrame({ root }: { root: RefObject<HTMLDivElement | null> }) {
    const frameRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const scopeEl = root.current;
        const frameEl = frameRef.current;
        if (!scopeEl || !frameEl) {
            return;
        }
        const scope = scopeEl;
        const frame = frameEl;
        const scroller = scope.querySelector<HTMLElement>("[data-slot=table-container]");
        let activeCell: HTMLElement | null = null;
        let observer: ResizeObserver | null = null;
        let scrolling = false;
        let scrollIdle = 0;
        let placeRaf = 0;

        function clear() {
            activeCell = null;
            observer?.disconnect();
            observer = null;
            if (placeRaf) {
                cancelAnimationFrame(placeRaf);
                placeRaf = 0;
            }
            frame.style.opacity = "0";
            frame.style.borderColor = "transparent";
            frame.style.backgroundColor = "transparent";
            frame.style.transition = "none";
            frame.style.transform = "none";
            frame.style.width = "0px";
            frame.style.height = "0px";
        }

        function schedulePlace(cell: HTMLElement) {
            if (placeRaf) {
                return;
            }
            placeRaf = requestAnimationFrame(() => {
                placeRaf = 0;
                if (activeCell === cell) {
                    placeAimFrame(frame, scope, cell);
                }
            });
        }

        function aimAt(cell: HTMLElement) {
            if (activeCell === cell) {
                schedulePlace(cell);
                return;
            }
            activeCell = cell;
            observer?.disconnect();
            frame.style.transition = "none";
            frame.style.opacity = "1";
            frame.style.borderColor = "transparent";
            frame.style.backgroundColor = "transparent";
            placeAimFrame(frame, scope, cell);
            frame.getBoundingClientRect();
            frame.style.transition = `border-color ${AIM_FADE_MS}ms ease-out, background-color ${AIM_FADE_MS}ms ease-out`;
            frame.style.borderColor = AIM_BORDER;
            frame.style.backgroundColor = AIM_FILL;
            observer = new ResizeObserver(() => schedulePlace(cell));
            observer.observe(cell);
        }

        function onScroll() {
            scrolling = true;
            clear();
            window.clearTimeout(scrollIdle);
            scrollIdle = window.setTimeout(() => {
                scrolling = false;
            }, 120);
        }

        function onMove(event: MouseEvent) {
            if (scrolling) {
                return;
            }
            if (scroller && pointerOverScrollbar(scroller, event.clientX, event.clientY)) {
                clear();
                return;
            }
            const target = (event.target as Element | null)?.closest?.("[data-aim]");
            if (!(target instanceof HTMLElement) || !scope.contains(target)) {
                clear();
                return;
            }
            aimAt(target);
        }

        scope.addEventListener("mousemove", onMove);
        scope.addEventListener("mouseleave", clear);
        scope.addEventListener("wheel", onScroll, { passive: true });
        scroller?.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scope.removeEventListener("mousemove", onMove);
            scope.removeEventListener("mouseleave", clear);
            scope.removeEventListener("wheel", onScroll);
            scroller?.removeEventListener("scroll", onScroll);
            window.clearTimeout(scrollIdle);
            clear();
        };
    }, [root]);
    return (
        <div
            ref={frameRef}
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 z-40 border-2 border-transparent bg-transparent opacity-0 motion-reduce:transition-none"
        />
    );
}

function AimedCell({
    row,
    column,
    className,
    style,
    onOpen,
    children,
}: {
    row: string;
    column: number;
    className?: string;
    style?: { backgroundColor: string };
    onOpen?: () => void;
    children: ReactNode;
}) {
    return (
        <TableCell
            data-aim={`${row}:${column}`}
            className={cn(className, onOpen && "cursor-pointer")}
            style={style}
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
    columnIndexes,
    columns,
}: {
    label: string;
    column: BonusColumn;
    sort: BonusSort | null;
    onSort: (sort: BonusSort | null) => void;
    fit?: "hour" | "money";
    pin?: string;
    widthClass?: string;
    columnIndexes: Map<BonusColumn, number>;
    columns: CabinetColumns;
}) {
    const active = sort?.key === column;
    const next = nextSort(sort, column);
    const mark = sort?.direction === "asc" ? "↑" : "↓";
    const width = fit === "hour" ? HOUR_COL : fit === "money" ? MONEY_COL : widthClass;
    const index = columnIndexes.get(column) ?? -1;
    return (
        <TableHead
            data-aim={`${HEAD_ROW}:${index}`}
            aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"}
            tabIndex={0}
            className={cn(CELL, endsGroup(column, columns) && EDGE, "h-auto cursor-pointer border-t text-center whitespace-normal hover:text-foreground", width, pin, headTone(column, columns))}
            onClick={() => onSort(next)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSort(next);
                }
            }}
        >
            <span className="inline-flex max-w-full items-baseline justify-center gap-1 text-center whitespace-normal">
                <span>{label}</span>
                {active ? <span className="shrink-0" aria-hidden="true">{mark}</span> : null}
            </span>
        </TableHead>
    );
}

type GroupPlace = "start" | "mid" | "end";

function brigadePlace(employeeId: string, groups: readonly { id: string; memberIds: string[] }[]): { brigadeKey: string; brigadeRank: number } {
    const index = groups.findIndex((group) => group.memberIds.includes(employeeId));
    if (index < 0) {
        return { brigadeKey: "outside", brigadeRank: groups.length };
    }
    return { brigadeKey: groups[index].id, brigadeRank: index };
}

function frameClass(place: GroupPlace | null, part: "name" | "body" | "end"): string {
    if (!place) {
        return "";
    }
    const cap = cn(
        place === "start" && "border-t border-t-primary/35",
        place === "end" && "border-b border-b-primary/35",
    );
    if (part === "name") {
        return cn("border-l border-l-primary/35", cap);
    }
    if (part === "end") {
        return cn("border-r border-r-primary/35", cap);
    }
    return cap;
}

function groupPlaces(rows: readonly BonusRow[], keyOf: (row: BonusRow) => string): (GroupPlace | null)[] {
    const keys = rows.map(keyOf);
    return keys.map((key, index) => {
        const previous = index > 0 && keys[index - 1] === key;
        const next = index < keys.length - 1 && keys[index + 1] === key;
        if (!previous && next) {
            return "start";
        }
        if (previous && next) {
            return "mid";
        }
        if (previous && !next) {
            return "end";
        }
        return null;
    });
}

function groupRuns(rows: readonly BonusRow[], places: readonly (GroupPlace | null)[]): { rows: BonusRow[]; framed: boolean }[] {
    const runs: { rows: BonusRow[]; framed: boolean }[] = [];
    let index = 0;
    while (index < rows.length) {
        if (places[index] !== "start") {
            runs.push({ rows: [rows[index]], framed: false });
            index += 1;
            continue;
        }
        const start = index;
        while (index < rows.length && places[index] !== "end") {
            index += 1;
        }
        const end = Math.min(index, rows.length - 1);
        runs.push({ rows: rows.slice(start, end + 1), framed: true });
        index = end + 1;
    }
    return runs;
}

function countKeys(rows: readonly BonusRow[], keyOf: (row: BonusRow) => string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const key = keyOf(row);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function countRolesByBrigade(rows: readonly BonusRow[]): Map<string, Map<string, number>> {
    const byBrigade = new Map<string, Map<string, number>>();
    for (const row of rows) {
        let roles = byBrigade.get(row.brigadeKey);
        if (!roles) {
            roles = new Map();
            byBrigade.set(row.brigadeKey, roles);
        }
        roles.set(row.role, (roles.get(row.role) ?? 0) + 1);
    }
    return byBrigade;
}

function compareRolesBySize(left: string, right: string, counts: ReadonlyMap<string, number>): number {
    const leftCount = counts.get(left) ?? 0;
    const rightCount = counts.get(right) ?? 0;
    if (leftCount !== rightCount) {
        return rightCount - leftCount;
    }
    if (left === "УСМ" && right !== "УСМ") {
        return -1;
    }
    if (right === "УСМ" && left !== "УСМ") {
        return 1;
    }
    return left.localeCompare(right, "ru");
}

function compareDefault(
    left: BonusRow,
    right: BonusRow,
    options: {
        brigadeOn: boolean;
        roleCounts: ReadonlyMap<string, number>;
        brigadeCounts: ReadonlyMap<string, number> | null;
        roleCountsByBrigade: ReadonlyMap<string, ReadonlyMap<string, number>> | null;
    },
): number {
    if (options.brigadeOn && options.brigadeCounts) {
        const leftBrigade = options.brigadeCounts.get(left.brigadeKey) ?? 0;
        const rightBrigade = options.brigadeCounts.get(right.brigadeKey) ?? 0;
        if (leftBrigade !== rightBrigade) {
            return rightBrigade - leftBrigade;
        }
        if (left.brigadeKey !== right.brigadeKey) {
            const byName = (left.brigade ?? "").localeCompare(right.brigade ?? "", "ru");
            if (byName !== 0) {
                return byName;
            }
            return left.brigadeRank - right.brigadeRank;
        }
        const within = options.roleCountsByBrigade?.get(left.brigadeKey) ?? options.roleCounts;
        const byRole = compareRolesBySize(left.role, right.role, within);
        if (byRole !== 0) {
            return byRole;
        }
    } else {
        const byRole = compareRolesBySize(left.role, right.role, options.roleCounts);
        if (byRole !== 0) {
            return byRole;
        }
    }
    const byPay = directedCompare(left, right, "current", "desc");
    if (byPay !== 0) {
        return byPay;
    }
    return left.employee.name.localeCompare(right.employee.name, "ru");
}

function compareRows(left: BonusRow, right: BonusRow, sort: BonusSort, showForecast: boolean): number {
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
    const payColumn = showForecast ? "forecast" : "current";
    if (sort.key !== payColumn) {
        const byPay = directedCompare(left, right, payColumn, "desc");
        if (byPay !== 0) {
            return byPay;
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
    const leftValue = numericColumn(left, column);
    const rightValue = numericColumn(right, column);
    if (leftValue === null && rightValue === null) {
        return 0;
    }
    if (leftValue === null) {
        return 1;
    }
    if (rightValue === null) {
        return -1;
    }
    return (leftValue - rightValue) * factor;
}

function numericColumn(row: BonusRow, column: BonusColumn): number | null {
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
    return row.premiums[column] ?? null;
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ru"));
}

function toggleValue(current: readonly string[], value: string): string[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}
