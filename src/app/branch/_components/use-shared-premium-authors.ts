"use client";

import { useEffect, useState } from "react";

export interface SharedPremiumAuthor {
    id: string;
    name: string;
    title: string;
    kind: "staff" | "promoter" | "system";
    sale: number;
    release: number;
    kassa: number;
    osnt: number;
    warehouse: number;
    unloading: number;
    activeFrom: string;
}

interface AuthorState {
    key: string;
    loading: boolean;
    authors: SharedPremiumAuthor[];
    error: string | null;
}

export function useSharedPremiumAuthors(branchId: string, period: string): {
    loading: boolean;
    authors: SharedPremiumAuthor[];
    error: string | null;
} {
    const key = branchId !== "" && period !== "" ? `${branchId.toLowerCase()}|${period}` : "";
    const [state, setState] = useState<AuthorState>({ key: "", loading: false, authors: [], error: null });

    useEffect(() => {
        if (key === "") {
            return;
        }
        const controller = new AbortController();
        const params = new URLSearchParams({ period, branch: branchId });
        fetch(`/api/branch/shared-premium/authors?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
            .then(async (response) => {
                const body = await response.json() as { success?: boolean; data?: SharedPremiumAuthor[]; error?: { message?: string } };
                if (controller.signal.aborted) {
                    return;
                }
                if (!response.ok || !body.success || !Array.isArray(body.data)) {
                    throw new Error(body.error?.message || "Не удалось прочитать авторов общей премии");
                }
                setState({ key, loading: false, authors: body.data, error: null });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
                    return;
                }
                setState({
                    key,
                    loading: false,
                    authors: [],
                    error: error instanceof Error ? error.message : "Не удалось прочитать авторов общей премии",
                });
            });
        return () => controller.abort();
    }, [branchId, key, period]);

    if (key === "") {
        return { loading: false, authors: [], error: null };
    }
    if (state.key !== key) {
        return { loading: true, authors: [], error: null };
    }
    return { loading: state.loading, authors: state.authors, error: state.error };
}
