"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
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
    totalPremium,
    withBranchQuery,
    type PremiumIndicatorId,
} from "./mock";

type BonusColumn = "name" | "role" | "brigade" | "schedule" | "timesheet" | "salary" | "fixed" | "current" | "forecast" | "total" | PremiumIndicatorId;
type SortDirection = "asc" | "desc";
type BonusSort = { key: BonusColumn; direction: SortDirection };

interface BonusRow {
    employee: ReturnType<typeof employeesOf>[number];
    roleId: string | null;
    role: string;
    pay: ReturnType<typeof payFacts>;
    fixed: number;
    premiums: ReturnType<typeof indicatorPremiums>;
    total: number;
    brigade: string | null;
}

const TEXT_COLUMNS = new Set<BonusColumn>(["name", "role", "brigade"]);
const GRID = "border-r border-b border-border";
const NAME_COL = "w-52 min-w-52 max-w-52";
const ROLE_COL = "w-40 min-w-40 max-w-40";
const HOUR_COL = "w-32 min-w-32 tabular-nums";
const MONEY_COL = "w-40 min-w-40 tabular-nums";
const PIN_NAME = "sticky z-20 border-l bg-background group-hover:bg-muted";
const PIN_ROLE = "sticky z-20 bg-background shadow-[4px_0_8px_-4px_rgba(0,0,0,0.28)] group-hover:bg-muted";
const PIN_NAME_HEAD = "sticky z-30 border-l bg-card";
const PIN_ROLE_HEAD = "sticky z-30 bg-card shadow-[4px_0_8px_-4px_rgba(0,0,0,0.28)]";

