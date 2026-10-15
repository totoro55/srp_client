"use client";

import { useEffect, useMemo, useState } from "react";
import type { RrsFieldChange, RrsHistoryEvent } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { ChangeHistoryList } from "../../_components/PeriodChangeHistory";
import { buildHistorySteps } from "../../_components/model";

export function RrsHistoryPanel({ territoryUuid, period }: { territoryUuid: string; period: string }) {
    const [events, setEvents] = useState<RrsHistoryEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
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
    }, [territoryUuid]);

    const changes = useMemo(() => historyForPeriod(events, period), [events, period]);

    return <ChangeHistoryList events={changes} loading={loading} error={error} />;
}

function historyForPeriod(events: RrsHistoryEvent[], period: string) {
    const month = period.slice(0, 7);
    return buildHistorySteps(events).flatMap((step) => {
        if (step.period.slice(0, 7) !== month) {
            return [];
        }
        const changes = step.baskets.flatMap((basket) => {
            const rows: RrsFieldChange[] = [];
            if (basket.versionChanged) {
                rows.push({
                    title: `${basket.basketName} · Версия`,
                    before: basket.beforeVersion,
                    after: basket.afterVersion,
                });
            }
            for (const row of basket.rows) {
                if (!row.changed) {
                    continue;
                }
                rows.push({
                    title: `${basket.basketName} · ${row.title}`,
                    before: row.before,
                    after: row.after,
                });
            }
            return rows;
        }).sort((left, right) => left.title.localeCompare(right.title, "ru"));
        if (changes.length === 0) {
            return [];
        }
        return [{ at: step.at, by: step.by, changes }];
    });
}
