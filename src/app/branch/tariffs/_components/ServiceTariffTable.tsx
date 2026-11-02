"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ServiceTariffRow } from "../../_components/mock";

export type ServiceSortColumn = "title" | "sale" | "provision";
export type ServiceSortDirection = "asc" | "desc";
export type ServiceSort = { key: ServiceSortColumn; direction: ServiceSortDirection };

const COLUMNS: { key: ServiceSortColumn; label: string }[] = [
    { key: "title", label: "Услуга" },
    { key: "sale", label: "За продажу" },
    { key: "provision", label: "За оказание" },
];

export function ServiceTariffTable({
    rows,
    sort,
    onSort,
    bordered = false,
    emptyText = "Ничего не найдено по этим фильтрам.",
}: {
    rows: ServiceTariffRow[];
    sort?: ServiceSort;
    onSort?: (sort: ServiceSort) => void;
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
                                <TableHead key={column.key}>{column.label}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.title}>
                                <TableCell className="max-w-52 font-medium whitespace-normal">{row.title}</TableCell>
                                <TableCell className="tabular-nums">{row.sale}</TableCell>
                                <TableCell className="tabular-nums">{row.provision}</TableCell>
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
                                <div className="min-w-0">
                                    <dt className="text-[0.7rem] leading-none text-muted-foreground">За продажу</dt>
                                    <dd className="tabular-nums">{row.sale}</dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-[0.7rem] leading-none text-muted-foreground">За оказание</dt>
                                    <dd className="tabular-nums">{row.provision}</dd>
                                </div>
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
                                if (!onSort || !sort) {
                                    return (
                                        <TableHead key={column.key} className={headClass}>
                                            {column.label}
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
                                            onClick={() => onSort(nextServiceSort(sort, column.key))}
                                        >
                                            {column.label}
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
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.sale}</TableCell>
                                    <TableCell className={cn(cellBorder, "tabular-nums")}>{row.provision}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export function nextServiceSort(current: ServiceSort, key: ServiceSortColumn): ServiceSort {
    if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    }
    return { key, direction: key === "title" ? "asc" : "desc" };
}

export function compareServiceRows(left: ServiceTariffRow, right: ServiceTariffRow, sort: ServiceSort): number {
    const order = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "title") {
        const byTitle = left.title.localeCompare(right.title, "ru") * order;
        return byTitle !== 0 ? byTitle : 0;
    }
    const primary = (tariffNumber(left[sort.key]) - tariffNumber(right[sort.key])) * order;
    if (primary !== 0) {
        return primary;
    }
    return left.title.localeCompare(right.title, "ru");
}

function tariffNumber(value: string): number {
    const normalized = value.replace(/\s/g, "").replace(",", ".").replace("%", "").replace("₽", "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}
