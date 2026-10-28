"use client";

import { useEffect, useState } from "react";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";
import { PageControls } from "@/components/page-controls";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOGIN_FAILURE_LABELS, LOGIN_FAILURE_REASONS, type LoginFailureReason } from "@/lib/login-journal";
import { notifyError } from "@/lib/notify";

interface FailedLogin {
    id: string;
    username: string;
    ip: string | null;
    userAgent: string | null;
    failureReason: LoginFailureReason | null;
    createdAt: string;
}

export function FailedLogins() {
    const [events, setEvents] = useState<FailedLogin[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [reason, setReason] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedQuery((current) => (current === query ? current : query));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ outcome: "failure", page: String(page) });
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (reason) params.set("reason", reason);
            void fetch(`/api/admin/users/logins?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const json = await response.json();
                    if (!json.success) {
                        notifyError(json.error?.message ?? "Не удалось загрузить неуспешные входы");
                        return;
                    }
                    setEvents(json.data.items);
                    setPage(json.data.page);
                    setPageSize(json.data.pageSize);
                    setTotal(json.data.total);
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    notifyError("Не удалось загрузить неуспешные входы");
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoaded(true);
                });
        }, 0);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [debouncedQuery, reason, page]);

    const filtered = query.trim() !== "" || reason !== "";

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 pb-20 md:pb-0">
            <AdminToolbar search={query} onSearchChange={(value) => { setQuery(value); setPage(1); }} searchPlaceholder="Логин, адрес или браузер">
                <select
                    value={reason}
                    onChange={(event) => { setReason(event.target.value); setPage(1); }}
                    aria-label="Причина"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-56"
                >
                    <option value="">Все причины</option>
                    {LOGIN_FAILURE_REASONS.map((item) => (
                        <option key={item} value={item}>{LOGIN_FAILURE_LABELS[item]}</option>
                    ))}
                </select>
                {filtered ? (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setQuery(""); setReason(""); setPage(1); }}>
                        Сбросить
                    </Button>
                ) : null}
            </AdminToolbar>
            <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Время</TableHead>
                            <TableHead>Логин</TableHead>
                            <TableHead>Причина</TableHead>
                            <TableHead>Адрес</TableHead>
                            <TableHead>Браузер</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loaded ? <TableSkeleton columns={5} rows={6} /> : events.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                    {filtered ? "Ничего не найдено." : "Неуспешных входов пока нет."}
                                </TableCell>
                            </TableRow>
                        ) : events.map((event) => (
                            <TableRow key={event.id}>
                                <TableCell className="whitespace-nowrap">{formatWhen(event.createdAt)}</TableCell>
                                <TableCell>{event.username}</TableCell>
                                <TableCell>{event.failureReason ? LOGIN_FAILURE_LABELS[event.failureReason] : "Отказ"}</TableCell>
                                <TableCell>{event.ip || "—"}</TableCell>
                                <TableCell className="max-w-80 truncate" title={event.userAgent ?? undefined}>
                                    {event.userAgent || "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {loaded ? <PageControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} /> : null}
        </div>
    );
}

function formatWhen(value: string): string {
    return new Date(value).toLocaleString("ru-RU");
}