export function BranchBonuses() {
    const { branchId, period } = useBranchLocation();
    const store = useBranchStore();
    const { state, isMobile } = useSidebar();
    const gutter = isMobile ? "1rem" : state === "collapsed" ? "calc(var(--sidebar-width-icon) + 2rem)" : "calc(var(--sidebar-width) + 2rem)";
    const nameLeft = { left: gutter };
    const roleLeft = { left: `calc(${gutter} + 13rem)` };
    const [query, setQuery] = useState("");
    const [roles, setRoles] = useState<string[]>([]);
    const [brigades, setBrigades] = useState<string[]>([]);
    const [sort, setSort] = useState<BonusSort>({ key: "role", direction: "asc" });
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
            pay: payFacts(employee, period, total),
            fixed: fixedPremium(employee),
            premiums,
            total,
            brigade: brigadeName(employee.id, slice.savedBrigades, true),
        } satisfies BonusRow];
    });
    const roleOptions = uniqueSorted(rows.map((row) => row.role));
    const brigadeOptions = uniqueSorted(rows.flatMap((row) => row.brigade ? [row.brigade] : []));
    const activeSort = sort.key === "brigade" && !brigadeOn ? { key: "role" as const, direction: "asc" as const } : sort;
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
    const filtersActive = needle !== "" || roles.length > 0 || (brigadeOn && brigades.length > 0);
    const columnCount = 10 + PREMIUM_INDICATORS.length + (brigadeOn ? 1 : 0);

    if (!month.inMotivation) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Филиал в этом месяце не участвует в мотивации.</p>;
    }
    if (!month.calculated) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Расчёт за этот месяц ещё не готов.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="w-full sm:w-72">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        value={query}
                        placeholder="Сотрудник"
                        aria-label="Сотрудник"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    {query.trim() !== "" ? (
                        <InputGroupAddon align="inline-end">
                            <InputGroupButton aria-label="Очистить поиск" size="icon-xs" onClick={() => setQuery("")}>
                                <X />
                            </InputGroupButton>
                        </InputGroupAddon>
                    ) : null}
                </InputGroup>
                <MultiFilter
                    summary={optionSummary("Все роли", ["роль", "роли", "ролей"], roles)}
                    options={roleOptions}
                    selected={roles}
                    onToggle={(value) => setRoles(toggleValue(roles, value))}
                />
                {brigadeOn ? (
                    <MultiFilter
                        summary={optionSummary("Все бригады", ["бригада", "бригады", "бригад"], brigades)}
                        options={brigadeOptions}
                        selected={brigades}
                        onToggle={(value) => setBrigades(toggleValue(brigades, value))}
                    />
                ) : null}
                {filtersActive ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setQuery("");
                            setRoles([]);
                            setBrigades([]);
                        }}
                    >
                        Сбросить
                    </Button>
                ) : null}
            </div>
            <Table containerClassName="overflow-visible" className="w-max border-separate border-spacing-0">
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <SortHead label="Сотрудник" column="name" sort={activeSort} pin={PIN_NAME_HEAD} pinStyle={nameLeft} widthClass={NAME_COL} onSort={setSort} />
                        <SortHead label="Роль" column="role" sort={activeSort} pin={PIN_ROLE_HEAD} pinStyle={roleLeft} widthClass={ROLE_COL} onSort={setSort} />
                        {brigadeOn ? <SortHead label="Бригада" column="brigade" sort={activeSort} onSort={setSort} /> : null}
                        <SortHead label="Часов по графику" column="schedule" sort={activeSort} align="right" fit="hour" onSort={setSort} />
                        <SortHead label="Часов по табелю" column="timesheet" sort={activeSort} align="right" fit="hour" onSort={setSort} />
                        <SortHead label="Оклад" column="salary" sort={activeSort} align="right" fit="money" onSort={setSort} />
                        <SortHead label="Фиксированная премия" column="fixed" sort={activeSort} align="right" fit="money" onSort={setSort} />
                        <SortHead label="Текущая ЗП" column="current" sort={activeSort} align="right" fit="money" onSort={setSort} />
                        <SortHead label="Прогноз ЗП" column="forecast" sort={activeSort} align="right" fit="money" onSort={setSort} />
                        <SortHead label="Общая премия" column="total" sort={activeSort} align="right" fit="money" onSort={setSort} />
                        {PREMIUM_INDICATORS.map((indicator) => (
                            <SortHead key={indicator.id} label={indicator.title} column={indicator.id} sort={activeSort} align="right" fit="money" onSort={setSort} />
                        ))}
                        <TableHead className={cn(GRID, "border-t")} />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={columnCount} className={cn(GRID, "border-l py-10 text-center whitespace-normal text-muted-foreground")}>
                                Никого не найдено по этим фильтрам.
                            </TableCell>
                        </TableRow>
                    ) : visible.map((row) => {
                        const href = withBranchQuery(`/branch/bonuses/${row.employee.id}`, branchId, period);
                        return (
                            <TableRow key={row.employee.id} className="group">
                                <TableCell style={nameLeft} className={cn(GRID, PIN_NAME, NAME_COL, "font-medium whitespace-nowrap")}>{row.employee.name}</TableCell>
                                <TableCell style={roleLeft} className={cn(GRID, PIN_ROLE, ROLE_COL)}>{row.role}</TableCell>
                                {brigadeOn ? <TableCell className={GRID}>{row.brigade}</TableCell> : null}
                                <TableCell className={cn(GRID, HOUR_COL, "text-right")}>{row.pay.scheduleHours}</TableCell>
                                <TableCell className={cn(GRID, HOUR_COL, "text-right")}>{row.pay.timesheetHours}</TableCell>
                                <TableCell className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.pay.salary)}</TableCell>
                                <TableCell className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.fixed)}</TableCell>
                                <TableCell className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.pay.currentPay)}</TableCell>
                                <TableCell className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.pay.forecastPay)}</TableCell>
                                <TableCell className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.total)}</TableCell>
                                {PREMIUM_INDICATORS.map((indicator) => (
                                    <TableCell key={indicator.id} className={cn(GRID, MONEY_COL, "text-right")}>{formatAmount(row.premiums[indicator.id])}</TableCell>
                                ))}
                                <TableCell className={cn(GRID, "text-right")}>
                                    <Link href={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>Открыть</Link>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function formatAmount(value: number): string {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function SortHead({
    label,
    column,
    sort,
    onSort,
    align = "left",
    fit,
    pin,
    pinStyle,
    widthClass,
}: {
    label: string;
    column: BonusColumn;
    sort: BonusSort;
    onSort: (sort: BonusSort) => void;
    align?: "left" | "right";
    fit?: "hour" | "money";
    pin?: string;
    pinStyle?: { left: string };
    widthClass?: string;
}) {
    const active = sort.key === column;
    const nextDirection: SortDirection = active
        ? (sort.direction === "asc" ? "desc" : "asc")
        : (TEXT_COLUMNS.has(column) ? "asc" : "desc");
    const mark = sort.direction === "asc" ? "↑" : "↓";
    const width = fit === "hour" ? HOUR_COL : fit === "money" ? MONEY_COL : widthClass;
    return (
        <TableHead
            aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
            style={pinStyle}
            className={cn(GRID, "border-t whitespace-normal align-bottom", align === "right" && "text-right", width, pin)}
        >
            <button
                type="button"
                className={cn(
                    "relative block w-full hover:text-foreground whitespace-normal",
                    align === "right" && "text-right",
                )}
                onClick={() => onSort({ key: column, direction: nextDirection })}
            >
                {align !== "right" && active ? <span aria-hidden="true">{mark} </span> : null}
                {label}
                {align === "right" && active ? <span className="absolute top-0 right-0" aria-hidden="true">{mark}</span> : null}
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
        const byRole = directedCompare(left, right, "role", "asc");
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
    return row.premiums[column];
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, "ru"));
}

function toggleValue(current: readonly string[], value: string): string[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function optionSummary(emptyLabel: string, forms: [string, string, string], selected: readonly string[]): string {
    if (selected.length === 0) {
        return emptyLabel;
    }
    if (selected.length === 1) {
        return selected[0];
    }
    const mod10 = selected.length % 10;
    const mod100 = selected.length % 100;
    const form = mod10 === 1 && mod100 !== 11
        ? forms[0]
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? forms[1]
            : forms[2];
    return `${selected.length} ${form}`;
}

function MultiFilter({
    summary,
    options,
    selected,
    onToggle,
}: {
    summary: string;
    options: string[];
    selected: readonly string[];
    onToggle: (value: string) => void;
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
                    <Label key={option} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                        <Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />
                        <span className="truncate">{option}</span>
                    </Label>
                ))}
            </PopoverContent>
        </Popover>
    );
}
