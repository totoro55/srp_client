"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { History, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, DataTableSkeleton } from "@/components/loading-state";
import { closedPeriodMessage } from "@/lib/rrs-edit-window";
import { notifySuccess } from "@/lib/notify";
import type { RrsMotivationPage } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { PeriodChangeHistory } from "../../../_components/PeriodChangeHistory";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { formatMonth } from "../../../_components/model";

export function BranchMotivation() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<RrsMotivationPage | null>(null);
    const [enabled, setEnabled] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [historyToken, setHistoryToken] = useState(0);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        setError(null);
        const query = period ? `?period=${encodeURIComponent(period)}` : requestedPeriod ? `?period=${encodeURIComponent(requestedPeriod)}` : "";
        const response = await fetch(`/api/rrs/cards/${territoryUuid}/motivation${query}`);
        const json = (await response.json()) as ApiResponse<RrsMotivationPage>;
        if (!json.success) {
            setError(json.error.message);
            setPage(null);
            setLoading(false);
            return;
        }
        const next = participation(json.data);
        setPage(json.data);
        setEnabled(next);
        setSaved(next);
        setLoading(false);
    }, [requestedPeriod, territoryUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const hint = page ? periodHint(page, loading) : null;

    const dirtyCount = page
        ? page.branches.filter((branch) => isEnabled(enabled, branch.uuid) !== isEnabled(saved, branch.uuid)).length
        : 0;
    const enabledCount = page
        ? page.branches.filter((branch) => isEnabled(enabled, branch.uuid)).length
        : 0;

    function requestSave() {
        if (!page) {
            return;
        }
        setError(null);
        setConfirmSave(true);
    }

    async function saveParticipation() {
        if (!page) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/motivation`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    period: page.period,
                    items: page.branches.map((branch) => ({
                        branchUuid: branch.uuid,
                        enabled: isEnabled(enabled, branch.uuid),
                    })),
                }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true }>;
            if (!json.success) {
                setError(json.error.message);
                setConfirmSave(false);
                return;
            }
            notifySuccess("Участие филиалов сохранено");
            setConfirmSave(false);
            setHistoryToken((current) => current + 1);
            await load(page.period);
        } catch {
            setError("Не удалось сохранить участие филиалов");
            setConfirmSave(false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form className="flex w-full flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <ConfirmDialog
                open={confirmSave}
                title="Сохранить участие"
                description={page
                    ? `Участие филиалов «${page.territory.name}» в мотивации будет записано за ${formatMonth(page.period)}.`
                    : ""}
                confirmLabel="Сохранить"
                confirmVariant="default"
                isPending={saving}
                onConfirm={saveParticipation}
                onOpenChange={setConfirmSave}
            />
            <Tabs defaultValue="participation" className="gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="motivation"
                period={page?.period ?? requestedPeriod}
                cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : requestedPeriod}
                subnav={page ? (
                    <TabsList>
                        <TabsTrigger value="participation">Участие</TabsTrigger>
                        <TabsTrigger value="history">
                            <History />
                            История
                        </TabsTrigger>
                    </TabsList>
                ) : null}
                controls={(
                    <>
                        {page && hint ? (
                            <RrsPeriodControls
                                period={page.period}
                                appliedPeriod={page.appliedPeriod}
                                savedPeriods={page.savedPeriods.map((item) => ({ period: item }))}
                                disabled={loading}
                                hint={hint}
                                onPeriodChange={(period) => {
                                    router.replace(`/rrs/${territoryUuid}/motivation?period=${period}`);
                                    void load(period);
                                }}
                            />
                        ) : null}
                        <div className="relative ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                            {page && page.branches.length > 0 ? (
                                <>
                                    <p className={cn("text-sm text-amber-800 max-sm:w-full max-sm:text-right sm:absolute sm:right-full sm:mr-2 sm:whitespace-nowrap dark:text-amber-200", dirtyCount === 0 && "hidden")}>
                                        Есть несохранённые изменения
                                    </p>
                                    <Button type="button" size="sm" disabled={saving || loading || !page.editable} onClick={requestSave}>
                                        {saving ? <ButtonSpinner /> : <Save />}
                                        Сохранить
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={saving || loading || !page.editable || dirtyCount === 0}
                                        onClick={() => {
                                            setEnabled(saved);
                                            setConfirmSave(false);
                                            setError(null);
                                        }}
                                    >
                                        <Undo2 />
                                        Отменить
                                    </Button>
                                </>
                            ) : null}
                            <HelpDrawer title="Участие в мотивации">
                                <MotivationHelp cutoffDay={page?.editPolicy.cutoffDay ?? null} />
                            </HelpDrawer>
                        </div>
                    </>
                )}
            />
            <FormAlert message={error} />
            {loading && !page ? <DataTableSkeleton columns={2} rows={8} /> : null}
            {page ? (
                <>
                    <TabsContent value="participation" className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">
                            Включено {enabledCount} из {page.branches.length}
                        </p>
                        {page.branches.length === 0 ? <p className="text-sm text-muted-foreground">У этой территории нет филиалов.</p> : null}
                        {page.branches.length > 0 ? (
                <Table containerClassName="max-h-[calc(100vh-16rem)] rounded-lg border">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead>Филиал</TableHead>
                            <TableHead className="w-48">Участие</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.branches.map((branch) => {
                            const on = isEnabled(enabled, branch.uuid);
                            const dirty = on !== isEnabled(saved, branch.uuid);
                            return (
                                <TableRow key={branch.uuid} className={cn(on && "bg-emerald-50 dark:bg-emerald-950/30", dirty && "bg-amber-50 dark:bg-amber-950/30")}>
                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                    <TableCell>
                                        <label className="flex items-center gap-2 text-sm">
                                            <Switch
                                                checked={on}
                                                disabled={!page.editable || saving}
                                                aria-label={on ? `Выключить ${branch.name}` : `Включить ${branch.name}`}
                                                onCheckedChange={(checked) => {
                                                    setEnabled((current) => ({ ...current, [branch.uuid]: checked }));
                                                }}
                                            />
                                            <span className={on ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}>
                                                {on ? "Включена" : "Выключена"}
                                            </span>
                                        </label>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                        ) : null}
                    </TabsContent>
                    <TabsContent value="history">
                        <PeriodChangeHistory
                            territoryUuid={territoryUuid}
                            period={page.period}
                            source="motivation"
                            reloadToken={historyToken}
                        />
                    </TabsContent>
                </>
            ) : null}
            </Tabs>
        </form>
    );
}

function isEnabled(values: Record<string, boolean>, branchUuid: string): boolean {
    return values[branchUuid] ?? false;
}

function participation(page: RrsMotivationPage): Record<string, boolean> {
    const next: Record<string, boolean> = {};
    for (const item of page.items) {
        next[item.branchUuid] = item.enabled;
    }
    for (const branch of page.branches) {
        if (next[branch.uuid] === undefined) {
            next[branch.uuid] = false;
        }
    }
    return next;
}

function periodHint(page: RrsMotivationPage, loading: boolean): { text: string; tone: PeriodHintTone } {
    if (loading) {
        return { tone: "loading", text: "Загрузка периода…" };
    }
    if (!page.editable) {
        return { tone: "closed", text: `${closedPeriodMessage(page.editPolicy)} Показано действующее участие.` };
    }
    if (page.period.slice(0, 7) > page.editPolicy.currentMonth) {
        return { tone: "future", text: `Участие будет действовать с ${formatMonth(page.period)}. Более ранние месяцы останутся без изменений.` };
    }
    return { tone: "current", text: "Этот месяц открыт для изменения." };
}

function MotivationHelp({ cutoffDay }: { cutoffDay: number | null }) {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Участие</h3>
                <p className="text-muted-foreground">
                    Мотивация филиала по умолчанию выключена. Новый филиал нужно включить вручную и сохранить на нужный месяц.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Период</h3>
                <p className="text-muted-foreground">
                    Для изменения доступны текущий месяц и последующие.
                    {cutoffDay === null ? " Предыдущий месяц доступен до дня отсечки включительно." : ` Предыдущий месяц доступен до ${cutoffDay}-го числа включительно.`}
                    {" "}Запись сохраняет участие на выбранный месяц. Более ранние месяцы при этом не изменяются. Вкладка «История» показывает, кто менял участие в выбранном месяце и что было до сохранения.
                </p>
            </section>
        </div>
    );
}
