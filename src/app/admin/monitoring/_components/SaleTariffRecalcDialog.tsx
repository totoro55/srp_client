"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { openRecalcConsole } from "@/lib/recalc-plan";
import type { ApiResponse } from "@/types/api";

interface SaleTariffTarget {
    uuid: string;
    name: string;
    versionNo: number | null;
    versionName: string | null;
    axisTitle: string | null;
    ready: boolean;
    reason: string;
}

export function SaleTariffRecalcDialog({
    period,
    open,
    actor,
    onOpenChange,
}: {
    period: string;
    open: boolean;
    actor: string;
    onOpenChange: (open: boolean) => void;
}) {
    const [targets, setTargets] = useState<SaleTariffTarget[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        let cancel = false;
        setLoading(true);
        setError(null);
        setTargets([]);
        setSelected([]);
        void fetch(`/api/admin/monitoring/sale-tariffs?period=${period}`)
            .then(async (response) => response.json() as Promise<ApiResponse<SaleTariffTarget[]>>)
            .then((json) => {
                if (cancel) {
                    return;
                }
                if (!json.success) {
                    setError(json.error.message);
                    return;
                }
                setTargets(json.data);
                setSelected(json.data.filter((item) => item.ready).map((item) => item.uuid));
            })
            .catch(() => {
                if (!cancel) {
                    setError("Не удалось прочитать версии тарифов");
                }
            })
            .finally(() => {
                if (!cancel) {
                    setLoading(false);
                }
            });
        return () => {
            cancel = true;
        };
    }, [open, period]);

    const ready = targets.filter((item) => item.ready);
    const allSelected = ready.length > 0 && selected.length === ready.length;

    async function start() {
        setSaving(true);
        setError(null);
        const startedAt = new Date().toISOString();
        try {
            const response = await fetch("/api/admin/monitoring/sale-tariffs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period, territories: selected }),
            });
            const json = (await response.json()) as ApiResponse<{ started: number }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            const names = ready.filter((item) => selected.includes(item.uuid)).map((item) => item.name);
            onOpenChange(false);
            openRecalcConsole({
                period,
                kinds: ["tariffs", "sale", "shared", "brigade"],
                reason: "tariffs",
                actor,
                scopeLevel: names.length === ready.length ? "division" : "territory",
                scopeLabel: names.length === ready.length ? "Все РРС" : names.length === 1 ? `РРС «${names[0]}»` : `${names.length} РРС`,
                title: "Тарифы продажи",
                detail: "Включены уже сохранённые исключения. После записи пересчитаются продажа, общая премия и доли бригады.",
                startedAt,
            });
        } catch {
            setError("Не удалось запустить пересчёт тарифов");
        } finally {
            setSaving(false);
        }
    }

    function toggle(uuid: string, checked: boolean) {
        setSelected((current) => checked ? [...current, uuid] : current.filter((item) => item !== uuid));
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Пересчёт тарифов продажи</DialogTitle>
                    <DialogDescription>
                        Перед запуском видны версия и ось. В расчёт входят исключения, которые уже включены для РРС.
                        После записи тарифов пересчитаются продажа, общая премия и доли бригады.
                    </DialogDescription>
                </DialogHeader>
                <FormAlert message={error} />
                {loading ? (
                    <StackSkeleton rows={4} />
                ) : targets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">РРС с карточкой нет.</p>
                ) : (
                    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={allSelected}
                                disabled={ready.length === 0 || saving}
                                onCheckedChange={(value) => setSelected(value === true ? ready.map((item) => item.uuid) : [])}
                            />
                            Все доступные
                        </label>
                        {targets.map((target) => (
                            <label key={target.uuid} className="flex items-start gap-2 text-sm">
                                <Checkbox
                                    className="mt-0.5"
                                    checked={selected.includes(target.uuid)}
                                    disabled={!target.ready || saving}
                                    onCheckedChange={(value) => toggle(target.uuid, value === true)}
                                />
                                <span className="min-w-0">
                                    <span className="block">{target.name}</span>
                                    <span className="block text-muted-foreground">
                                        {target.ready
                                            ? `Версия ${target.versionNo} «${target.versionName}», ${target.axisTitle}`
                                            : target.reason}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button type="button" disabled={saving || selected.length === 0} onClick={() => void start()}>
                        {saving ? <ButtonSpinner /> : null}
                        Пересчитать
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
