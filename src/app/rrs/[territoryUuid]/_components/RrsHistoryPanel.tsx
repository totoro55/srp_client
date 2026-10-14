"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormAlert } from "@/components/form-alert";
import type { RrsHistoryEvent } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { buildHistorySteps, formatMonthFrom, formatSavedAt, selectClassName, type HistoryDiffBasket } from "../../_components/model";
import { cn } from "@/lib/utils";

export function RrsHistoryPanel({ territoryUuid }: { territoryUuid: string }) {
    const [events, setEvents] = useState<RrsHistoryEvent[]>([]);
    const [index, setIndex] = useState(0);
    const [changedFrom, setChangedFrom] = useState("");
    const [changedTo, setChangedTo] = useState("");
    const [authorFilter, setAuthorFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            setIndex(0);
            setChangedFrom("");
            setChangedTo("");
            setAuthorFilter("");
            try {
                const response = await fetch(`/api/rrs/cards/${territoryUuid}/history`);
                const json = (await response.json()) as ApiResponse<RrsHistoryEvent[]>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    setEvents([]);
                    return;
                }
                setEvents(json.data);
            } catch {
                if (!cancelled) {
                    setError("Не удалось загрузить историю");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }
        void load();
        return () => {
            cancelled = true;
        };
    }, [territoryUuid]);

    const steps = useMemo(() => buildHistorySteps(events), [events]);
    const authorOptions = useMemo(
        () => [...new Set(steps.map((step) => step.by))].sort((left, right) => left.localeCompare(right, "ru")),
        [steps],
    );
    const filtered = steps.filter((step) => {
        const changedOn = localDay(step.at);
        if (changedFrom && changedOn < changedFrom) {
            return false;
        }
        if (changedTo && changedOn > changedTo) {
            return false;
        }
        if (authorFilter && step.by !== authorFilter) {
            return false;
        }
        return true;
    });
    const step = filtered[index] ?? null;
    const visibleBaskets = (step?.baskets ?? []).filter((basket) => basketChanged(basket));

    return (
        <div className="flex flex-col gap-3">
            {steps.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                        <span className="shrink-0 text-muted-foreground">Дата</span>
                        <HistoryRangePicker
                            from={changedFrom}
                            to={changedTo}
                            onChange={(from, to) => {
                                setChangedFrom(from);
                                setChangedTo(to);
                                setIndex(0);
                            }}
                        />
                    </div>
                    <label className="flex min-w-64 items-center gap-2 text-sm">
                        <span className="shrink-0 text-muted-foreground">Автор</span>
                        <select
                            value={authorFilter}
                            aria-label="Автор изменения"
                            className={cn(selectClassName, "h-8 min-w-0 flex-1")}
                            onChange={(event) => {
                                setAuthorFilter(event.target.value);
                                setIndex(0);
                            }}
                        >
                            <option value="">Все</option>
                            {authorOptions.map((author) => (
                                <option key={author} value={author}>{author}</option>
                            ))}
                        </select>
                    </label>
                {filtered.length > 0 ? (
                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={index === 0}
                            aria-label="Более позднее изменение"
                            onClick={() => setIndex((current) => Math.max(0, current - 1))}
                        >
                            <ChevronLeft />
                        </Button>
                        <span className="min-w-12 text-center text-xs text-muted-foreground" aria-live="polite">
                            {index + 1} из {filtered.length}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            disabled={index >= filtered.length - 1}
                            aria-label="Более раннее изменение"
                            onClick={() => setIndex((current) => Math.min(filtered.length - 1, current + 1))}
                        >
                            <ChevronRight />
                        </Button>
                    </div>
                ) : null}
                </div>
            ) : null}
            <div className="flex flex-col gap-3 rounded-lg border p-3">
            <FormAlert message={error} />
            {loading ? <p className="text-sm text-muted-foreground">Загрузка истории...</p> : null}
            {!loading && steps.length === 0 && !error ? (
                <p className="text-sm text-muted-foreground">Изменений пока нет.</p>
            ) : null}
            {!loading && steps.length > 0 && filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет изменений по выбранным фильтрам.</p>
            ) : null}
            {step ? (
                <div className="flex flex-col gap-3">
                    <div>
                        <p className="text-sm font-medium">{formatSavedAt(step.at)}</p>
                        <p className="text-sm text-muted-foreground">С {formatMonthFrom(step.period)} · {step.by}</p>
                    </div>
                    {visibleBaskets.map((basket) => (
                        <section key={basket.basketId} className="flex flex-col gap-2 border-t pt-3">
                            <h4 className="text-sm font-medium">{basket.basketName}</h4>
                            <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground">
                                <span>Было</span>
                                <span />
                                <span>Стало</span>
                            </div>
                            {basket.versionChanged ? (
                                <DiffLine title="Версия" before={basket.beforeVersion} after={basket.afterVersion} changed />
                            ) : null}
                            {basket.rows.filter((row) => row.changed).map((row) => (
                                <DiffLine key={row.title} title={row.title} before={row.before} after={row.after} changed />
                            ))}
                        </section>
                    ))}
                </div>
            ) : null}
            </div>
        </div>
    );
}

