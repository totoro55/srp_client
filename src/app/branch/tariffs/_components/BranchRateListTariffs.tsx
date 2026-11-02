"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpDown, BookOpen, RotateCcw, Search, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBranchLocation } from "../../_components/BranchFrame";
import { branchMonth, type ServiceTariffRow } from "../../_components/mock";
import {
    compareServiceRows,
    nextServiceSort,
    ServiceTariffTable,
    type ServiceSort,
    type ServiceSortColumn,
} from "./ServiceTariffTable";

const SORT_OPTIONS: { key: ServiceSortColumn; label: string }[] = [
    { key: "title", label: "Услуга" },
    { key: "sale", label: "За продажу" },
    { key: "provision", label: "За оказание" },
];

export function BranchRateListTariffs({
    title,
    rows,
}: {
    title: string;
    rows: ServiceTariffRow[];
}) {
    const { branchId, period } = useBranchLocation();
    const month = branchMonth(branchId, period);
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<ServiceSort>({ key: "title", direction: "asc" });

    if (!month.inMotivation) {
        return <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Филиал в этом месяце не участвует в мотивации. Ставки как действующие не показаны.</p>;
    }

    const needle = query.trim().toLowerCase();
    const filtersActive = needle !== "";
    const visible = !month.tariffsSaved
        ? []
        : rows
            .filter((row) => !needle || row.title.toLowerCase().includes(needle))
            .slice()
            .sort((left, right) => compareServiceRows(left, right, sort));

    return (
        <>
            <Card className="min-w-0 max-w-full overflow-visible [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(6)]">
                <CardHeader className="gap-1 sm:gap-1.5">
                    <CardTitle className="min-w-0">{title}</CardTitle>
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
                    {!month.tariffsSaved ? (
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
                                        placeholder="Услуга"
                                        aria-label="Услуга"
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
                                <div className="sm:hidden">
                                    <Popover>
                                        <PopoverTrigger
                                            render={
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon-sm"
                                                    aria-label={`Сортировка: ${SORT_OPTIONS.find((item) => item.key === sort.key)?.label ?? ""} ${sort.direction === "asc" ? "↑" : "↓"}`}
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
                                                        onClick={() => setSort(nextServiceSort(sort, option.key))}
                                                    >
                                                        <span>{option.label}</span>
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
                                    onClick={() => setQuery("")}
                                >
                                    <RotateCcw />
                                </Button>
                            </div>
                            <ServiceTariffTable rows={visible} sort={sort} onSort={setSort} bordered />
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
