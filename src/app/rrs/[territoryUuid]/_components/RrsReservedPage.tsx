"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormAlert } from "@/components/form-alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { RrsCard } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { RrsPeriodControls } from "../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav, type RrsSection } from "../../_components/RrsSectionNav";
import { describePeriodEffect, formatMonth } from "../../_components/model";

const PATH: Partial<Record<RrsSection, string>> = {
    overview: "",
    tariffs: "/tariffs",
    access: "/access",
    delegation: "/delegation",
};

export function RrsReservedPage({ section, message }: { section: "overview" | "tariffs" | "access" | "delegation"; message: string }) {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [card, setCard] = useState<RrsCard | null>(null);
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
        setLoading(false);
    }, [territoryUuid]);

    useEffect(() => {
        void load(requestedPeriod ?? undefined);
    }, [load, requestedPeriod]);

    const path = PATH[section] ?? "";
    const showsPeriod = section === "tariffs";

    return (
        <div className="flex w-full flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={card?.territory.name}
                active={section}
                period={showsPeriod ? (card?.period ?? requestedPeriod) : card?.period}
                cardPeriod={card ? connectionCardPeriod(card.period, card.savedPeriods.map((item) => item.period)) : requestedPeriod}
                controls={showsPeriod && card ? (
                    <RrsPeriodControls
                        period={card.period}
                        appliedPeriod={card.appliedPeriod}
                        savedPeriods={card.savedPeriods}
                        hint={reservedPeriodHint(card)}
                        onPeriodChange={(period) => {
                            const saved = card.savedPeriods.map((item) => item.period);
                            const target = saved.includes(period) ? period : connectionCardPeriod(period, saved);
                            router.replace(`/rrs/${territoryUuid}${path}?period=${target}`);
                        }}
                    />
                ) : null}
            />
            <FormAlert message={error} />
            {loading && !card ? <Skeleton className="h-24 w-full rounded-lg" aria-busy="true" /> : null}
            {card ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{message}</p>
            ) : null}
        </div>
    );
}

function reservedPeriodHint(card: RrsCard): { text: string; tone: "future" | "current" | "past" } {
    const effect = describePeriodEffect(card);
    if (effect.kind === "future") {
        return { tone: "future", text: `Показан период с ${formatMonth(card.period)}. Более ранние месяцы останутся без изменений.` };
    }
    if (effect.kind === "past") {
        return { tone: "past", text: "Показан выбранный месяц." };
    }
    return { tone: "current", text: "Показан действующий месяц." };
}
