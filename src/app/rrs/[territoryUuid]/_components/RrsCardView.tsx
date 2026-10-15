"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Asterisk, BadgeCheck, ChevronDown, FlaskConical, History, WandSparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { versionStatusTitle, type BasketVersionStatus } from "@/lib/baskets";
import type { RrsBasketOffer, RrsCard, RrsVersionOffer } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { RrsPeriodControls } from "../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../_components/RrsSectionNav";
import { buildForms, describePeriodEffect, formatMonth, type BasketForm } from "../../_components/model";
import { RrsHistoryPanel } from "./RrsHistoryPanel";

export function RrsCardView() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [card, setCard] = useState<RrsCard | null>(null);
    const [forms, setForms] = useState<BasketForm[]>([]);
    const [openBasketIds, setOpenBasketIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (period?: string) => {
        if (!period) {
            setLoading(true);
        }
        setError(null);
        const query = period ? `?period=${encodeURIComponent(period)}` : "";
        const response = await fetch(`/api/rrs/cards/${territoryUuid}${query}`);
        const json = (await response.json()) as ApiResponse<RrsCard>;
        if (!json.success) {
            setError(json.error.message);
            if (!period) {
                setCard(null);
            }
            setLoading(false);
            return;
        }
        setCard(json.data);
        setForms(buildForms(json.data.baskets, json.data.connections));
        setLoading(false);
    }, [territoryUuid]);

    useEffect(() => {
        void load(requestedPeriod ?? undefined);
    }, [load, requestedPeriod]);

    function toggleBasketDetails(basketId: number) {
        setOpenBasketIds((current) => (
            current.includes(basketId) ? current.filter((id) => id !== basketId) : [...current, basketId]
        ));
    }

    const columns = card
        ? forms
            .filter((form) => form.connected)
            .map((form) => {
                const basket = card.baskets.find((item) => item.id === form.basketId);
                const version = basket?.versions.find((item) => item.id === form.versionId);
                return basket ? { form, basket, version } : null;
            })
            .filter((column): column is { form: BasketForm; basket: RrsBasketOffer; version: RrsVersionOffer | undefined } => column !== null)
        : [];

    return (
        <Tabs defaultValue="set" className="w-full gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={card?.territory.name}
                active="baskets"
                period={card?.period ?? requestedPeriod}
                subnav={card ? (
                    <TabsList>
                        <TabsTrigger value="set">Состав</TabsTrigger>
                        <TabsTrigger value="history">
                            <History />
                            История
                        </TabsTrigger>
                    </TabsList>
                ) : null}
                controls={(
                    <>
                        {card ? (
                            <RrsPeriodControls
                                period={card.period}
                                appliedPeriod={card.appliedPeriod}
                                savedPeriods={card.savedPeriods}
                                hint={cardPeriodHint(card)}
                                onPeriodChange={(period) => {
                                    const saved = card.savedPeriods.map((item) => item.period);
                                    const target = saved.includes(period) ? period : connectionCardPeriod(period, saved);
                                    router.replace(`/rrs/${territoryUuid}/baskets?period=${target}`);
                                }}
                            />
                        ) : null}
                        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                            {card ? (
                                <Link href={`/rrs/${territoryUuid}/edit?period=${card.period}`} className={buttonVariants({ size: "sm", className: "shrink-0" })}>
                                    <WandSparkles />
                                    Запустить мастер настройки корзин
                                </Link>
                            ) : null}
                            <HelpDrawer title="Набор корзин">
                                <BasketHelp />
                            </HelpDrawer>
                        </div>
                    </>
                )}
            />
            <FormAlert message={error} />
            {loading && !card ? <p className="text-sm text-muted-foreground">Загрузка корзин...</p> : null}
            {card ? (
                <>
                    <TabsContent value="set" className="flex flex-col gap-4">
                        {columns.length === 0 ? <p className="text-sm text-muted-foreground">В этом периоде нет подключённых корзин.</p> : null}
                        <div className="flex flex-col gap-2">
                        {columns.map(({ basket, form, version }) => {
                        const open = openBasketIds.includes(basket.id);
                        const parameters = version?.parameters ?? [];
                        return (
                            <section key={basket.id} className="overflow-hidden rounded-lg border">
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-1.5 px-3 py-3 text-left hover:bg-muted/50"
                                    aria-expanded={open}
                                    aria-label={open ? `Свернуть ${basket.name}` : `Описание и версия ${basket.name}`}
                                    onClick={() => toggleBasketDetails(basket.id)}
                                >
                                    <span className="text-sm font-medium">{basket.name}</span>
                                    {basket.mandatory ? (
                                        <Asterisk className="size-3.5 text-primary" aria-label="Обязательная" />
                                    ) : null}
                                    <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open ? "rotate-0" : "-rotate-90")} />
                                </button>
                                {open ? (
                                    <div className="flex flex-col gap-1 border-t px-3 py-2 text-xs text-muted-foreground">
                                        {basket.description.trim() ? <p>{basket.description}</p> : null}
                                        {version ? (
                                            <span className="inline-flex items-center gap-1">
                                                {version.name}
                                                <VersionStatusIcon status={version.status} />
                                            </span>
                                        ) : (
                                            <span className="text-destructive">Нет версии</span>
                                        )}
                                        {version?.description.trim() ? <p>{version.description}</p> : null}
                                    </div>
                                ) : null}
                                {parameters.length === 0 ? (
                                    <p className="border-t px-3 py-3 text-sm text-muted-foreground">Параметров нет</p>
                                ) : (
                                    <dl className="border-t">
                                        {parameters.map((parameter) => (
                                            <div key={parameter.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b px-3 py-2 last:border-b-0">
                                                <dt className="text-sm text-muted-foreground" title={parameter.description}>{parameter.title}</dt>
                                                <dd className="text-sm">{(form.values[parameter.key] ?? "").trim() || "—"}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </section>
                        );
                    })}
                        </div>
                    </TabsContent>
                    <TabsContent value="history">
                        <RrsHistoryPanel territoryUuid={territoryUuid} period={card.period} />
                    </TabsContent>
                </>
            ) : null}
        </Tabs>
    );
}

function cardPeriodHint(card: RrsCard): { text: string; tone: "future" | "current" | "past" } {
    const effect = describePeriodEffect(card);
    if (effect.kind === "future") {
        return { tone: "future", text: `Показан набор корзин с ${formatMonth(card.period)}. Более ранние месяцы останутся без изменений.` };
    }
    if (effect.kind === "past") {
        return { tone: "past", text: "Показан сохранённый набор корзин за выбранный месяц." };
    }
    return { tone: "current", text: "Показан действующий набор корзин." };
}

function BasketHelp() {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Состав</h3>
                <p className="text-muted-foreground">Показаны корзины, подключённые на выбранный месяц, и заполненные параметры.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Изменение</h3>
                <p className="text-muted-foreground">Кнопка «Запустить мастер настройки корзин» открывает мастер. Набор записывается на выбранный месяц, более ранние месяцы при этом не изменяются.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">История</h3>
                <p className="text-muted-foreground">Вкладка «История» показывает, кто менял набор в выбранном месяце и что было до сохранения.</p>
            </section>
        </div>
    );
}

function VersionStatusIcon({ status }: { status: BasketVersionStatus }) {
    const className = cn("size-3.5", status === "test" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");
    if (status === "test") {
        return <FlaskConical className={className} aria-label={versionStatusTitle(status)} />;
    }
    return <BadgeCheck className={className} aria-label={versionStatusTitle(status)} />;
}
