"use client";

import { useEffect, useState } from "react";
import { PageControls } from "@/components/page-controls";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { StackSkeleton } from "@/components/loading-state";
import { FeedbackCreate } from "./FeedbackCreate";
import { FeedbackFilters, OPEN_STATUSES, feedbackFiltersActive, sameMembers, type CategoryOption, type KindOption } from "./FeedbackFilters";
import { FeedbackTicketCard, type FeedbackListItem } from "./FeedbackTicketCard";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/content";
import { useAccess } from "@/hooks/useAccess";
import { ApiResponse } from "@/types/api";

interface TicketPage {
    items: FeedbackListItem[];
    page: number;
    pageSize: number;
    total: number;
}

export function FeedbackList() {
    const access = useAccess();
    const canProcess = access.has("feedback:process");
    const [tickets, setTickets] = useState<FeedbackListItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [statuses, setStatuses] = useState<FeedbackStatus[]>(OPEN_STATUSES);
    const [kinds, setKinds] = useState<KindOption[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ page: String(page) });
            const search = debouncedQuery.trim();
            if (search) {
                params.set("q", search);
            }
            if (statuses.length === 0 || sameMembers(statuses, FEEDBACK_STATUSES)) {
                params.set("status", "all");
            } else if (!sameMembers(statuses, OPEN_STATUSES)) {
                for (const status of statuses) {
                    params.append("status", status);
                }
            }
            for (const kind of kinds) {
                params.append("kind", kind);
            }
            for (const category of categories) {
                params.append("category", category);
            }
            void fetch(`/api/feedback?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const json = (await response.json()) as ApiResponse<TicketPage>;
                    if (!json.success) {
                        setError(json.error.message);
                        return;
                    }
                    setError(null);
                    setTickets(json.data.items);
                    setPage(json.data.page);
                    setPageSize(json.data.pageSize);
                    setTotal(json.data.total);
                })
                .catch((reason: unknown) => {
                    if (reason instanceof DOMException && reason.name === "AbortError") {
                        return;
                    }
                    setError("Не удалось загрузить обращения");
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoaded(true);
                    }
                });
        }, 0);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [debouncedQuery, statuses, kinds, categories, page, refresh]);

    const filtered = feedbackFiltersActive(query, statuses, kinds, categories);

    function resetFilters() {
        setQuery("");
        setStatuses(OPEN_STATUSES);
        setKinds([]);
        setCategories([]);
        setPage(1);
    }

    function refreshAfterCreate() {
        resetFilters();
        setRefresh((value) => value + 1);
    }

    return (
        <div className="flex flex-col gap-4">
            <FeedbackCreate onCreated={refreshAfterCreate} />
            <FeedbackFilters
                query={query}
                statuses={statuses}
                kinds={kinds}
                categories={categories}
                onQuery={(value) => {
                    setQuery(value);
                    setPage(1);
                }}
                onStatuses={(value) => {
                    setStatuses(value);
                    setPage(1);
                }}
                onKinds={(value) => {
                    setKinds(value);
                    setPage(1);
                }}
                onCategories={(value) => {
                    setCategories(value);
                    setPage(1);
                }}
                onReset={resetFilters}
            />
            <FormAlert message={error} />
            {!loaded ? <StackSkeleton /> : null}
            {loaded && error === null && tickets.length === 0 ? (
                <Card>
                    <CardContent className="text-sm text-muted-foreground">
                        {filtered ? "Ничего не найдено" : "Обращений пока нет"}
                    </CardContent>
                </Card>
            ) : null}
            <div className="flex flex-col gap-3">
                {tickets.map((ticket) => (
                    <FeedbackTicketCard key={ticket.id} ticket={ticket} canProcess={canProcess} />
                ))}
            </div>
            {loaded && total > pageSize ? (
                <PageControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            ) : null}
        </div>
    );
}
