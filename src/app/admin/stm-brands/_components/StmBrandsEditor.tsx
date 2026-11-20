"use client";

import { FormEvent, useState } from "react";
import { Plus, Save, Trash2, Undo2 } from "lucide-react";
import { AdminPageShell } from "@/app/admin/_components/AdminPageShell";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { showStartedRecalc } from "@/lib/recalc-plan";
import { STM_BRAND_NAME_MAX, stmBrandKey, stmBrandName, type StmBrand } from "@/lib/stm-brands";
import { cn } from "@/lib/utils";
import type { ApiResponse } from "@/types/api";

interface DraftBrand {
    name: string;
    setAt: string | null;
    setBy: string | null;
}

function formatWhen(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function draftOf(brands: StmBrand[]): DraftBrand[] {
    return brands.map((brand) => ({ name: brand.name, setAt: brand.setAt, setBy: brand.setBy }));
}

function byName(left: DraftBrand, right: DraftBrand): number {
    return left.name.localeCompare(right.name, "ru", { sensitivity: "base" }) || left.name.localeCompare(right.name, "ru");
}

function listSignature(rows: readonly DraftBrand[]): string {
    return rows.map((row) => `${stmBrandKey(row.name)}\0${row.name}`).sort().join("\n");
}

function restoreSaved(saved: readonly DraftBrand[], name: string): DraftBrand {
    const previous = saved.find((row) => stmBrandKey(row.name) === stmBrandKey(name));
    if (!previous) {
        return { name, setAt: null, setBy: null };
    }
    return { ...previous, name };
}

export function StmBrandsEditor({ initial }: { initial: StmBrand[] }) {
    const access = useAccess();
    const canWrite = access.has("stm-brands:write");
    const [saved, setSaved] = useState(() => draftOf(initial));
    const [rows, setRows] = useState(() => draftOf(initial));
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [recalcReady, setRecalcReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = listSignature(rows) !== listSignature(saved);
    const removed = saved.filter((row) => !rows.some((item) => stmBrandKey(item.name) === stmBrandKey(row.name)));
    const busy = saving || recalculating;
    const recalcOn = canWrite && recalcReady && !dirty;

    function addBrand(event: FormEvent) {
        event.preventDefault();
        const normalized = name.trim().replace(/\s+/g, " ");
        const brand = stmBrandName(name);
        if (!brand) {
            setError(normalized.length > STM_BRAND_NAME_MAX ? "Название бренда не длиннее 255 символов" : "Укажите название бренда");
            return;
        }
        if (rows.some((row) => stmBrandKey(row.name) === stmBrandKey(brand))) {
            setError("Такой бренд уже есть");
            return;
        }
        setError(null);
        setRows([...rows, restoreSaved(saved, brand)].sort(byName));
        setName("");
    }

    function removeBrand(brand: string) {
        setError(null);
        setRows(rows.filter((row) => row.name !== brand));
    }

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/stm-brands", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ names: rows.map((row) => row.name) }),
            });
            const json = (await response.json()) as ApiResponse<{ brands: StmBrand[]; changed: boolean }>;
            if (!response.ok || !json.success) {
                setError(json.success ? "Не удалось сохранить список" : json.error.message);
                return;
            }
            const next = draftOf(json.data.brands);
            setSaved(next);
            setRows(next);
            if (json.data.changed) {
                setRecalcReady(true);
            }
            notifySuccess("Список сохранён");
        } catch {
            setError("Не удалось сохранить список");
        } finally {
            setSaving(false);
        }
    }

    async function recalculate() {
        setRecalculating(true);
        setError(null);
        const startedAt = new Date().toISOString();
        try {
            const response = await fetch("/api/admin/stm-brands/recalculate", { method: "POST" });
            const json = (await response.json()) as ApiResponse<{ recalc: StartedPremiumRecalc | null }>;
            if (!response.ok || !json.success) {
                setError(json.success ? "Не удалось запустить пересчёт" : json.error.message);
                return;
            }
            if (!json.data.recalc) {
                setError("Премия этого месяца не пересчитывается.");
                return;
            }
            showStartedRecalc(json.data.recalc, startedAt);
            setRecalcReady(false);
        } catch {
            setError("Не удалось запустить пересчёт");
        } finally {
            setRecalculating(false);
        }
    }

    const recalcTitle = dirty
        ? "Сначала сохраните список"
        : recalcReady
            ? "Пересчитать премию по продажам и общую премию дивизиона"
            : "Пересчёт включается после сохранения списка";

    return (
        <AdminPageShell>
            <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
                    <div className="flex max-w-xl flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" disabled={!canWrite || !dirty || busy} onClick={() => void save()}>
                                {saving ? <ButtonSpinner /> : <Save />}
                                {saving ? "Сохранение..." : "Сохранить"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canWrite || !dirty || busy}
                                onClick={() => {
                                    setRows(saved);
                                    setError(null);
                                }}
                            >
                                <Undo2 />
                                Отменить
                            </Button>
                            <span title={recalcTitle} className="inline-flex">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={recalcOn ? "default" : "outline"}
                                    disabled={!recalcOn || busy}
                                    onClick={() => void recalculate()}
                                >
                                    {recalculating ? <ButtonSpinner /> : null}
                                    {recalculating ? "Пересчёт..." : "Пересчитать"}
                                </Button>
                            </span>
                        </div>
                        <FormAlert message={error} />
                        <form onSubmit={addBrand} className="flex items-end gap-2">
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <Label htmlFor="stm-brand-name">Бренд</Label>
                                <Input
                                    id="stm-brand-name"
                                    value={name}
                                    disabled={busy || !canWrite}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Название, как в продаже"
                                />
                            </div>
                            <Button
                                type="submit"
                                size="icon"
                                className="shrink-0"
                                aria-label="Добавить бренд"
                                title="Добавить"
                                disabled={busy || !canWrite || name.trim() === ""}
                            >
                                <Plus />
                            </Button>
                        </form>
                        {removed.length > 0 ? (
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                К удалению: {removed.map((row) => row.name).join(", ")}
                            </p>
                        ) : null}
                    </div>
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
                                        {saved.length === 0 ? "Бренды СТМ ещё не заданы." : "Список будет очищен после сохранения."}
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((row) => {
                                const pending = !saved.some((item) => stmBrandKey(item.name) === stmBrandKey(row.name) && item.name === row.name);
                                return (
                                    <TableRow key={row.name} className={cn(pending && "bg-amber-50 dark:bg-amber-950/30")}>
                                        <TableCell>{row.name}</TableCell>
                                        <TableCell>{row.setBy ?? "Не сохранён"}</TableCell>
                                        <TableCell className="tabular-nums">{row.setAt ? formatWhen(row.setAt) : "—"}</TableCell>
                                        <TableCell>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                disabled={!canWrite || busy}
                                                aria-label={`Удалить бренд ${row.name}`}
                                                onClick={() => removeBrand(row.name)}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </AdminPageShell>
    );
}