function basketChanged(basket: HistoryDiffBasket): boolean {
    return basket.versionChanged || basket.rows.some((row) => row.changed);
}

function HistoryRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
    const fromDate = parseDay(from);
    const toDate = parseDay(to);
    const selected = fromDate || toDate ? { from: fromDate, to: toDate } : undefined;
    const label = rangeLabel(from, to);

    return (
        <div className="flex min-w-0 flex-1 items-center gap-1">
            <Popover>
                <PopoverTrigger
                    render={
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 min-w-0 flex-1 justify-start px-2.5 font-normal"
                        >
                            <CalendarIcon className="text-muted-foreground" />
                            <span className={cn("truncate", !from && !to && "text-muted-foreground")} title={label}>
                                {label}
                            </span>
                        </Button>
                    }
                />
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="range"
                        selected={selected}
                        onSelect={(range) => {
                            onChange(range?.from ? toDayString(range.from) : "", range?.to ? toDayString(range.to) : "");
                        }}
                        numberOfMonths={1}
                        locale={ru}
                        defaultMonth={fromDate ?? toDate ?? new Date()}
                    />
                </PopoverContent>
            </Popover>
            {from || to ? (
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Сбросить даты" onClick={() => onChange("", "")}>
                    <X />
                </Button>
            ) : null}
        </div>
    );
}

function rangeLabel(from: string, to: string): string {
    if (from && to) {
        return `${formatPickerDay(from)} – ${formatPickerDay(to)}`;
    }
    if (from) {
        return `с ${formatPickerDay(from)}`;
    }
    if (to) {
        return `по ${formatPickerDay(to)}`;
    }
    return "Все даты";
}

function formatPickerDay(iso: string): string {
    const date = parseDay(iso);
    return date ? format(date, "d MMM yyyy", { locale: ru }) : "";
}

function parseDay(value: string): Date | undefined {
    if (!value) {
        return undefined;
    }
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function toDayString(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function localDay(iso: string): string {
    const date = new Date(iso);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function DiffLine({ title, before, after, changed }: { title: string; before: string; after: string; changed: boolean }) {
    return (
        <div className={cn("flex flex-col gap-0.5 text-sm", changed && "rounded-md bg-muted/70 px-1 py-1")}>
            <span className="text-xs text-muted-foreground">{title}</span>
            <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-baseline gap-x-2">
                <span className="min-w-0 break-words text-muted-foreground">{before}</span>
                <span className="text-center text-muted-foreground" aria-hidden>{changed ? "→" : ""}</span>
                <span className={cn("min-w-0 break-words", changed && "font-medium")}>{after}</span>
            </div>
        </div>
    );
}
