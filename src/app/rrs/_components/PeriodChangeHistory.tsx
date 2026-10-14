"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-alert";
import type { RrsFieldChangeEvent } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { formatSavedAt } from "./model";

export function PeriodChangeHistory({
    territoryUuid,
    period,
    source,
    reloadToken,
}: {
    territoryUuid: string;
    period: string;
    source: "motivation" | "coefficients";
    reloadToken: number;
}) {
    const [events, setEvents] = useState<RrsFieldChangeEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/rrs/cards/${territoryUuid}/${source}/history?period=${encodeURIComponent(period)}`);
                const json = (await response.json()) as ApiResponse<RrsFieldChangeEvent[]>;
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
                    setEvents([]);
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
    }, [period, reloadToken, source, territoryUuid]);

    return (
        <div className="flex flex-col gap-3">
            <FormAlert message={error} />
            {loading ? <p className="text-sm text-muted-foreground">Загрузка истории...</p> : null}
            {!loading && !error && events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Изменений за этот месяц пока нет.</p>
            ) : null}
            {events.map((event, eventIndex) => (
                <article key={`${event.at}:${event.by}:${eventIndex}`} className="flex flex-col gap-3 rounded-lg border p-3">
                    <div>
                        <p className="text-sm font-medium">{formatSavedAt(event.at)}</p>
                        <p className="text-sm text-muted-foreground">Внёс {event.by}</p>
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] gap-x-2 text-xs text-muted-foreground">
                        <span>Было</span>
                        <span />
                        <span>Стало</span>
                    </div>
                    {event.changes.map((change, changeIndex) => (
                        <div key={`${change.title}:${changeIndex}`} className="flex flex-col gap-0.5 rounded-md bg-muted/70 px-1 py-1 text-sm">
                            <span className="text-xs text-muted-foreground">{change.title}</span>
                            <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-baseline gap-x-2">
                                <span className="min-w-0 break-words text-muted-foreground">{change.before}</span>
                                <span className="text-center text-muted-foreground" aria-hidden>→</span>
                                <span className={cn("min-w-0 break-words font-medium")}>{change.after}</span>
                            </div>
                        </div>
                    ))}
                </article>
            ))}
        </div>
    );
}
