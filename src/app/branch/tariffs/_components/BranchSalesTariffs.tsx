"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpDown, BookOpen, ListFilter, RotateCcw, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBranchLocation } from "../../_components/BranchFrame";
import { branchMonth, salesConditions, salesRowLabel } from "../../_components/mock";
import {
    compareSalesRows,
    nextSalesSort,
    SalesTariffTable,
    salesRowUnit,
    type SalesSort,
    type SalesSortColumn,
} from "./SalesTariffTable";

const SORT_OPTIONS: { key: SalesSortColumn; label: (axis: string) => string }[] = [
    { key: "title", label: salesRowLabel },
    { key: "stm", label: () => "СТМ" },
    { key: "nonStm", label: () => "Не СТМ" },
    { key: "im", label: () => "ИМ" },
    { key: "b2b", label: () => "Безнал" },
];

const UNIT_OPTIONS = [
    { id: "percent", label: "Процент" },
    { id: "money", label: "Рубли" },
] as const;

type UnitId = (typeof UNIT_OPTIONS)[number]["id"];

export function BranchSalesTariffs() {
    const { branchId, period } = useBranchLocation();
    const month = branchMonth(branchId, period);
    const sales = salesConditions(branchId);
    const [query, setQuery] = useState("");
    const [units, setUnits] = useState<UnitId[]>([]);
    const [sort, setSort] = useState<SalesSort>({ key: "title", direction: "asc" });

    if (!month.inMotivation) {
        return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Филиал в этом месяце не участвует в мотивации. Ставки как действующие не показаны.</p>;
    }

    const needle = query.trim().toLowerCase();
    const filtersActive = needle !== "" || units.length > 0;
    const rowLabel = sales ? salesRowLabel(sales.axis) : "Категория";
    const visible = !month.tariffsSaved || !sales
        ? []
        : sales.rows
            .filter((row) => {
                if (units.length > 0 && !units.includes(salesRowUnit(row))) {
                    return false;
                }
                if (!needle) {
                    return true;
                }
                return row.title.toLowerCase().includes(needle);
            })
            .slice()
            .sort((left, right) => compareSalesRows(left, right, sort));

    return (
        <>
            <Card className="min-w-0 max-w-full overflow-visible [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(6)]">
                <CardHeader className="gap-1 sm:gap-1.5">
                    <CardTitle className="min-w-0">Продажа товара</CardTitle>
                    {sales ? <CardDescription>{sales.axis}</CardDescription> : null}
                    <CardAction>
                        <Link
                            href="/wiki"
                            className={cn(
                                buttonVariants({ variant: "outline", size: "icon-sm" }),
                                "sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5",
                            )}
                            aria-label="Описание"
                        >
                            <BookOpen className="size-4" />
                            <span className="hidden sm:inline">Описание</span>
                        </Link>
                    </CardAction>
                </CardHeader>
                <CardContent className="flex min-w-0 flex-col gap-2 sm:gap-3">
                    {!month.tariffsSaved || !sales ? (
                        <p className="text-sm text-muted-foreground">Тарифы ещё не сохранены.</p>
                    ) : (
                        <>
                            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                                <InputGroup className="min-w-0 flex-1 sm:max-w-72">
                                    <InputGroupAddon>
                                        <Search />
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        value={query}
                                        placeholder={rowLabel}
                                        aria-label={rowLabel}
                                        className="min-w-0 text-xs sm:text-sm"
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
                                <Popover>
                                    <PopoverTrigger
                                        render={
                                            <Button type="button" variant="outline" size="icon-sm" aria-label="Фильтр" className={cn("shrink-0 sm:size-9", units.length > 0 && "text-primary")}>
                                                <ListFilter />
                                            </Button>
                                        }
                                    />
                                    <PopoverContent align="end" className="w-56 gap-1 p-2">
                                        <p className="px-2 text-xs font-medium text-muted-foreground">Вид ставки</p>
                                        {UNIT_OPTIONS.map((option) => (
                                            <Label key={option.id} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                                                <Checkbox
                                                    checked={units.includes(option.id)}
                                                    onCheckedChange={() => setUnits((current) => (
                                                        current.includes(option.id)
                                                            ? current.filter((item) => item !== option.id)
                                                            : [...current, option.id]
                                                    ))}
                                                />
                                                <span>{option.label}</span>
                                            </Label>
                                        ))}
                                    </PopoverContent>
                                </Popover>
                                <div className="sm:hidden">
                                    <Popover>
                                        <PopoverTrigger
                                            render={
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    aria-label={`Сортировка: ${SORT_OPTIONS.find((item) => item.key === sort.key)?.label(sales.axis) ?? ""} ${sort.direction === "asc" ? "↑" : "↓"}`}
                                                    className="shrink-0"
                                                >
                                                    <ArrowUpDown />
                                                </Button>
                                            }
                                        />
                                        <PopoverContent align="end" className="w-56 gap-1 p-2">
                                            <p className="px-2 text-xs font-medium text-muted-foreground">Сортировка</p>
                                            {SORT_OPTIONS.map((option) => {
                                                const active = sort.key === option.key;
                                                const mark = sort.direction === "asc" ? "↑" : "↓";
                                                return (
                                                    <button
                                                        key={option.key}
                                                        type="button"
                                                        className={cn(
                                                            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                                                            active && "bg-muted font-medium",
                                                        )}
                                                        onClick={() => setSort(nextSalesSort(sort, option.key))}
                                                    >
                                                        <span>{option.label(sales.axis)}</span>
                                                        {active ? <span aria-hidden="true">{mark}</span> : null}
                                                    </button>
                                                );
                                            })}
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon-sm"
                                    aria-label="Сбросить фильтры"
                                    className="shrink-0 sm:size-9"
                                    disabled={!filtersActive}
                                    onClick={() => {
                                        setQuery("");
                                        setUnits([]);
                                    }}
                                >
                                    <RotateCcw />
                                </Button>
                            </div>
                            <SalesTariffTable
                                axis={sales.axis}
                                rows={visible}
                                sort={sort}
                                onSort={setSort}
                                bordered
                            />
                        </>
                    )}
                </CardContent>
            </Card>
            <ScrollTop />
        </>
    );
}

function ScrollTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        function onScroll() {
            setVisible(window.scrollY > 280);
        }
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <Button
            type="button"
            size="icon"
            variant="outline"
            className="fixed right-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 shadow-md sm:right-4"
            aria-label="Наверх"
            onClick={() => {
                const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                window.scrollTo({ top: 0, behavior });
            }}
        >
            <ArrowUp />
        </Button>
    );
}
