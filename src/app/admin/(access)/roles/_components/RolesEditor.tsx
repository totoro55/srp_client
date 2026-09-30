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
import { SCOPE_KINDS, SCOPE_KIND_LABELS, type ScopeKind } from "@/lib/permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RoleRow {
    id: number;
    code: string;
    name: string;
    description: string | null;
    scopeKind: ScopeKind;
    isSystem: boolean;
}

export function RolesEditor() {
    const access = useAccess();
    const canWrite = access.has("access.write");
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [scopeKind, setScopeKind] = useState<ScopeKind>("division");
    const [createOpen, setCreateOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [scopeFilter, setScopeFilter] = useState<ScopeKind | "">("");
    const [pendingRole, setPendingRole] = useState<RoleRow | null>(null);
    const [deleting, setDeleting] = useState(false);

    const visibleRoles = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return roles.filter((role) => {
            if (scopeFilter && role.scopeKind !== scopeFilter) return false;
            if (!needle) return true;
            return role.name.toLowerCase().includes(needle)
                || role.code.toLowerCase().includes(needle)
                || (role.description ?? "").toLowerCase().includes(needle);
        });
    }, [roles, query, scopeFilter]);

    async function load() {
        const response = await fetch("/api/admin/roles");
        const json = await response.json();
        if (json.success) {
            setRoles(json.data);
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function onCreate(event: FormEvent) {
        event.preventDefault();
        setFormError(null);
        const response = await fetch("/api/admin/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, code, description, scopeKind }),
        });
        const json = await response.json();
        if (!json.success) {
            setFormError(json.error?.message ?? "Не удалось создать роль");
            return;
        }
        setName("");
        setCode("");
        setDescription("");
        setScopeKind("division");
        setCreateOpen(false);
        await load();
    }

    async function onSave(role: RoleRow) {
        setError(null);
        const response = await fetch("/api/admin/roles", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: role.id,
                name: role.name,
                description: role.description ?? "",
                scopeKind: role.scopeKind,
            }),
        });
        const json = await response.json();
        if (!json.success) {
            setError(json.error?.message ?? "Не удалось сохранить роль");
            await load();
        }
    }

    async function onDelete(role: RoleRow) {
        setError(null);
        const response = await fetch(`/api/admin/roles?id=${role.id}`, { method: "DELETE" });
        const json = await response.json();
        if (!json.success) {
            setError(json.error?.message ?? "Не удалось удалить роль");
            return;
        }
        await load();
    }

    async function confirmDelete() {
        if (!pendingRole) return;
        setDeleting(true);
        await onDelete(pendingRole);
        setDeleting(false);
        setPendingRole(null);
    }

    function updateRole(id: number, patch: Partial<RoleRow>) {
        setRoles((current) => current.map((role) => (role.id === id ? { ...role, ...patch } : role)));
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <p className="text-sm text-muted-foreground">
                Роль задаёт, что можно делать, и на каком уровне: дивизион, территория или филиал. Права отмечаются в матрице, логин и должность — в трансляции.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <ConfirmDialog
                open={pendingRole !== null}
                title="Удалить роль"
                description={pendingRole ? `Роль «${pendingRole.name}» будет удалена. Если на неё есть правила трансляции, удаление не пройдёт.` : ""}
                confirmLabel="Удалить"
                isPending={deleting}
                onConfirm={confirmDelete}
                onOpenChange={(open) => {
                    if (!open) setPendingRole(null);
                }}
            />
            {access.username && canWrite ? (
                <>
                    <div>
                        <Button type="button" size="sm" onClick={() => { setFormError(null); setCreateOpen(true); }}>
                            Добавить роль
                        </Button>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogContent>
                            <form className="flex flex-col gap-4" onSubmit={onCreate}>
                                <DialogHeader>
                                    <DialogTitle>Новая роль</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="role-name">Название</Label>
                                        <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="role-code">Код</Label>
                                        <Input id="role-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="код_роли" required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="role-description">Описание</Label>
                                        <Input id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="role-scope">Область</Label>
                                        <select
                                            id="role-scope"
                                            value={scopeKind}
                                            onChange={(event) => setScopeKind(event.target.value as ScopeKind)}
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                        >
                                            {SCOPE_KINDS.map((kind) => (
                                                <option key={kind} value={kind}>{SCOPE_KIND_LABELS[kind]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
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
            <AdminToolbar search={query} onSearchChange={setQuery} searchPlaceholder="Название, код или описание">
                <select
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value as ScopeKind | "")}
                    aria-label="Область"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-44"
                >
                    <option value="">Все области</option>
                    {SCOPE_KINDS.map((kind) => (
                        <option key={kind} value={kind}>{SCOPE_KIND_LABELS[kind]}</option>
                    ))}
                </select>
                {query || scopeFilter ? (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setQuery(""); setScopeFilter(""); }}>
                        Сбросить
                    </Button>
                ) : null}
            </AdminToolbar>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Код</TableHead>
                        <TableHead>Область</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleRoles.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                                {roles.length === 0 ? "Ролей пока нет." : "Нет ролей по этому фильтру."}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {visibleRoles.map((role) => (
                        <TableRow key={role.id}>
                            <TableCell>
                                <Input
                                    value={role.name}
                                    disabled={!canWrite}
                                    onChange={(event) => updateRole(role.id, { name: event.target.value })}
                                    onBlur={(event) => void onSave({ ...role, name: event.target.value })}
                                    className="h-8 text-xs"
                                />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{role.code}</TableCell>
                            <TableCell>
                                <select
                                    value={role.scopeKind}
                                    disabled={!canWrite || role.isSystem}
                                    onChange={(event) => {
                                        const next = { ...role, scopeKind: event.target.value as ScopeKind };
                                        updateRole(role.id, { scopeKind: next.scopeKind });
                                        void onSave(next);
                                    }}
                                    className="h-8 rounded-md border bg-background px-2 text-xs"
                                >
                                    {SCOPE_KINDS.map((kind) => (
                                        <option key={kind} value={kind}>{SCOPE_KIND_LABELS[kind]}</option>
                                    ))}
                                </select>
                            </TableCell>
                            <TableCell>
                                <Input
                                    value={role.description ?? ""}
                                    disabled={!canWrite}
                                    onChange={(event) => updateRole(role.id, { description: event.target.value })}
                                    onBlur={(event) => void onSave({ ...role, description: event.target.value })}
                                    className="h-8 text-xs"
                                />
                            </TableCell>
                            <TableCell>
                                {canWrite && !role.isSystem ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Удалить роль ${role.name}`}
                                        onClick={() => setPendingRole(role)}
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
