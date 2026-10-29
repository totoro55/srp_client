"use client";

import { useEffect, useState } from "react";
import type { TariffExceptionPage } from "@/lib/tariff-exceptions";
import type { RrsConnectionInput } from "@/lib/rrs";
import { ApiResponse } from "@/types/api";
import { TariffExceptions, type WizardTariffDraft } from "./TariffExceptions";

export function WizardTariffStep({
    territoryUuid,
    period,
    items,
    onDraft,
}: {
    territoryUuid: string;
    period: string;
    items: RrsConnectionInput[];
    onDraft: (draft: WizardTariffDraft | null) => void;
}) {
    const [page, setPage] = useState<TariffExceptionPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const signature = JSON.stringify(items);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setPage(null);
        setError(null);
        onDraft(null);
        async function load() {
            try {
                const response = await fetch("/api/rrs/wizard/tariffs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ territoryUuid, period, items: JSON.parse(signature) as RrsConnectionInput[] }),
                });
                const json = (await response.json()) as ApiResponse<TariffExceptionPage>;
                if (cancelled) {
                    return;
                }
                if (!json.success) {
                    setPage(null);
                    setError(json.error.message);
                    return;
                }
                setPage(json.data);
            } catch {
                if (!cancelled) {
                    setPage(null);
                    setError("Не удалось рассчитать тарифы");
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
    }, [onDraft, period, signature, territoryUuid]);

    return (
        <TariffExceptions
            embedded={{
                territoryUuid,
                page,
                loading,
                error,
                onDraft,
            }}
        />
    );
}
