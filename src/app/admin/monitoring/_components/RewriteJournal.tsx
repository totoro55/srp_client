"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, CheckIcon, ListFilter, RefreshCwIcon, Search, SettingsIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { RecalcJournalLog } from "@/components/recalc-journal";
import { ButtonSpinner } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { parseJournalQuery } from "@/lib/journal-query";
import { useRecalcPlan } from "@/lib/recalc-plan";
import { cn } from "@/lib/utils";
import { JOURNAL_REFRESH_INTERVALS, readJournalRefresh, writeJournalRefresh, type JournalRefreshId } from "./journal-refresh";
import type { BasketRecalcRun, BasketUpdateKind, RecalcRunStatus } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

interface JournalPage {
    events: BasketRecalcRun[];
    hasMore: boolean;
}

const BASKET_OPTIONS: { id: BasketUpdateKind | "all"; label: string }[] = [
    { id: "all", label: "Все корзины" },
    { id: "sale", label: "Продажа товара" },
    { id: "release", label: "Выдача товара" },
    { id: "kassa", label: "Кассовые операции" },
    { id: "osnt", label: "ОСНТ" },
    { id: "warehouse", label: "Складские операции" },
    { id: "unloading", label: "Разгрузка ТС" },
    { id: "selection", label: "Набор товара" },
    { id: "shared", label: "Общая премия" },
    { id: "tariffs", label: "Тарифы продажи" },
    { id: "brigade", label: "Доли бригады" },
];

const STATUS_OPTIONS: { id: RecalcRunStatus | "all"; label: string }[] = [
    { id: "all", label: "Все статусы" },
    { id: "running", label: "Идёт" },
    { id: "success", label: "Готово" },
    { id: "failed", label: "Ошибка" },
    { id: "cancelled", label: "Отменён" },
];

