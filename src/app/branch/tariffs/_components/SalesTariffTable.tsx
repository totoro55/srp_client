"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { salesRowLabel, type TariffRow } from "../../_components/mock";

export type SalesSortColumn = "title" | "stm" | "nonStm" | "im" | "b2b";
export type SalesSortDirection = "asc" | "desc";
export type SalesSort = { key: SalesSortColumn; direction: SalesSortDirection };

const COLUMNS: { key: SalesSortColumn; label: (axis: string) => string }[] = [
    { key: "title", label: salesRowLabel },
    { key: "stm", label: () => "СТМ" },
    { key: "nonStm", label: () => "Не СТМ" },
    { key: "im", label: () => "ИМ" },
    { key: "b2b", label: () => "Безнал" },
];

const RATE_COLUMNS = COLUMNS.filter((column) => column.key !== "title");

export function SalesTariffTable({
    axis,
    rows,
    sort,
    onSort,
    bordered = false,
    emptyText = "Ничего не найдено по этим фильтрам.",
}: {
    axis: string;
    rows: TariffRow[];
    sort?: SalesSort;
    onSort?: (sort: SalesSort) => void;
    bordered?: boolean;
    emptyText?: string;
}) {
    const cellBorder = bordered ? "border border-border" : undefined;
    const headClass = cn(cellBorder, bordered && "sticky top-0 z-20 bg-muted");

    if (!bordered) {
        return (
            <div className="max-w-full overflow-x-auto">
                <Table className="w-max min-w-full" containerClassName="overflow-visible">
                    <TableHeader>
                        <TableRow>
                            {COLUMNS.map((column) => (
                                <TableHead key={column.key}>{column.label(axis)}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.title}>
                                <TableCell className="max-w-40 font-medium whitespace-normal">{row.title}</TableCell>
                                <TableCell className="tabular-nums">{row.stm}</TableCell>
                                <TableCell className="tabular-nums">{row.nonStm}</TableCell>
                                <TableCell className="tabular-nums">{row.im}</TableCell>
                                <TableCell className="tabular-nums">{row.b2b}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="min-w-0">
            <div className="flex flex-col gap-1.5 sm:hidden">
                {rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
                ) : (
                    rows.map((row) => (
                        <article key={row.title} className="rounded-lg border px-2.5 py-2">
                            <h3 className="text-sm leading-snug font-medium">{row.title}</h3>
                            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                                {RATE_COLUMNS.map((column) => (
                                    <div key={column.key} className="min-w-0">
                                        <dt className="text-[0.7rem] leading-none text-muted-foreground">{column.label(axis)}</dt>
                                        <dd className="tabular-nums">{row[column.key]}</dd>
                                    </div>
                                ))}
                            </dl>
                        </article>
                    ))
                )}
            </div>
            <div className="hidden max-w-full overflow-visible rounded-lg border sm:block">
                <Table className="w-full" containerClassName="overflow-visible">
                    <TableHeader>
                        <TableRow>
                            {COLUMNS.map((column) => {
                                const label = column.label(axis);
                                if (!onSort || !sort) {
                                    return (
                                        <TableHead key={column.key} className={headClass}>
                                            {label}
                                        </TableHead>
                                    );
                                }
                                const active = sort.key === column.key;
                                const mark = sort.direction === "asc" ? "↑" : "↓";
                                return (
                                    <TableHead
                                        key={column.key}
                                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                                        className={cn("p-0", headClass)}
                                    >
                                        <button
                                            type="button"
                                            className={cn(
                                                "relative block h-10 w-full px-2 text-left font-medium whitespace-nowrap hover:text-foreground",
                                                active && "text-foreground",
                                            )}
                                            onClick={() => onSort(nextSalesSort(sort, column.key))}
                                        >
                                            {label}
                                            {active ? <span className="absolute top-1 right-1 text-xs" aria-hidden="true">{mark}</span> : null}
                                        </button>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} className={cn("h-24 text-center whitespace-normal text-muted-foreground", cellBorder)}>
                                    {emptyText}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow key={row.title}>
                                    <TableCell className={cn("font-medium whitespace-normal", cellBorder)}>{row.title}</TableCell>
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.stm}</TableCell>
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.nonStm}</TableCell>
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.im}</TableCell>
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.b2b}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export function nextSalesSort(current: SalesSort, key: SalesSortColumn): SalesSort {
    if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    }
    return { key, direction: key === "title" ? "asc" : "desc" };
}

export function compareSalesRows(left: TariffRow, right: TariffRow, sort: SalesSort): number {
    const primary = directedCompare(left, right, sort.key, sort.direction);
    if (primary !== 0) {
        return primary;
    }
    return left.title.localeCompare(right.title, "ru");
}

function directedCompare(left: TariffRow, right: TariffRow, key: SalesSortColumn, direction: SalesSortDirection): number {
    const order = direction === "asc" ? 1 : -1;
    if (key === "title") {
        return left.title.localeCompare(right.title, "ru") * order;
    }
    return (tariffNumber(left[key]) - tariffNumber(right[key])) * order;
}

function tariffNumber(value: string): number {
    const normalized = value.replace(/\s/g, "").replace(",", ".").replace("%", "").replace("₽", "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function salesRowUnit(row: TariffRow): "percent" | "money" {
    return row.stm.includes("%") ? "percent" : "money";
}
