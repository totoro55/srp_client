"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Asterisk, BadgeCheck, ChevronDown, FlaskConical, Pencil, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/form-alert";
import { versionStatusTitle, type BasketVersionStatus } from "@/lib/baskets";
import type { RrsBasketOffer, RrsCard, RrsVersionOffer } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { buildForms, describePeriodEffect, formatMonth, selectClassName, type BasketForm, type PeriodEffectKind } from "../../_components/model";
import { RrsHistoryPanel } from "./RrsHistoryPanel";

export function RrsCardView() {
    const params = useParams<{ territoryUuid: string }>();
    const territoryUuid = params.territoryUuid;
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
        void load();
    }, [load]);

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
            .sort((left, right) => Number(right.basket.mandatory) - Number(left.basket.mandatory) || left.basket.name.localeCompare(right.basket.name, "ru"))
        : [];

    return (
        <div className="@container flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                <Link href="/rrs" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <ArrowLeft />
                    К списку
                </Link>
                {card ? <h2 className="text-base font-semibold">{card.territory.name}</h2> : null}
            </div>
            <FormAlert message={error} />
            {loading ? <p className="text-sm text-muted-foreground">Загрузка карточки...</p> : null}
            {card ? (
                <div className="grid items-start gap-x-4 gap-y-2 @min-[36rem]:grid-cols-2">
                    <div className="flex flex-col gap-2 @min-[36rem]:col-start-1 @min-[36rem]:row-start-1">
                            <div className="flex min-h-9 flex-wrap items-center gap-2">
                                <h3 className="flex items-center gap-2 text-base font-semibold">
                                    <ShoppingBasket className="size-5" />
                                    Корзины
                                </h3>
                                <Link href={`/rrs/${territoryUuid}/edit?period=${card.period}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "ml-auto")}>
                                    <Pencil />
                                    Изменить
                                </Link>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="flex min-w-0 items-center gap-2 text-sm">
                                    <span className="text-muted-foreground">Период</span>
                                    <select
                                        value={card.period}
                                        aria-label="Период"
                                        className={cn(selectClassName, "h-8 w-auto max-w-full")}
                                        onChange={(event) => {
                                            void load(event.target.value);
                                        }}
                                    >
                                        {[...card.savedPeriods].sort((left, right) => left.period.localeCompare(right.period)).map((item) => (
                                            <option key={item.period} value={item.period}>
                                                {formatMonth(item.period)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <PeriodBadge card={card} />
                            </div>
                    </div>
                        <div className="flex flex-col gap-2 @min-[36rem]:col-start-1 @min-[36rem]:row-start-2">
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
                    <RrsHistoryPanel territoryUuid={territoryUuid} />
                </div>
            ) : null}
        </div>
    );
}

const PERIOD_BADGE_CLASS: Record<PeriodEffectKind, string> = {
    current: "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    future: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    past: "border-border bg-muted text-muted-foreground",
};

function PeriodBadge({ card }: { card: RrsCard }) {
    const effect = describePeriodEffect(card);
    return (
        <Badge variant="outline" className={cn("h-auto max-w-full gap-1.5 whitespace-normal px-2.5 py-1 text-left font-normal leading-snug", PERIOD_BADGE_CLASS[effect.kind])}>
            <span className="font-medium">{effect.title}</span>
            <span>{effect.detail}</span>
        </Badge>
    );
}

function VersionStatusIcon({ status }: { status: BasketVersionStatus }) {
    const className = cn("size-3.5", status === "test" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");
    if (status === "test") {
        return <FlaskConical className={className} aria-label={versionStatusTitle(status)} />;
    }
    return <BadgeCheck className={className} aria-label={versionStatusTitle(status)} />;
}
