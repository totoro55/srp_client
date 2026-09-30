'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { AdminToolbar } from "@/app/admin/_components/AdminToolbar";
import { ConfirmDialog } from "@/app/admin/_components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/hooks/useAccess";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RoleOption {
    id: number;
    name: string;
}

interface RuleRow {
    id: number;
    priority: number;
    matchType: "login" | "title";
    matchValue: string;
    roleId: number;
    roleName: string;
    expiresAt: string | null;
}

interface EmployeeLookup {
    login: string;
    name: string;
    title: string;
    branch: string;
}

function toDateInput(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function RulesEditor() {
    const access = useAccess();
    const canWrite = access.has("access.write");
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [rules, setRules] = useState<RuleRow[]>([]);
    const [conflicts, setConflicts] = useState<number[]>([]);
    const [matchType, setMatchType] = useState<"login" | "title">("login");
    const [matchValue, setMatchValue] = useState("");
    const [selectedLabel, setSelectedLabel] = useState("");
    const [directoryQuery, setDirectoryQuery] = useState("");
    const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
    const [positions, setPositions] = useState<string[]>([]);
    const [positionsLoaded, setPositionsLoaded] = useState(false);
    const [directoryLoading, setDirectoryLoading] = useState(false);
    const [roleId, setRoleId] = useState("");
    const [priority, setPriority] = useState("100");
    const [expiresAt, setExpiresAt] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<"" | "login" | "title">("");
    const [roleFilter, setRoleFilter] = useState("");
    const [pendingRule, setPendingRule] = useState<RuleRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const visibleRules = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rules.filter((rule) => {
            if (typeFilter && rule.matchType !== typeFilter) return false;
            if (roleFilter && String(rule.roleId) !== roleFilter) return false;
            if (!needle) return true;
            const expires = rule.expiresAt ? new Date(rule.expiresAt).toLocaleDateString("ru-RU") : "";
            return rule.matchValue.toLowerCase().includes(needle)
                || rule.roleName.toLowerCase().includes(needle)
                || String(rule.priority).includes(needle)
                || expires.includes(needle);
        });
    }, [rules, query, typeFilter, roleFilter]);

    const visiblePositions = useMemo(() => {
        const needle = directoryQuery.trim().toLowerCase();
        if (!needle) return positions;
        return positions.filter((position) => position.toLowerCase().includes(needle));
    }, [positions, directoryQuery]);

    function resetLookup() {
        setMatchValue("");
        setSelectedLabel("");
        setDirectoryQuery("");
    }

    function openCreate() {
        setEditingId(null);
        setMatchType("login");
        setPriority("100");
        setExpiresAt("");
        resetLookup();
        setError(null);
        setCreateOpen(true);
    }

    function openEdit(rule: RuleRow) {
        setEditingId(rule.id);
        setMatchType(rule.matchType);
        setMatchValue(rule.matchValue);
        setSelectedLabel("");
        setDirectoryQuery(rule.matchValue);
        setRoleId(String(rule.roleId));
        setPriority(String(rule.priority));
        setExpiresAt(toDateInput(rule.expiresAt));
        setError(null);
        setCreateOpen(true);
    }

    async function load() {
        const [rulesResponse, rolesResponse] = await Promise.all([
            fetch("/api/admin/rules"),
            fetch("/api/admin/roles"),
        ]);
        const rulesJson = await rulesResponse.json();
        const rolesJson = await rolesResponse.json();
        if (rulesJson.success) {
            setRules(rulesJson.data.rules);
            setConflicts(rulesJson.data.conflicts);
        }
        if (rolesJson.success) {
            setRoles(rolesJson.data);
            if (!roleId && rolesJson.data[0]) {
                setRoleId(String(rolesJson.data[0].id));
            }
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!createOpen || matchType !== "title" || positions.length > 0) return;
        const controller = new AbortController();
        void fetch("/api/admin/available-positions", { signal: controller.signal })
            .then((response) => response.json())
            .then((json) => {
                if (json.success) {
                    setPositions(json.data);
                    setPositionsLoaded(true);
                }
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
            });
        return () => controller.abort();
    }, [createOpen, matchType, positions.length]);

    useEffect(() => {
        if (!createOpen || matchType !== "login") return;
        setDirectoryLoading(true);
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams();
            const needle = directoryQuery.trim();
            if (needle) params.set("q", needle);
            setDirectoryLoading(true);
            void fetch(`/api/admin/employees?${params.toString()}`, { signal: controller.signal })
                .then((response) => response.json())
                .then((json) => {
                    if (json.success) setEmployees(json.data);
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                })
                .finally(() => {
                    if (!controller.signal.aborted) setDirectoryLoading(false);
                });
        }, 200);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [createOpen, matchType, directoryQuery]);

    useEffect(() => {
        if (matchType !== "login" || !matchValue) return;
        const found = employees.find((employee) => employee.login.toLowerCase() === matchValue.toLowerCase());
        if (found) setSelectedLabel(found.name);
    }, [employees, matchType, matchValue]);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        const response = await fetch("/api/admin/rules", {
            method: editingId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: editingId,
                matchType,
                matchValue,
                roleId: Number(roleId),
                priority: Number(priority),
                expiresAt: matchType === "login" ? expiresAt : null,
            }),
        });
        const json = await response.json();
        if (!json.success) {
            setError(json.error?.message ?? "Не удалось сохранить правило");
            return;
        }
        setEditingId(null);
        resetLookup();
        setExpiresAt("");
        setCreateOpen(false);
        await load();
    }

    async function confirmDelete() {
        if (!pendingRule) return;
        setDeleting(true);
        setActionError(null);
        const response = await fetch(`/api/admin/rules?id=${pendingRule.id}`, { method: "DELETE" });
        const json = await response.json();
        setDeleting(false);
        if (!json.success) {
            setActionError(json.error?.message ?? "Не удалось удалить правило");
            setPendingRule(null);
            return;
        }
        setPendingRule(null);
        await load();
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <p className="text-sm text-muted-foreground">
                Сначала сравнивается логин, затем точная должность. Если ничего не совпало и человек есть в справочнике сотрудников, назначается роль линейного сотрудника. Справочник наполняется загрузкой данных.
            </p>
            {conflicts.length > 0 ? (
                <p className="text-sm text-destructive">
                    {`Приоритеты ${conflicts.join(", ")} заняты правилами разных типов. Один человек может попасть под оба.`}
                </p>
            ) : null}
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
            <ConfirmDialog
                open={pendingRule !== null}
                title="Удалить правило"
                description={pendingRule ? `Правило «${pendingRule.matchValue}» для роли «${pendingRule.roleName}» будет удалено.` : ""}
                confirmLabel="Удалить"
                isPending={deleting}
                onConfirm={confirmDelete}
                onOpenChange={(open) => {
                    if (!open) setPendingRule(null);
                }}
            />
            {canWrite ? (
                <>
                    <div>
                        <Button type="button" size="sm" onClick={openCreate}>
                            Добавить правило
                        </Button>
                    </div>
                    <Dialog open={createOpen} onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) {
                            setEditingId(null);
                            resetLookup();
                        }
                    }}>
                        <DialogContent className="sm:max-w-lg">
                            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{editingId ? "Изменить правило" : "Новое правило"}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="rule-type">Тип</Label>
                                        <select
                                            id="rule-type"
                                            value={matchType}
                                            onChange={(event) => {
                                                const next = event.target.value as "login" | "title";
                                                setMatchType(next);
                                                setPriority(next === "login" ? "100" : "10");
                                                resetLookup();
                                            }}
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            <option value="login">Сотрудник</option>
                                            <option value="title">Должность</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="rule-search">
                                            {matchType === "login" ? "Найти сотрудника" : "Найти должность"}
                                        </Label>
                                        <Input
                                            id="rule-search"
                                            value={directoryQuery}
                                            onChange={(event) => setDirectoryQuery(event.target.value)}
                                            placeholder={matchType === "login" ? "Имя, логин, должность или филиал" : "Должность"}
                                            autoComplete="off"
                                        />
                                        <div className="max-h-48 overflow-auto rounded-md border">
                                            {matchType === "login" ? (
                                                employees.length === 0 ? (
                                                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                                                        {directoryLoading ? "Ищем…" : "Сотрудники не найдены."}
                                                    </p>
                                                ) : employees.map((employee) => (
                                                    <button
                                                        key={employee.login}
                                                        type="button"
                                                        className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted ${matchValue.toLowerCase() === employee.login.toLowerCase() ? "bg-muted" : ""}`}
                                                        onClick={() => {
                                                            setMatchValue(employee.login);
                                                            setSelectedLabel(employee.name);
                                                        }}
                                                    >
                                                        <span className="text-sm">{employee.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {employee.login} · {employee.title} · {employee.branch}
                                                        </span>
                                                    </button>
                                                ))
                                            ) : visiblePositions.length === 0 ? (
                                                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                                                    {positionsLoaded ? "Должности не найдены." : "Загружаем должности…"}
                                                </p>
                                            ) : visiblePositions.map((position) => (
                                                <button
                                                    key={position}
                                                    type="button"
                                                    className={`flex w-full items-start border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${matchValue === position ? "bg-muted" : ""}`}
                                                    onClick={() => {
                                                        setMatchValue(position);
                                                        setSelectedLabel(position);
                                                    }}
                                                >
                                                    {position}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {matchValue
                                                ? matchType === "login"
                                                    ? `В правило запишется логин ${matchValue}${selectedLabel ? ` (${selectedLabel})` : ""}.`
                                                    : `Правило сработает для должности «${matchValue}».`
                                                : matchType === "login"
                                                    ? "Выберите сотрудника. В правило попадёт его логин."
                                                    : "Показаны только должности, которые есть у сотрудников."}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="rule-role">Роль</Label>
                                        <select
                                            id="rule-role"
                                            value={roleId}
                                            onChange={(event) => setRoleId(event.target.value)}
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                            required
                                        >
                                            {roles.map((role) => (
                                                <option key={role.id} value={role.id}>{role.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="rule-priority">Приоритет</Label>
                                        <Input id="rule-priority" value={priority} onChange={(event) => setPriority(event.target.value)} type="number" required />
                                    </div>
                                    {matchType === "login" ? (
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="rule-expires">Срок</Label>
                                            <Input id="rule-expires" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="date" />
                                        </div>
                                    ) : null}
                                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Отмена</Button>
                                    <Button type="submit" size="sm" disabled={!matchValue}>{editingId ? "Сохранить" : "Добавить"}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </>
            ) : access.username ? (
                <p className="text-xs text-muted-foreground">
                    {access.previewRoleName ? "Просмотр от имени роли. Изменения недоступны." : "Нет права менять доступ."}
                </p>
            ) : null}
            <AdminToolbar search={query} onSearchChange={setQuery} searchPlaceholder="Значение, роль, приоритет или срок">
                <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as "" | "login" | "title")}
                    aria-label="Тип"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-40"
                >
                    <option value="">Все типы</option>
                    <option value="login">Логин</option>
                    <option value="title">Должность</option>
                </select>
                <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    aria-label="Роль"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-48"
                >
                    <option value="">Все роли</option>
                    {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                </select>
                {query || typeFilter || roleFilter ? (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setQuery(""); setTypeFilter(""); setRoleFilter(""); }}>
                        Сбросить
                    </Button>
                ) : null}
            </AdminToolbar>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Значение</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Срок</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleRules.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                                {rules.length === 0 ? "Правил пока нет." : "Нет правил по этому фильтру."}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {visibleRules.map((rule) => (
                        <TableRow key={rule.id}>
                            <TableCell>{rule.priority}</TableCell>
                            <TableCell>{rule.matchType === "login" ? "Логин" : "Должность"}</TableCell>
                            <TableCell>{rule.matchValue}</TableCell>
                            <TableCell>{rule.roleName}</TableCell>
                            <TableCell>{rule.expiresAt ? new Date(rule.expiresAt).toLocaleDateString("ru-RU") : "—"}</TableCell>
                            <TableCell>
                                {canWrite ? (
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-muted-foreground"
                                            aria-label={`Изменить правило ${rule.matchValue}`}
                                            onClick={() => openEdit(rule)}
                                        >
                                            <Pencil />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-muted-foreground hover:text-destructive"
                                            aria-label={`Удалить правило ${rule.matchValue}`}
                                            onClick={() => setPendingRule(rule)}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                ) : null}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
