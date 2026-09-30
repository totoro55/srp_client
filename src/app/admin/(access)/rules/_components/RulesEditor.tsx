'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
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

export function RulesEditor() {
    const access = useAccess();
    const canWrite = access.has("access.write");
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [rules, setRules] = useState<RuleRow[]>([]);
    const [conflicts, setConflicts] = useState<number[]>([]);
    const [matchType, setMatchType] = useState<"login" | "title">("title");
    const [matchValue, setMatchValue] = useState("");
    const [roleId, setRoleId] = useState("");
    const [priority, setPriority] = useState("10");
    const [expiresAt, setExpiresAt] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
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

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        const response = await fetch("/api/admin/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
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
        setMatchValue("");
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
                Сначала сравнивается логин, затем точная должность. Если ничего не совпало и человек есть в справочнике сотрудников, назначается роль линейного сотрудника.
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
                        <Button type="button" size="sm" onClick={() => { setError(null); setCreateOpen(true); }}>
                            Добавить правило
                        </Button>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogContent>
                            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                                <DialogHeader>
                                    <DialogTitle>Новое правило</DialogTitle>
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
                                            }}
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            <option value="login">Логин</option>
                                            <option value="title">Должность</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="rule-value">{matchType === "login" ? "Логин" : "Должность"}</Label>
                                        <Input id="rule-value" value={matchValue} onChange={(event) => setMatchValue(event.target.value)} required />
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
                                    <Button type="submit" size="sm">Добавить</Button>
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
                                ) : null}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
