"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { PageControls } from "@/app/admin/_components/PageControls";
import { FeedbackStatusBadge } from "./FeedbackStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { FeedbackFilePicker } from "./FeedbackFiles";
import {
    FEEDBACK_LIST_SCOPE_LABELS,
    FEEDBACK_STATUSES,
    isFeedbackListScope,
    type FeedbackListScope,
    type FeedbackStatus,
} from "@/lib/content";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

interface Ticket {
    id: number;
    author: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    assigneeName: string | null;
    updatedAt: string;
}

interface TicketPage {
    items: Ticket[];
    page: number;
    pageSize: number;
    total: number;
}

const SCOPES: FeedbackListScope[] = ["open", "all", ...FEEDBACK_STATUSES];

export function FeedbackList() {
    const access = useAccess();
    const canProcess = access.has("feedback:process");
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [scope, setScope] = useState<FeedbackListScope>("open");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [refresh, setRefresh] = useState(0);
    const [formOpen, setFormOpen] = useState(false);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ page: String(page), status: scope });
            const search = debouncedQuery.trim();
            if (search) {
                params.set("q", search);
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
    }, [debouncedQuery, scope, page, refresh]);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            const form = new FormData();
            form.set("subject", subject);
            form.set("body", body);
            for (const file of files) {
                form.append("file", file);
            }
            const response = await fetch("/api/feedback", { method: "POST", body: form });
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setFormError(json.error.message);
                return;
            }
            notifySuccess("Обращение создано");
            setSubject("");
            setBody("");
            setFiles([]);
            setFormOpen(false);
            setQuery("");
            setScope("open");
            setPage(1);
            setRefresh((value) => value + 1);
        } catch {
            setFormError("Не удалось создать обращение");
        } finally {
            setSaving(false);
        }
    }

    const filtered = query.trim() !== "" || scope !== "open";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                    value={query}
                    placeholder="Поиск"
                    aria-label="Поиск"
                    className="sm:max-w-xs"
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                    }}
                />
                <Select value={scope} onValueChange={(value) => {
                    if (isFeedbackListScope(value)) {
                        setScope(value);
                        setPage(1);
                    }
                }}>
                    <SelectTrigger className="w-full sm:w-52" aria-label="Состояние">
                        <SelectValue>
                            {(value) => isFeedbackListScope(value) ? FEEDBACK_LIST_SCOPE_LABELS[value] : FEEDBACK_LIST_SCOPE_LABELS[scope]}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {SCOPES.map((item) => (
                            <SelectItem key={item} value={item}>{FEEDBACK_LIST_SCOPE_LABELS[item]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {filtered ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); setScope("open"); setPage(1); }}>
                        Сбросить
                    </Button>
                ) : null}
                <Button type="button" size="sm" className="sm:ml-auto" onClick={() => setFormOpen(true)}>
                    Новое обращение
                </Button>
            </div>
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
                    <Link key={ticket.id} href={`/feedback/${ticket.id}`} className="block">
                        <Card className="transition-colors hover:bg-muted/40" size="sm">
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle>{ticket.subject}</CardTitle>
                                    <FeedbackStatusBadge status={ticket.status} />
                                </div>
                                <CardDescription>
                                    {canProcess ? `${ticket.author} · ` : ""}
                                    {ticket.assigneeName ? `Ответственный: ${ticket.assigneeName} · ` : ""}
                                    {new Date(ticket.updatedAt).toLocaleString("ru-RU")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="line-clamp-2 text-muted-foreground">{ticket.body}</CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
            {loaded && total > pageSize ? (
                <PageControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            ) : null}
            <Dialog open={formOpen} onOpenChange={(open) => {
                if (!open && !saving) {
                    setFormOpen(false);
                    setFormError(null);
                }
            }}>
                <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-lg">
                    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={onSubmit}>
                        <DialogHeader className="shrink-0">
                            <DialogTitle>Новое обращение</DialogTitle>
                        </DialogHeader>
                        <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
                            <FormAlert message={formError} />
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-subject">Тема</Label>
                                <Input id="feedback-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="feedback-body">Текст</Label>
                                <Textarea
                                    id="feedback-body"
                                    className="max-h-40 resize-y"
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                />
                            </div>
                            <FeedbackFilePicker files={files} disabled={saving} onChange={setFiles} />
                        </div>
                        <DialogFooter className="shrink-0">
                            <Button type="button" variant="outline" disabled={saving} onClick={() => { setFormOpen(false); setFormError(null); }}>
                                Отмена
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? <ButtonSpinner /> : null}
                                Отправить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
