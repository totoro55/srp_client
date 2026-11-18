"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CircleHelp, History, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, DataTableSkeleton } from "@/components/loading-state";
import { notifySuccess } from "@/lib/notify";
import { formatBaseBonus, type RrsMotivationPage } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { PeriodChangeHistory } from "../../../_components/PeriodChangeHistory";
import { RrsPeriodControls, settingsPeriodHint } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { premiumSaveDescription, type StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { showStartedRecalc } from "@/lib/recalc-plan";
import { formatMonth } from "../../../_components/model";

const BRIGADE_HINT = "Включение активирует на филиале бригадную мотивацию в режиме полной бригады. Настройка частичной (групповой) бригады доступна только в настройках филиала. Режим действует с месяца включения до месяца, в котором его выключат. Внутри месяца бригада либо включена, либо выключена целиком. Если переключатель остаётся в прежнем положении, новый месяц не записывается.";

export function BranchMotivation() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<RrsMotivationPage | null>(null);
    const [enabled, setEnabled] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [brigade, setBrigade] = useState<Record<string, boolean>>({});
    const [savedBrigade, setSavedBrigade] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [historyToken, setHistoryToken] = useState(0);
    const fetchKey = `${territoryUuid}|${requestedPeriod ?? ""}`;
    const [preparedFetchKey, setPreparedFetchKey] = useState<string | null>(null);
    if (fetchKey !== preparedFetchKey) {
        setPreparedFetchKey(fetchKey);
        setLoading(true);
        setError(null);
    }

    const fetchMotivation = useCallback(async (period?: string) => {
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
        const nextBrigade = brigadeFlags(json.data);
        setPage(json.data);
        setEnabled(next);
        setSaved(next);
        setBrigade(nextBrigade);
        setSavedBrigade(nextBrigade);
        setLoading(false);
    }, [requestedPeriod, territoryUuid]);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        setError(null);
        await fetchMotivation(period);
    }, [fetchMotivation]);

    useEffect(() => {
        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (!cancelled) {
                void fetchMotivation();
            }
        }, 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [fetchKey, fetchMotivation]);

    const hint = page ? settingsPeriodHint(page.period, page.editPolicy, loading) : null;

    const dirtyCount = page
        ? page.branches.filter((branch) => (
            isEnabled(enabled, branch.uuid) !== isEnabled(saved, branch.uuid)
            || isEnabled(brigade, branch.uuid) !== isEnabled(savedBrigade, branch.uuid)
        )).length
        : 0;
    const bonusBranches = page
        ? page.branches.filter((branch) => page.items.find((row) => row.branchUuid === branch.uuid)?.hasBaseBonus)
        : [];
    const enabledCount = bonusBranches.filter((branch) => isEnabled(enabled, branch.uuid)).length;
    const allWithBonusOn = bonusBranches.length > 0 && bonusBranches.every((branch) => isEnabled(enabled, branch.uuid));

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
                        brigade: isEnabled(brigade, branch.uuid),
                    })),
                }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true; recalc: StartedPremiumRecalc | null }>;
            if (!json.success) {
                setError(json.error.message);
                setConfirmSave(false);
                return;
            }
            if (json.data.recalc) {
                showStartedRecalc(json.data.recalc);
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
                    ? premiumSaveDescription(
                        `Участие филиалов «${page.territory.name}» будет записано за ${formatMonth(page.period)}.`,
                        page.period,
                        "Премия по корзинам территории будет пересчитана для филиалов, участие которых изменено.",
                    )
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
                                            setBrigade(savedBrigade);
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
            {loading && !page ? <DataTableSkeleton columns={4} rows={8} /> : null}
            {page ? (
                <>
                    <TabsContent value="participation" className="flex flex-col gap-4">
                        {page.branches.length > 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {bonusBranches.length === 0
                                    ? "Нет филиалов с базовой премией"
                                    : `Включено ${enabledCount} из ${bonusBranches.length}`}
                            </p>
                        ) : null}
                        {page.branches.length === 0 ? <p className="text-sm text-muted-foreground">У этой территории нет филиалов.</p> : null}
                        {page.branches.length > 0 ? (
                <Table containerClassName="max-h-[calc(100vh-16rem)] rounded-lg border">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                            <TableHead>Филиал</TableHead>
                            <TableHead className="w-44 text-right">Базовая премия</TableHead>
                            <TableHead className="min-w-72">
                                <span className="flex items-center gap-2">
                                    <Switch
                                        checked={allWithBonusOn}
                                        disabled={!page.editable || saving || bonusBranches.length === 0}
                                        aria-label={allWithBonusOn ? "Выключить филиалы с премией" : "Включить филиалы с премией"}
                                        onCheckedChange={(checked) => {
                                            setEnabled((current) => {
                                                const next = { ...current };
                                                for (const branch of bonusBranches) {
                                                    next[branch.uuid] = checked;
                                                }
                                                return next;
                                            });
                                            if (!checked) {
                                                setBrigade((current) => {
                                                    const next = { ...current };
                                                    for (const branch of bonusBranches) {
                                                        next[branch.uuid] = false;
                                                    }
                                                    return next;
                                                });
                                            }
                                        }}
                                    />
                                    Участие
                                </span>
                            </TableHead>
                            <TableHead className="min-w-56">
                                <span className="flex items-center gap-2">
                                    Бригада
                                    <Tooltip>
                                        <TooltipTrigger
                                            render={<button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="Справка по бригаде" />}
                                        >
                                            <CircleHelp className="size-4" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-sm text-left">{BRIGADE_HINT}</TooltipContent>
                                    </Tooltip>
                                </span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page.branches.map((branch) => {
                            const on = isEnabled(enabled, branch.uuid);
                            const brigadeOn = isEnabled(brigade, branch.uuid);
                            const dirty = on !== isEnabled(saved, branch.uuid) || brigadeOn !== isEnabled(savedBrigade, branch.uuid);
                            const item = page.items.find((row) => row.branchUuid === branch.uuid);
                            const hasBaseBonus = item?.hasBaseBonus ?? false;
                            const bonus = formatBaseBonus(item?.baseBonus ?? null);
                            const blocked = !hasBaseBonus && !on;
                            return (
                                <TableRow key={branch.uuid} className={cn(on && "bg-emerald-50 dark:bg-emerald-950/30", dirty && "bg-amber-50 dark:bg-amber-950/30")}>
                                    <TableCell className="font-medium">{branch.name}</TableCell>
                                    <TableCell className={cn("text-right tabular-nums", bonus === null && "text-muted-foreground")}>
                                        {bonus ?? "Нет"}
                                    </TableCell>
                                    <TableCell>
                                        <label className="flex items-center gap-2 text-sm">
                                            <Switch
                                                checked={on}
                                                disabled={!page.editable || saving || blocked}
                                                aria-label={blocked ? `Нельзя включить ${branch.name}: нет базовой премии` : on ? `Выключить ${branch.name}` : `Включить ${branch.name}`}
                                                onCheckedChange={(checked) => {
                                                    if (checked && !hasBaseBonus) {
                                                        return;
                                                    }
                                                    setEnabled((current) => ({ ...current, [branch.uuid]: checked }));
                                                    if (!checked) {
                                                        setBrigade((current) => ({ ...current, [branch.uuid]: false }));
                                                    }
                                                }}
                                            />
                                            <span className={on ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}>
                                                {on ? "Включена" : hasBaseBonus ? "Выключена" : "Нельзя включить: нет базовой премии"}
                                            </span>
                                        </label>
                                    </TableCell>
                                    <TableCell>
                                        <label className="flex items-center gap-2 text-sm">
                                            <Switch
                                                checked={brigadeOn && on}
                                                disabled={!page.editable || saving || !on}
                                                aria-label={brigadeOn ? `Выключить полную бригаду ${branch.name}` : `Включить полную бригаду ${branch.name}`}
                                                onCheckedChange={(checked) => {
                                                    setBrigade((current) => ({ ...current, [branch.uuid]: checked }));
                                                }}
                                            />
                                            <span className={brigadeOn && on ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}>
                                                {brigadeOn && on ? "Полная" : "Выключена"}
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

function brigadeFlags(page: RrsMotivationPage): Record<string, boolean> {
    const next: Record<string, boolean> = {};
    for (const item of page.items) {
        next[item.branchUuid] = item.brigade === true;
    }
    for (const branch of page.branches) {
        if (next[branch.uuid] === undefined) {
            next[branch.uuid] = false;
        }
    }
    return next;
}

function MotivationHelp({ cutoffDay }: { cutoffDay: number | null }) {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Участие</h3>
                <p className="text-muted-foreground">
                    Мотивация филиала по умолчанию выключена. В колонке «Базовая премия» показана сумма из выгрузки за выбранный месяц. Филиал можно подключить, только если сумма есть. Переключатель в шапке колонки «Участие» включает или выключает сразу все филиалы с премией и не меняет филиалы без неё. Колонка «Бригада» включает на филиале полную бригадную мотивацию и показывает режим, действующий в выбранном месяце, в том числе заданный раньше. Частичная (групповая) бригада настраивается только в кабинете филиала. Изменение записывается кнопкой «Сохранить». Если переключатель не сдвинут, запись этого месяца не создаётся.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Период</h3>
                <p className="text-muted-foreground">
                    Для изменения доступны текущий месяц и последующие.
                    {cutoffDay === null ? " Предыдущий месяц доступен до дня отсечки включительно." : ` Предыдущий месяц доступен до ${cutoffDay}-го числа включительно.`}
                    {" "}Запись сохраняет участие на выбранный месяц. Более ранние месяцы при этом не изменяются. Смена версии корзины участие филиалов не изменяет. Вкладка «История» показывает, кто изменял участие в выбранном месяце и какое состояние действовало до сохранения.
                </p>
            </section>
        </div>
    );
}