export function RewriteJournal({
    initial,
    basket = null,
    status = null,
    query = null,
    from = null,
    to = null,
    preview = false,
}: {
    initial: JournalPage;
    basket?: BasketUpdateKind | null;
    status?: RecalcRunStatus | null;
    query?: string | null;
    from?: string | null;
    to?: string | null;
    preview?: boolean;
}) {
    const router = useRouter();
    const [events, setEvents] = useState(initial.events);
    const [hasMore, setHasMore] = useState(initial.hasMore);
    const [intervalSeconds, setIntervalSeconds] = useState<JournalRefreshId>("5");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [filterOpen, setFilterOpen] = useState(false);
    const [datesOpen, setDatesOpen] = useState(false);
    const [draft, setDraft] = useState(query ?? "");
    const [refreshing, setRefreshing] = useState(false);
    const [olderPending, setOlderPending] = useState(false);
    const olderLock = useRef(false);
    const generation = useRef(0);
    const plan = useRecalcPlan();

    const reload = useCallback(async (manual: boolean) => {
        const ticket = generation.current;
        if (manual) {
            setRefreshing(true);
        }
        try {
            const response = await fetch(journalRequest(viewOf(basket, status, query, from, to)));
            const json = (await response.json()) as ApiResponse<JournalPage>;
            if (ticket !== generation.current) {
                return;
            }
            if (json.success) {
                setEvents((current) => {
                    const next = forJournal(mergeJournal(forJournal(current, basket, status), json.data.events), basket, status);
                    return sameEvents(current, next) ? current : next;
                });
            }
        } catch {
            if (ticket !== generation.current) {
                return;
            }
            if (manual) {
                setRefreshing(false);
            }
            return;
        }
        if (ticket !== generation.current) {
            return;
        }
        if (manual) {
            setRefreshing(false);
        }
    }, [basket, status, query, from, to]);

    const loadOlder = useCallback(async () => {
        if (olderLock.current) {
            return;
        }
        const oldest = events[0];
        if (!oldest || !hasMore) {
            return;
        }
        const ticket = generation.current;
        olderLock.current = true;
        setOlderPending(true);
        try {
            const response = await fetch(journalRequest(viewOf(basket, status, query, from, to), oldest.id));
            const json = (await response.json()) as ApiResponse<JournalPage>;
            if (ticket !== generation.current) {
                return;
            }
            if (json.success) {
                setEvents((current) => forJournal(mergeJournal(json.data.events, forJournal(current, basket, status)), basket, status));
                setHasMore(json.data.hasMore);
            }
        } catch {
            if (ticket !== generation.current) {
                return;
            }
            olderLock.current = false;
            setOlderPending(false);
            return;
        }
        if (ticket !== generation.current) {
            return;
        }
        olderLock.current = false;
        setOlderPending(false);
    }, [basket, status, query, from, to, events, hasMore]);

    useEffect(() => {
        generation.current += 1;
        setEvents(initial.events);
        setHasMore(initial.hasMore);
        olderLock.current = false;
        setOlderPending(false);
    }, [initial, basket, status, query, from, to]);

    useEffect(() => {
        setDraft((current) => (parseJournalQuery(current) === query ? current : (query ?? "")));
    }, [query]);

    useEffect(() => {
        setIntervalSeconds(readJournalRefresh());
    }, []);

    useEffect(() => {
        if (preview) {
            return;
        }
        void reload(false);
    }, [preview, reload]);

    useEffect(() => {
        const seconds = Number(intervalSeconds);
        if (preview || !Number.isFinite(seconds) || seconds <= 0) {
            return;
        }
        const timer = setInterval(() => {
            void reload(false);
        }, seconds * 1000);
        return () => clearInterval(timer);
    }, [intervalSeconds, preview, reload]);

    useEffect(() => {
        if (preview) {
            return;
        }
        const timer = window.setTimeout(() => {
            const next = parseJournalQuery(draft);
            if (next === query) {
                return;
            }
            openJournal(router, viewOf(basket, status, next, from, to));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [draft, query, basket, status, from, to, preview, router]);

    function showJournal(nextBasket: BasketUpdateKind | null, nextStatus: RecalcRunStatus | null) {
        setFilterOpen(false);
        openJournal(router, viewOf(nextBasket, nextStatus, query, from, to));
    }

    function showDates(nextFrom: string | null, nextTo: string | null, close: boolean) {
        const ordered = nextFrom && nextTo && nextFrom > nextTo
            ? { from: nextTo, to: nextFrom }
            : { from: nextFrom, to: nextTo };
        openJournal(router, viewOf(basket, status, query, ordered.from, ordered.to));
        if (close || (!ordered.from && !ordered.to)) {
            setDatesOpen(false);
        }
    }

    const filtered = basket !== null || status !== null;
    const dated = from !== null || to !== null;
    const narrowed = filtered || query !== null || dated;
    const selectedRange: DateRange | undefined = dated
        ? { from: from ? journalDay(from) : undefined, to: to ? journalDay(to) : undefined }
        : undefined;

    return (
        <Card className="flex min-h-0 w-full flex-1 flex-col border">
            <CardHeader className="max-sm:grid-cols-1!">
                <CardTitle className="max-sm:hidden">Журнал</CardTitle>
                <CardAction className="max-sm:col-start-1! max-sm:w-full max-sm:min-w-0 max-sm:justify-self-stretch!">
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                        <InputGroup className="h-8 w-full min-w-0 sm:w-64">
                            <InputGroupAddon>
                                <Search />
                            </InputGroupAddon>
                            <InputGroupInput
                                value={draft}
                                placeholder="Филиал, автор, условие"
                                aria-label="Поиск по журналу"
                                disabled={preview}
                                className="h-8 min-w-0 max-sm:text-sm"
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        const next = parseJournalQuery(draft);
                                        if (next !== query) {
                                            openJournal(router, viewOf(basket, status, next, from, to));
                                        }
                                    }
                                }}
                            />
                            {draft !== "" ? (
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton aria-label="Очистить поиск" size="icon-xs" onClick={() => setDraft("")}>
                                        <X />
                                    </InputGroupButton>
                                </InputGroupAddon>
                            ) : null}
                        </InputGroup>
                        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                        <Popover open={datesOpen} onOpenChange={setDatesOpen}>
                            <PopoverTrigger
                                render={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label={dateFilterLabel(from, to)}
                                        disabled={preview}
                                        className={cn(dated && "text-primary")}
                                    />
                                }
                            >
                                <CalendarIcon />
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-auto gap-0 p-0">
                                <Calendar
                                    mode="range"
                                    locale={ru}
                                    defaultMonth={selectedRange?.from ?? selectedRange?.to}
                                    selected={selectedRange}
                                    onSelect={(range) => {
                                        const nextFrom = range?.from ? dayKey(range.from) : null;
                                        const nextTo = range?.to ? dayKey(range.to) : null;
                                        showDates(nextFrom, nextTo, Boolean(nextFrom && nextTo && nextFrom !== nextTo));
                                    }}
                                />
                                {dated ? (
                                    <div className="border-t p-2">
                                        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => showDates(null, null, true)}>
                                            Сбросить
                                        </Button>
                                    </div>
                                ) : null}
                            </PopoverContent>
                        </Popover>
                        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                            <PopoverTrigger
                                render={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label={filterLabel(basket, status)}
                                        className={cn(filtered && "text-primary")}
                                    />
                                }
                            >
                                <ListFilter />
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72">
                                <PopoverHeader>
                                    <PopoverTitle>Фильтр</PopoverTitle>
                                    <PopoverDescription>Корзина и статус запуска.</PopoverDescription>
                                </PopoverHeader>
                                <div className="flex flex-col gap-1" role="listbox" aria-label="Корзина">
                                    <p className="px-2 text-xs font-medium text-muted-foreground">Корзина</p>
                                    {BASKET_OPTIONS.map((item) => (
                                        <FilterChoice
                                            key={item.id}
                                            label={item.label}
                                            selected={item.id === (basket ?? "all")}
                                            onSelect={() => showJournal(item.id === "all" ? null : item.id, status)}
                                        />
                                    ))}
                                </div>
                                <div className="flex flex-col gap-1 border-t pt-3" role="listbox" aria-label="Статус">
                                    <p className="px-2 text-xs font-medium text-muted-foreground">Статус</p>
                                    {STATUS_OPTIONS.map((item) => (
                                        <FilterChoice
                                            key={item.id}
                                            label={item.label}
                                            selected={item.id === (status ?? "all")}
                                            onSelect={() => showJournal(basket, item.id === "all" ? null : item.id)}
                                        />
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button type="button" variant="outline" size="icon-sm" aria-label="Обновить" disabled={refreshing || preview} onClick={() => void reload(true)}>
                            {refreshing ? <ButtonSpinner /> : <RefreshCwIcon />}
                        </Button>
                        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                            <PopoverTrigger
                                render={<Button type="button" variant="outline" size="icon-sm" aria-label="Настройки обновления" />}
                            >
                                <SettingsIcon />
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72">
                                <PopoverHeader>
                                    <PopoverTitle>Обновление журнала</PopoverTitle>
                                    <PopoverDescription>Как часто перечитывать запуски.</PopoverDescription>
                                </PopoverHeader>
                                <div className="flex flex-col gap-1" role="listbox" aria-label="Частота обновления журнала">
                                    {JOURNAL_REFRESH_INTERVALS.map((item) => {
                                        const selected = item.id === intervalSeconds;
                                        return (
                                            <Button
                                                key={item.id}
                                                type="button"
                                                variant="ghost"
                                                role="option"
                                                aria-selected={selected}
                                                className={cn("justify-between", selected && "bg-muted")}
                                                onClick={() => {
                                                    writeJournalRefresh(item.id);
                                                    setIntervalSeconds(item.id);
                                                    setSettingsOpen(false);
                                                }}
                                            >
                                                {item.label}
                                                {selected ? <CheckIcon /> : null}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>
                        </div>
                    </div>
                </CardAction>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
                <RecalcJournalLog
                    key={`${basket ?? "all"}:${status ?? "all"}:${query ?? ""}:${from ?? ""}:${to ?? ""}`}
                    events={events}
                    plan={preview || narrowed ? null : plan}
                    preview={preview}
                    olderPending={olderPending}
                    onNearTop={preview ? undefined : () => void loadOlder()}
                    emptyLabel={narrowed ? "Таких запусков нет." : undefined}
                    notice={preview ? <PreviewNotice /> : narrowed ? <FilterNotice basket={basket} status={status} query={query} from={from} to={to} /> : null}
                />
            </CardContent>
        </Card>
    );
}

function FilterChoice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
    return (
        <Button
            type="button"
            variant="ghost"
            role="option"
            aria-selected={selected}
            className={cn("justify-between", selected && "bg-muted")}
            onClick={onSelect}
        >
            {label}
            {selected ? <CheckIcon /> : null}
        </Button>
    );
}

function filterLabel(basket: BasketUpdateKind | null, status: RecalcRunStatus | null): string {
    const parts = [
        basket === null ? null : BASKET_OPTIONS.find((item) => item.id === basket)?.label,
        status === null ? null : STATUS_OPTIONS.find((item) => item.id === status)?.label,
    ].filter((part): part is string => typeof part === "string");
    return parts.length === 0 ? "Фильтр" : `Фильтр: ${parts.join(", ")}`;
}

function FilterNotice({
    basket,
    status,
    query,
    from,
    to,
}: {
    basket: BasketUpdateKind | null;
    status: RecalcRunStatus | null;
    query: string | null;
    from: string | null;
    to: string | null;
}) {
    const basketName = basket === null ? null : BASKET_OPTIONS.find((item) => item.id === basket)?.label;
    const statusName = status === null ? null : STATUS_OPTIONS.find((item) => item.id === status)?.label.toLocaleLowerCase("ru-RU");
    const when = datePhrase(from, to);
    const sentences = [
        basketName && statusName ? `Загрузки и пересчёты корзины «${basketName}» со статусом «${statusName}».` : "",
        !statusName && basketName ? "Загрузки и пересчёты выбранной корзины. Остальные корзины в этот список не попадают." : "",
        !basketName && statusName ? `Только запуски со статусом «${statusName}».` : "",
        query ? `По запросу «${query}».` : "",
        when ? `${when.charAt(0).toUpperCase()}${when.slice(1)}.` : "",
    ].filter((sentence) => sentence !== "");
    return <p className="text-sm text-muted-foreground max-sm:text-xs">{sentences.join(" ")}</p>;
}

function PreviewNotice() {
    return (
        <p className="text-sm text-muted-foreground max-sm:text-xs">
            Пример очереди после сохранения настроек РРС. Это не выполненный запуск. Одновременно считается одна запись, следующая начинается после неё.
        </p>
    );
}

interface JournalView {
    basket: BasketUpdateKind | null;
    status: RecalcRunStatus | null;
    query: string | null;
    from: string | null;
    to: string | null;
}

function viewOf(
    basket: BasketUpdateKind | null,
    status: RecalcRunStatus | null,
    query: string | null,
    from: string | null,
    to: string | null,
): JournalView {
    return { basket, status, query, from, to };
}

function openJournal(router: ReturnType<typeof useRouter>, view: JournalView) {
    const params = new URLSearchParams({ tab: "journal" });
    if (view.basket) {
        params.set("basket", view.basket);
    }
    if (view.status) {
        params.set("status", view.status);
    }
    if (view.query) {
        params.set("q", view.query);
    }
    if (view.from) {
        params.set("from", view.from);
    }
    if (view.to) {
        params.set("to", view.to);
    }
    router.replace(`/admin/monitoring?${params.toString()}`);
}

function journalRequest(view: JournalView, before?: number): string {
    const params = new URLSearchParams();
    if (view.basket) {
        params.set("kind", view.basket);
    }
    if (view.status) {
        params.set("status", view.status);
    }
    if (view.query) {
        params.set("q", view.query);
    }
    if (view.from) {
        params.set("from", view.from);
    }
    if (view.to) {
        params.set("to", view.to);
    }
    if (before !== undefined) {
        params.set("before", String(before));
    }
    const search = params.toString();
    return search === "" ? "/api/admin/monitoring/journal" : `/api/admin/monitoring/journal?${search}`;
}

function journalDay(value: string): Date {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function dayKey(date: Date): string {
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFilterLabel(from: string | null, to: string | null): string {
    const phrase = datePhrase(from, to);
    return phrase === null ? "Даты запуска" : `Даты запуска: ${phrase}`;
}

function datePhrase(from: string | null, to: string | null): string | null {
    if (!from && !to) {
        return null;
    }
    if (from && (!to || from === to)) {
        return `за ${format(journalDay(from), "d MMMM yyyy", { locale: ru })}`;
    }
    if (!from && to) {
        return `по ${format(journalDay(to), "d MMMM yyyy", { locale: ru })}`;
    }
    return `с ${format(journalDay(from!), "d MMMM", { locale: ru })} по ${format(journalDay(to!), "d MMMM yyyy", { locale: ru })}`;
}

function forJournal(events: BasketRecalcRun[], basket: BasketUpdateKind | null, status: RecalcRunStatus | null): BasketRecalcRun[] {
    return events.filter((event) => (basket === null || event.kind === basket) && (status === null || event.status === status));
}

function mergeJournal(older: BasketRecalcRun[], newer: BasketRecalcRun[]): BasketRecalcRun[] {
    const byId = new Map<number, BasketRecalcRun>();
    for (const event of older) {
        byId.set(event.id, event);
    }
    for (const event of newer) {
        byId.set(event.id, event);
    }
    return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id - right.id);
}

function sameEvents(left: BasketRecalcRun[], right: BasketRecalcRun[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((event, index) => {
        const other = right[index];
        return event.id === other.id
            && event.status === other.status
            && event.finishedAt === other.finishedAt
            && event.lines === other.lines
            && event.error === other.error
            && event.scopeLabel === other.scopeLabel
            && event.trigger === other.trigger;
    });
}
