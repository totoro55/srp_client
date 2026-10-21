"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { StackSkeleton } from "@/components/loading-state";
import type { RrsReadiness, RrsTariffReadiness } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { connectionCardPeriod, RrsSectionNav } from "../../_components/RrsSectionNav";
import { formatMonth } from "../../_components/model";

type Tone = "ready" | "missing" | "note";

interface CheckItem {
    key: string;
    title: string;
    detail: string;
    status: string;
    href: string;
    tone: Tone;
}

export function RrsOverview() {
    const params = useParams<{ territoryUuid: string }>();
    const territoryUuid = params.territoryUuid;
    const [readiness, setReadiness] = useState<RrsReadiness | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/rrs/cards/${territoryUuid}/readiness`);
                const json = (await response.json()) as ApiResponse<RrsReadiness>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    setReadiness(null);
                    return;
                }
                setReadiness(json.data);
            } catch {
                if (!cancelled) {
                    setError("Не удалось загрузить сводку");
                    setReadiness(null);
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

    const items = readiness ? checklist(territoryUuid, readiness) : [];
    const requiredReady = items.filter((item) => item.key !== "coefficients").every((item) => item.tone === "ready");

    return (
        <div className="flex w-full flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={readiness?.territory.name}
                active="overview"
                period={readiness?.period}
                cardPeriod={readiness ? connectionCardPeriod(readiness.period, readiness.savedPeriods) : null}
            />
            <FormAlert message={error} />
            {loading && !readiness ? <StackSkeleton rows={4} /> : null}
            {readiness ? (
                <section className="flex max-w-3xl flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        {requiredReady
                            ? `За ${formatMonth(readiness.period)} необходимое настроено.`
                            : `За ${formatMonth(readiness.period)} ещё не всё необходимое настроено.`}
                    </p>
                    <ul className="flex flex-col gap-2">
                        {items.map((item) => {
                            const ready = item.tone === "ready";
                            return (
                                <li key={item.key}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted/40",
                                            item.tone === "missing" && "border-destructive/40 bg-destructive/5 hover:bg-destructive/10",
                                            item.tone === "note" && "border-amber-500/40 bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50",
                                        )}
                                    >
                                        {ready ? (
                                            <CircleCheck className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                                        ) : (
                                            <CircleAlert className={cn("size-4 shrink-0", item.tone === "note" ? "text-amber-700 dark:text-amber-300" : "text-destructive")} />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{item.title}</span>
                                            <span className="block text-sm text-muted-foreground">{item.detail}</span>
                                        </span>
                                        <span className={cn(
                                            "shrink-0 text-sm",
                                            ready && "text-emerald-800 dark:text-emerald-200",
                                            item.tone === "missing" && "text-destructive",
                                            item.tone === "note" && "text-amber-800 dark:text-amber-200",
                                        )}>
                                            {item.status}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ) : null}
        </div>
    );
}

function checklist(territoryUuid: string, readiness: RrsReadiness): CheckItem[] {
    const period = `?period=${encodeURIComponent(readiness.period)}`;
    const basketsReady = readiness.connectedBaskets > 0;
    const branchesReady = readiness.branches.enabled > 0;
    const coefficients = coefficientItem(readiness);
    return [
        {
            key: "baskets",
            title: "Корзины",
            detail: basketsReady ? `Подключено ${readiness.connectedBaskets}` : "Нет подключённых корзин",
            status: basketsReady ? "Готово" : "Нет",
            href: `/rrs/${territoryUuid}/baskets${period}`,
            tone: basketsReady ? "ready" : "missing",
        },
        {
            key: "branches",
            title: "Филиалы",
            detail: branchDetail(readiness),
            status: branchesReady ? "Готово" : "Нет",
            href: `/rrs/${territoryUuid}/motivation${period}`,
            tone: branchesReady ? "ready" : "missing",
        },
        {
            key: "coefficients",
            title: "Коэффициенты",
            detail: coefficients.detail,
            status: coefficients.status,
            href: `/rrs/${territoryUuid}/coefficients${period}`,
            tone: coefficients.tone,
        },
        {
            key: "tariffs",
            title: "Тарифы",
            detail: tariffDetail(readiness.tariffs, readiness.period),
            status: readiness.tariffs === "calculated" ? "Рассчитаны" : "Нет",
            href: `/rrs/${territoryUuid}/tariffs${period}`,
            tone: readiness.tariffs === "calculated" ? "ready" : "missing",
        },
    ];
}

function branchDetail(readiness: RrsReadiness): string {
    if (readiness.branches.total === 0) {
        return "У территории нет филиалов";
    }
    if (readiness.branches.enabled === 0) {
        return "Нет включённых филиалов";
    }
    return `Включено ${readiness.branches.enabled} из ${readiness.branches.total}`;
}

function coefficientItem(readiness: RrsReadiness): { detail: string; status: string; tone: Tone } {
    const { defined, saved, expected } = readiness.coefficients;
    if (defined === 0) {
        return { tone: "ready", status: "Не требуются", detail: "У подключённых версий нет коэффициентов" };
    }
    if (readiness.branches.enabled === 0) {
        return { tone: "ready", status: "После филиалов", detail: "Появятся после включения филиалов" };
    }
    if (saved >= expected) {
        return { tone: "ready", status: "Настроены", detail: "Заполнены для включённых филиалов" };
    }
    const detail = saved === 0
        ? "Не заполнены. В расчёте для пустых остаётся 1"
        : `Заполнено ${saved} из ${expected}. Для пустых остаётся 1`;
    return { tone: "note", status: "Не настроены", detail };
}

function tariffDetail(state: RrsTariffReadiness, period: string): string {
    const month = formatMonth(period);
    if (state === "calculated") {
        return `Рассчитаны за ${month}`;
    }
    if (state === "no-sales") {
        return "Корзина продаж не подключена";
    }
    if (state === "no-axis") {
        return "У версии корзины продаж не выбран вид расчёта";
    }
    return `За ${month} ещё не рассчитаны`;
}
