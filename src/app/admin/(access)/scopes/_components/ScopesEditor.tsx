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
import { notifyError, notifySuccess } from "@/lib/notify";
import { useRequiredFields } from "@/lib/required-fields";
import { FormAlert } from "@/components/form-alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Territory {
    uuid: string;
    code: string;
    name: string;
}

interface Grant {
    id: number;
    username: string;
    territoryUuid: string;
    territoryName: string;
}

export function ScopesEditor() {
    const access = useAccess();
    const validateRequired = useRequiredFields();
    const canWrite = access.has("access.write");
    const [territories, setTerritories] = useState<Territory[]>([]);
    const [grants, setGrants] = useState<Grant[]>([]);
    const [username, setUsername] = useState("");
    const [territoryUuid, setTerritoryUuid] = useState("");
    const [grantOpen, setGrantOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [territoryFilter, setTerritoryFilter] = useState("");
    const [pendingGrant, setPendingGrant] = useState<Grant | null>(null);
    const [deleting, setDeleting] = useState(false);

    const visibleGrants = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return grants.filter((grant) => {
            if (territoryFilter && grant.territoryUuid !== territoryFilter) return false;
            if (!needle) return true;
            return grant.username.toLowerCase().includes(needle)
                || grant.territoryName.toLowerCase().includes(needle);
        });
    }, [grants, query, territoryFilter]);

    async function load() {
        const response = await fetch("/api/admin/scopes");
        const json = await response.json();
        if (!json.success) return;
        setTerritories(json.data.territories);
        setGrants(json.data.grants);
        if (!territoryUuid && json.data.territories[0]) {
            setTerritoryUuid(json.data.territories[0].uuid);
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function addGrant(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const validationMessage = validateRequired(event.currentTarget);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }
        setError(null);
        const response = await fetch("/api/admin/scopes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, territoryUuid }),
        });
        const json = await response.json();
        if (!json.success) {
            setError(json.error?.message ?? "Не удалось назначить территорию");
            return;
        }
        const savedUsername = username.trim();
        setUsername("");
        setGrantOpen(false);
        notifySuccess(`Территория назначена ${savedUsername}`);
        await load();
    }

    async function confirmRevoke() {
        if (!pendingGrant) return;
        setDeleting(true);
        const response = await fetch(`/api/admin/scopes?grantId=${pendingGrant.id}`, { method: "DELETE" });
        const json = await response.json();
        setDeleting(false);
        if (!json.success) {
            notifyError(json.error?.message ?? "Не удалось снять назначение");
            return;
        }
        notifySuccess(`Назначение для ${pendingGrant.username} снято`);
        setPendingGrant(null);
        await load();
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
            <p className="text-sm text-muted-foreground">
                Здесь назначаются территории директору. Справочники сотрудников и территорий наполняет загрузка данных, приложение их не меняет. Филиал линейного сотрудника берётся из карточки сотрудника.
            </p>
            <ConfirmDialog
                open={pendingGrant !== null}
                title="Снять назначение"
                description={pendingGrant ? `У ${pendingGrant.username} будет снята территория «${pendingGrant.territoryName}».` : ""}
                confirmLabel="Снять"
                isPending={deleting}
                onConfirm={confirmRevoke}
                onOpenChange={(open) => {
                    if (!open) setPendingGrant(null);
                }}
            />
            {canWrite ? (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={territories.length === 0}
                        title={territories.length === 0 ? "В справочнике пока нет территорий" : undefined}
                        onClick={() => { setError(null); setGrantOpen(true); }}
                    >
                        Назначить
                    </Button>
                    <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
                        <DialogContent>
                            <form className="flex flex-col gap-4" noValidate onSubmit={addGrant}>
                                <DialogHeader>
                                    <DialogTitle>Назначение территории</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="grant-username">Логин</Label>
                                        <Input id="grant-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="grant-territory">Территория</Label>
                                        <select
                                            id="grant-territory"
                                            value={territoryUuid}
                                            onChange={(event) => setTerritoryUuid(event.target.value)}
                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                            required
                                        >
                                            {territories.map((territory) => (
                                                <option key={territory.uuid} value={territory.uuid}>{territory.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <FormAlert message={error} />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setGrantOpen(false)}>Отмена</Button>
                                    <Button type="submit" size="sm">Назначить</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : access.username ? (
                <p className="text-xs text-muted-foreground">
                    {access.previewRoleName ? "Просмотр от имени роли. Изменения недоступны." : "Нет права менять доступ."}
                </p>
            ) : null}
            {territories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Справочник территорий пока пуст.</p>
            ) : null}
            <AdminToolbar search={query} onSearchChange={setQuery} searchPlaceholder="Логин или территория">
                <select
                    value={territoryFilter}
                    onChange={(event) => setTerritoryFilter(event.target.value)}
                    aria-label="Территория"
                    className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-48"
                >
                    <option value="">Все территории</option>
                    {territories.map((territory) => (
                        <option key={territory.uuid} value={territory.uuid}>{territory.name}</option>
                    ))}
                </select>
                {query || territoryFilter ? (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setQuery(""); setTerritoryFilter(""); }}>
                        Сбросить
                    </Button>
                ) : null}
            </AdminToolbar>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Логин</TableHead>
                        <TableHead>Территория</TableHead>
                        <TableHead />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleGrants.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3} className="py-8 text-center text-xs text-muted-foreground">
                                {grants.length === 0 ? "Назначений пока нет." : "Нет назначений по этому фильтру."}
                            </TableCell>
                        </TableRow>
                    ) : null}
                    {visibleGrants.map((grant) => (
                        <TableRow key={grant.id}>
                            <TableCell>{grant.username}</TableCell>
                            <TableCell>{grant.territoryName}</TableCell>
                            <TableCell>
                                {canWrite ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        aria-label={`Снять территорию у ${grant.username}`}
                                        onClick={() => setPendingGrant(grant)}
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
