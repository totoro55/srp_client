"use client";

import { useEffect, useState } from "react";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";
import { PageControls } from "@/app/admin/_components/PageControls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LOGIN_ACCESS_SOURCE_LABELS, type LoginAccessSource } from "@/lib/login-journal";
import { notifyError } from "@/lib/notify";

interface DirectoryUser {
    id: number;
    username: string;
    displayName: string;
    email: string | null;
    department: string | null;
    title: string;
    firstLoginAt: string | null;
    lastLoginAt: string | null;
    lastIp: string | null;
}

interface LoginEvent {
    id: string;
    success: boolean;
    ip: string | null;
    userAgent: string | null;
    title: string | null;
    accessSource: LoginAccessSource | null;
    roleName: string | null;
    titleChanged: boolean;
    createdAt: string;
}

interface UserPage {
    items: DirectoryUser[];
    page: number;
    pageSize: number;
    total: number;
    departments: string[];
}

export function UsersDirectory() {
    const [users, setUsers] = useState<DirectoryUser[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [department, setDepartment] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [selected, setSelected] = useState<DirectoryUser | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedQuery((current) => (current === query ? current : query));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ page: String(page) });
            if (debouncedQuery) params.set("q", debouncedQuery);
            if (department) params.set("department", department);
            void fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const json = await response.json();
                    if (!json.success) {
                        notifyError(json.error?.message ?? "Не удалось загрузить пользователей");
                        return;
                    }
                    const data = json.data as UserPage;
                    setUsers(data.items);
                    setDepartments(data.departments);
                    setPage(data.page);
                    setPageSize(data.pageSize);
                    setTotal(data.total);
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    notifyError("Не удалось загрузить пользователей");
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoaded(true);
                });
        }, 0);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [debouncedQuery, department, page]);

    const filtered = query.trim() !== "" || department !== "";

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 pb-20 md:pb-0">
            <HistoryDialog key={selected?.id ?? "closed"} user={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
            <AdminToolbar search={query} onSearchChange={(value) => { setQuery(value); setPage(1); }} searchPlaceholder="Имя, логин, почта или должность">
                <select
                    value={department}
                    onChange={(event) => { setDepartment(event.target.value); setPage(1); }}
                    aria-label="Подразделение"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-52"
                >
                    <option value="">Все подразделения</option>
                    {departments.map((item) => (
                        <option key={item} value={item}>{item}</option>
                    ))}
                </select>
                {filtered ? (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setQuery(""); setDepartment(""); setPage(1); }}>
                        Сбросить
                    </Button>
                ) : null}
            </AdminToolbar>
            <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Имя</TableHead>
                            <TableHead>Логин</TableHead>
                            <TableHead>Должность</TableHead>
                            <TableHead>Подразделение</TableHead>
                            <TableHead>Последний вход</TableHead>
                            <TableHead>Адрес</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loaded ? <TableSkeleton columns={7} rows={6} /> : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                                    {filtered ? "Никого не найдено." : "Пока никто не входил."}
                                </TableCell>
                            </TableRow>
                        ) : users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.displayName}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.title || "—"}</TableCell>
                                <TableCell>{user.department || "—"}</TableCell>
                                <TableCell className="whitespace-nowrap">{formatWhen(user.lastLoginAt)}</TableCell>
                                <TableCell>{user.lastIp || "—"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-end">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(user)}>
                                            История
                                        </Button>
                                    </div>
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

function HistoryDialog({ user, onOpenChange }: { user: DirectoryUser | null; onOpenChange: (open: boolean) => void }) {
    const [events, setEvents] = useState<LoginEvent[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!user) return;
        const controller = new AbortController();
        void fetch(`/api/admin/users/logins?userId=${user.id}&page=${page}`, { signal: controller.signal })
            .then(async (response) => {
                const json = await response.json();
                if (!json.success) {
                    notifyError(json.error?.message ?? "Не удалось загрузить историю входов");
                    return;
                }
                setEvents(json.data.items);
                setPage(json.data.page);
                setPageSize(json.data.pageSize);
                setTotal(json.data.total);
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                notifyError("Не удалось загрузить историю входов");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoaded(true);
            });
        return () => controller.abort();
    }, [user, page]);

    return (
        <Dialog open={user !== null} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>{user?.displayName ?? "История входов"}</DialogTitle>
                    {user ? (
                        <DialogDescription>
                            {user.username}{user.email ? ` · ${user.email}` : ""}
                        </DialogDescription>
                    ) : null}
                </DialogHeader>
                <Table containerClassName="max-h-[60vh]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Время</TableHead>
                            <TableHead>Адрес</TableHead>
                            <TableHead>Браузер</TableHead>
                            <TableHead>Должность</TableHead>
                            <TableHead>Роль</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loaded ? <TableSkeleton columns={5} rows={4} /> : events.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                    История входов пуста.
                                </TableCell>
                            </TableRow>
                        ) : events.map((event) => (
                            <TableRow key={event.id}>
                                <TableCell className="whitespace-nowrap">{formatWhen(event.createdAt)}</TableCell>
                                <TableCell>{event.ip || "—"}</TableCell>
                                <TableCell className="max-w-56 truncate" title={event.userAgent ?? undefined}>
                                    {event.userAgent || "—"}
                                </TableCell>
                                <TableCell>
                                    {event.title || "—"}
                                    {event.titleChanged ? <span className="text-muted-foreground"> · изменена</span> : null}
                                </TableCell>
                                <TableCell>
                                    {event.roleName || "—"}
                                    {event.accessSource ? (
                                        <span className="text-muted-foreground"> · {LOGIN_ACCESS_SOURCE_LABELS[event.accessSource]}</span>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {loaded ? <PageControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} /> : null}
            </DialogContent>
        </Dialog>
    );
}

function formatWhen(value: string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("ru-RU");
}
