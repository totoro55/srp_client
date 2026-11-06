"use client";

import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { stmBrandName, type StmBrand } from "@/lib/stm-brands";
import type { ApiResponse } from "@/types/api";

function formatWhen(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

export function StmBrandsEditor({ initial }: { initial: StmBrand[] }) {
    const access = useAccess();
    const canWrite = access.has("stm-brands:write");
    const [rows, setRows] = useState(initial);
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        const brand = stmBrandName(name);
        if (!brand) {
            setError("Укажите название бренда");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/stm-brands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: brand }),
            });
            const json = (await response.json()) as ApiResponse<StmBrand[]>;
            if (!response.ok || !json.success) {
                setError(json.success ? "Не удалось добавить бренд" : json.error.message);
                return;
            }
            setRows(json.data);
            setName("");
            notifySuccess("Бренд добавлен");
        } catch {
            setError("Не удалось добавить бренд");
        } finally {
            setSaving(false);
        }
    }

    async function remove(brand: string) {
        setError(null);
        const response = await fetch(`/api/admin/stm-brands?name=${encodeURIComponent(brand)}`, {
            method: "DELETE",
        });
        const json = (await response.json()) as ApiResponse<StmBrand[]>;
        if (!response.ok || !json.success) {
            setError(json.success ? "Не удалось удалить бренд" : json.error.message);
            return;
        }
        setRows(json.data);
        notifySuccess("Бренд удалён");
    }

    return (
        <AdminPageShell>
            <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
                    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
                        <FormAlert message={error} />
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="stm-brand-name">Бренд</Label>
                            <Input
                                id="stm-brand-name"
                                value={name}
                                disabled={saving || !canWrite}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Название, как в продаже"
                                required
                            />
                        </div>
                        <div>
                            <Button type="submit" size="sm" disabled={saving || !canWrite}>
                                {saving ? <ButtonSpinner /> : null}
                                {saving ? "Сохранение..." : "Добавить"}
                            </Button>
                        </div>
                    </form>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Бренд</TableHead>
                                <TableHead>Кто добавил</TableHead>
                                <TableHead>Когда</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                                        Бренды СТМ ещё не заданы.
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((row) => (
                                <TableRow key={row.name}>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{row.setBy}</TableCell>
                                    <TableCell className="tabular-nums">{formatWhen(row.setAt)}</TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={!canWrite || deleting}
                                            aria-label={`Удалить бренд ${row.name}`}
                                            onClick={() => setRemoving(row.name)}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <ConfirmDialog
                open={removing !== null}
                title="Удалить бренд"
                description={removing ? `Бренд «${removing}» перестанет считаться СТМ.` : ""}
                confirmLabel="Удалить"
                isPending={deleting}
                onOpenChange={(open) => {
                    if (!open) setRemoving(null);
                }}
                onConfirm={async () => {
                    if (!removing) return;
                    setDeleting(true);
                    try {
                        await remove(removing);
                    } finally {
                        setDeleting(false);
                        setRemoving(null);
                    }
                }}
            />
        </AdminPageShell>
    );
}
