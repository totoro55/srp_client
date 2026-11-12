"use client";

import { useEffect, useState } from "react";
import { useBranchLocation } from "../../_components/BranchFrame";
import type { BranchTariffPage } from "@/services/branch-tariffs";

export function useBranchTariffs(): {
    pending: boolean;
    error: string | null;
    page: BranchTariffPage | null;
} {
    const { branchId, period } = useBranchLocation();
    const [pending, setPending] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState<BranchTariffPage | null>(null);

    useEffect(() => {
        if (branchId === "") {
            setPending(false);
            setPage(null);
            setError("Выберите филиал");
            return;
        }
        const controller = new AbortController();
        setPending(true);
        setError(null);
        const params = new URLSearchParams({ branch: branchId, period });
        fetch(`/api/branch/tariffs?${params.toString()}`, { signal: controller.signal })
            .then(async (response) => {
                const json = await response.json() as { success?: boolean; data?: BranchTariffPage; error?: { message?: string } };
                if (!response.ok || !json.success || !json.data) {
                    throw new Error(json.error?.message || "Не удалось прочитать тарифы");
                }
                setPage(json.data);
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") {
                    return;
                }
                setPage(null);
                setError(reason instanceof Error ? reason.message : "Не удалось прочитать тарифы");
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setPending(false);
                }
            });
        return () => controller.abort();
    }, [branchId, period]);

    return { pending, error, page };
}
