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
import {
    formatPriceGrowthMonth,
    formatPriceGrowthValue,
    priceGrowthValue,
    type PriceGrowthAllowance,
} from "@/lib/price-growth";
import { ApiResponse } from "@/types/api";

function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatWhen(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

export function PriceGrowthEditor({ initial }: { initial: PriceGrowthAllowance[] }) {
    const access = useAccess();
    const canWrite = access.has("price-growth:write");
    const [rows, setRows] = useState(initial);
    const [month, setMonth] = useState(currentMonth);
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [removing, setRemoving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        const value = priceGrowthValue(amount);
        if (value === null) {
            setError("Значение — неотрицательное число, не больше двух знаков после запятой.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/price-growth", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period: month, value }),
            });
            const json = (await response.json()) as ApiResponse<PriceGrowthAllowance[]>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setRows(json.data);
            notifySuccess("Надбавка записана");
        } catch {
            setError("Не удалось записать надбавку");
        } finally {
            setSaving(false);
        }
    }

    async function remove(period: string) {
        setError(null);
        try {
            const response = await fetch(`/api/admin/price-growth?period=${encodeURIComponent(period.slice(0, 7))}`, {
                method: "DELETE",
            });
            const json = (await response.json()) as ApiResponse<PriceGrowthAllowance[]>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setRows(json.data);
            notifySuccess("Надбавка удалена");
        } catch {
            setError("Не удалось удалить надбавку");
        }
    }

    return (
        <AdminPageShell>
            <Card className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                <CardContent className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
                    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
                        <FormAlert message={error} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="price-growth-month">Месяц, с которого действует</Label>
                                <Input
                                    id="price-growth-month"
                                    type="month"
                                    value={month}
                                    disabled={saving || !canWrite}
                                    onChange={(event) => setMonth(event.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="price-growth-value">Значение</Label>
                                <Input
                                    id="price-growth-value"
                                    inputMode="decimal"
                                    value={amount}
                                    disabled={saving || !canWrite}
                                    onChange={(event) => setAmount(event.target.value)}
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <Button type="submit" size="sm" disabled={saving || !canWrite}>
                                {saving ? <ButtonSpinner /> : null}
                                {saving ? "Сохранение..." : "Записать"}
                            </Button>
                        </div>
                    </form>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Месяц</TableHead>
                                <TableHead className="text-right">Значение</TableHead>
                                <TableHead>Кто записал</TableHead>
                                <TableHead>Когда</TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                                        Надбавка ещё не задана.
                                    </TableCell>
                                </TableRow>
                            ) : rows.map((row) => (
                                <TableRow key={row.period}>
                                    <TableCell>{formatPriceGrowthMonth(row.period)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatPriceGrowthValue(row.value)}</TableCell>
                                    <TableCell>{row.setBy}</TableCell>
                                    <TableCell className="tabular-nums">{formatWhen(row.setAt)}</TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={!canWrite}
                                            aria-label={`Удалить надбавку за ${formatPriceGrowthMonth(row.period)}`}
                                            onClick={() => setRemoving(row.period)}
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
                title="Удалить надбавку"
                description={removing ? `Надбавка за ${formatPriceGrowthMonth(removing)} будет удалена. Расчёт этого месяца возьмёт предыдущую надбавку.` : ""}
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
