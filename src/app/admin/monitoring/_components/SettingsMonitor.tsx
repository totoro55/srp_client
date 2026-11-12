"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SettingsMonitorData, SettingsTerritory, TariffReadiness } from "@/services/service-monitor";

const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

const COMPANY_LINKS: Record<string, string> = {
    "price-growth": "/admin/price-growth",
    stm: "/admin/stm-brands",
    roles: "/admin/motivation-roles",
    algorithms: "/admin/tariff-algorithms",
};

export function SettingsMonitor({ data }: { data: SettingsMonitorData }) {
    const router = useRouter();
    const [onlyMissing, setOnlyMissing] = useState(false);
    const readyCount = data.territories.filter(territoryReady).length;
    const visible = onlyMissing ? data.territories.filter((row) => !territoryReady(row)) : data.territories;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-2">
                    <Select value={data.period} onValueChange={(next) => {
                        if (typeof next !== "string") {
                            return;
                        }
                        router.replace(`/admin/monitoring?tab=settings&period=${next.slice(0, 7)}`);
                    }}>
                        <SelectTrigger className="w-56" aria-label="Месяц настроек">
                            <SelectValue>{() => formatMonth(data.period)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {data.periods.map((period) => (
                                <SelectItem key={period} value={period}>{formatMonth(period)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                        {data.territories.length === 0
                            ? "За этот месяц ни одна РРС не подключена к корзинам."
                            : `Готовы ${readyCount} из ${data.territories.length}.`}
                    </p>
                </div>
                <div className="flex gap-1">
                    <Button type="button" size="sm" variant={onlyMissing ? "ghost" : "secondary"} onClick={() => setOnlyMissing(false)}>
                        Подключённые
                    </Button>
                    <Button type="button" size="sm" variant={onlyMissing ? "secondary" : "ghost"} onClick={() => setOnlyMissing(true)}>
                        С пробелами
                    </Button>
                </div>
            </div>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.company.map((item) => {
                    const href = COMPANY_LINKS[item.id];
                    const className = "rounded-xl border bg-card px-4 py-3";
                    const body = (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-sm text-muted-foreground">{item.title}</h2>
                                <Badge variant={item.ready ? "secondary" : "outline"}>{item.ready ? "Есть" : "Нет"}</Badge>
                            </div>
                            <p className="mt-2 text-sm font-medium tabular-nums">{item.value}</p>
                            <p className="text-sm text-muted-foreground">{item.detail}</p>
                        </>
                    );
                    return href
                        ? <Link key={item.id} href={href} className={`${className} transition-colors hover:bg-muted/40`}>{body}</Link>
                        : <article key={item.id} className={className}>{body}</article>;
                })}
            </section>
            <section className="flex flex-col gap-2">
                {visible.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        {data.territories.length === 0 ? "Подключённых РРС нет." : "У подключённых РРС пробелов нет."}
                    </p>
                ) : visible.map((row) => {
                    const ready = territoryReady(row);
                    return (
                        <article key={row.uuid} className="rounded-xl border bg-card px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link href={`/rrs/${row.uuid}`} className="font-medium hover:underline">{row.name}</Link>
                                    <p className="text-sm text-muted-foreground">{`${row.code} · корзин ${row.connectedBaskets}`}</p>
                                </div>
                                <Badge variant={ready ? "secondary" : "outline"}>{ready ? "Готово" : "Есть пробелы"}</Badge>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <Fact label="Филиалы" value={branchText(row)} gap={row.branchesTotal > 0 && row.branchesEnabled === 0} href={rrsSettingHref(row.uuid, data.period, "motivation")} />
                                <Fact label="Коэффициенты" value={coefficientText(row)} gap={coefficientMissing(row)} href={rrsSettingHref(row.uuid, data.period, "coefficients")} />
                                <Fact label="Тарифы" value={tariffText(row.tariffs)} gap={row.tariffs === "missing" || row.tariffs === "no-axis"} href={rrsSettingHref(row.uuid, data.period, "tariffs")} />
                            </div>
                        </article>
                    );
                })}
            </section>
        </div>
    );
}

function Fact({ label, value, gap, href }: { label: string; value: string; gap: boolean; href: string }) {
    return (
        <Link href={href} className="group rounded-md outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="block text-xs text-muted-foreground underline-offset-4 group-hover:underline">{label}</span>
            <span className={gap ? "block text-sm text-amber-800 dark:text-amber-200" : "block text-sm"}>{value}</span>
        </Link>
    );
}

function rrsSettingHref(territoryUuid: string, period: string, page: "motivation" | "coefficients" | "tariffs"): string {
    return `/rrs/${territoryUuid}/${page}?period=${encodeURIComponent(period)}`;
}

function territoryReady(row: SettingsTerritory): boolean {
    return row.branchesEnabled > 0 && !coefficientMissing(row) && row.tariffs !== "missing" && row.tariffs !== "no-axis";
}

function coefficientMissing(row: SettingsTerritory): boolean {
    return row.coefficientsDefined > 0 && row.branchesEnabled > 0 && row.coefficientsSaved < row.coefficientsExpected;
}

function branchText(row: SettingsTerritory): string {
    if (row.branchesTotal === 0) {
        return "Нет филиалов";
    }
    if (row.branchesEnabled === 0) {
        return "Нет включённых";
    }
    return `${row.branchesEnabled} из ${row.branchesTotal}`;
}

function coefficientText(row: SettingsTerritory): string {
    if (row.coefficientsDefined === 0) {
        return "Не требуются";
    }
    if (row.branchesEnabled === 0) {
        return "После филиалов";
    }
    if (row.coefficientsSaved >= row.coefficientsExpected) {
        return "Заполнены";
    }
    if (row.coefficientsSaved === 0) {
        return "Не заполнены";
    }
    return `${row.coefficientsSaved} из ${row.coefficientsExpected}`;
}

function tariffText(state: TariffReadiness): string {
    if (state === "calculated") {
        return "Рассчитаны";
    }
    if (state === "no-sales") {
        return "Продажа не подключена";
    }
    if (state === "no-axis") {
        return "Нет вида расчёта";
    }
    return "Не рассчитаны";
}

function formatMonth(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toUpperCase() + label.slice(1);
}
