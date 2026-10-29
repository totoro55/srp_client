"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownFromLine, History, MousePointerClick, RotateCcw, Save, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, DataTableSkeleton } from "@/components/loading-state";
import { coefficientValueIssue } from "@/lib/coefficient-value";
import { closedPeriodMessage } from "@/lib/rrs-edit-window";
import { notifySuccess } from "@/lib/notify";
import type { RrsCoefficientPage } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { CoefficientTable, coefficientCellDirty, coefficientFieldKey } from "../../../_components/CoefficientTable";
import { PeriodChangeHistory } from "../../../_components/PeriodChangeHistory";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { formatMonth } from "../../../_components/model";

export function BranchCoefficients() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<RrsCoefficientPage | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [historyToken, setHistoryToken] = useState(0);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        setError(null);
        const query = period ? `?period=${encodeURIComponent(period)}` : requestedPeriod ? `?period=${encodeURIComponent(requestedPeriod)}` : "";
        const response = await fetch(`/api/rrs/cards/${territoryUuid}/coefficients${query}`);
        const json = (await response.json()) as ApiResponse<RrsCoefficientPage>;
        if (!json.success) {
            setError(json.error.message);
            setPage(null);
            setLoading(false);
            return;
        }
        const next = displayedValues(json.data);
        setPage(json.data);
        setValues(next);
        setSaved(next);
        setLoading(false);
    }, [requestedPeriod, territoryUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const showSave = Boolean(page && page.baskets.length > 0);
    const hint = page ? periodHint(page, loading) : null;

    function collectItems(): { items: { branchUuid: string; basketId: number; key: string; value: string }[] } | { error: string } {
        if (!page) {
            return { error: "Не удалось прочитать коэффициенты" };
        }
        const items: { branchUuid: string; basketId: number; key: string; value: string }[] = [];
        for (const branch of page.branches) {
            for (const basket of page.baskets) {
                for (const coefficient of basket.coefficients) {
                    const id = coefficientFieldKey(branch.uuid, basket.id, coefficient.key);
                    const value = (values[id] ?? "").trim() || DEFAULT_COEFFICIENT;
                    const issue = coefficientValueIssue(value, coefficient);
                    if (issue) {
                        return { error: `${branch.name}, ${coefficient.title}: ${issue}` };
                    }
                    items.push({ branchUuid: branch.uuid, basketId: basket.id, key: coefficient.key, value });
                }
            }
        }
        return { items };
    }

    function requestSave() {
        const collected = collectItems();
        if ("error" in collected) {
            setError(collected.error);
            return;
        }
        setError(null);
        setConfirmSave(true);
    }

    async function saveCoefficients() {
        if (!page) {
            return;
        }
        const collected = collectItems();
        if ("error" in collected) {
            setError(collected.error);
            setConfirmSave(false);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/coefficients`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period: page.period, items: collected.items }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true }>;
            if (!json.success) {
                setError(json.error.message);
                setConfirmSave(false);
                return;
            }
            notifySuccess("Коэффициенты филиалов сохранены");
            setConfirmSave(false);
            setHistoryToken((current) => current + 1);
            await load(page.period);
        } catch {
            setError("Не удалось сохранить коэффициенты");
            setConfirmSave(false);
        } finally {
            setSaving(false);
        }
    }

    const dirtyCount = page
        ? page.branches.reduce((count, branch) => count + page.baskets.reduce((basketCount, basket) => (
            basketCount + basket.coefficients.filter((coefficient) => coefficientCellDirty(values, saved, coefficientFieldKey(branch.uuid, basket.id, coefficient.key))).length
        ), 0), 0)
        : 0;

    return (
        <form className="flex w-full flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <ConfirmDialog
                open={confirmSave}
                title="Сохранить коэффициенты"
                description={page
                    ? `Коэффициенты филиалов «${page.territory.name}» будут записаны за ${formatMonth(page.period)}.`
                    : ""}
                confirmLabel="Сохранить"
                confirmVariant="default"
                isPending={saving}
                onConfirm={saveCoefficients}
                onOpenChange={setConfirmSave}
            />
            <Tabs defaultValue="values" className="gap-4">
            <div className="flex flex-col gap-4">
                <RrsSectionNav
                    territoryUuid={territoryUuid}
                    territoryName={page?.territory.name}
                    active="coefficients"
                    period={page?.period ?? requestedPeriod}
                    cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : requestedPeriod}
                    subnav={page ? (
                        <TabsList>
                            <TabsTrigger value="values">Значения</TabsTrigger>
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
                                        router.replace(`/rrs/${territoryUuid}/coefficients?period=${period}`);
                                        void load(period);
                                    }}
                                />
                            ) : null}
                            {showSave ? (
                                <div className="relative ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                                    <p className={cn("text-sm text-amber-800 max-sm:w-full max-sm:text-right sm:absolute sm:right-full sm:mr-2 sm:whitespace-nowrap dark:text-amber-200", dirtyCount === 0 && "hidden")}>
                                        Есть несохранённые значения
                                    </p>
                                    <Button type="button" size="sm" disabled={saving || loading || !page?.editable} onClick={requestSave}>
                                        {saving ? <ButtonSpinner /> : <Save />}
                                        Сохранить
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={saving || loading || !page?.editable || dirtyCount === 0}
                                        onClick={() => {
                                            setValues(saved);
                                            setConfirmSave(false);
                                            setError(null);
                                        }}
                                    >
                                        <Undo2 />
                                        Отменить
                                    </Button>
                                    <HelpDrawer title="Порядок заполнения">
                                        <CoefficientHelp cutoffDay={page?.editPolicy.cutoffDay ?? null} />
                                    </HelpDrawer>
                                </div>
                            ) : (
                                <div className="ml-auto">
                                    <HelpDrawer title="Порядок заполнения">
                                        <CoefficientHelp cutoffDay={page?.editPolicy.cutoffDay ?? null} />
                                    </HelpDrawer>
                                </div>
                            )}
                        </>
                    )}
                />
                <FormAlert message={error} />
                {loading && !page ? <DataTableSkeleton columns={4} rows={8} /> : null}
            </div>
            <TabsContent value="values" className="flex flex-col gap-4">
            {page ? (
                <CoefficientTable
                    branches={page.branches}
                    baskets={page.baskets}
                    values={values}
                    saved={saved}
                    editable={page.editable}
                    disabled={saving}
                    onChange={setValues}
                />
            ) : null}
            </TabsContent>
            <TabsContent value="history">
                {page ? (
                    <PeriodChangeHistory
                        territoryUuid={territoryUuid}
                        period={page.period}
                        source="coefficients"
                        reloadToken={historyToken}
                    />
                ) : null}
            </TabsContent>
            </Tabs>
        </form>
    );
}

function periodHint(page: RrsCoefficientPage, loading: boolean): { text: string; tone: PeriodHintTone } {
    if (loading) {
        return { tone: "loading", text: "Загрузка периода…" };
    }
    if (!page.editable) {
        return { tone: "closed", text: `${closedPeriodMessage(page.editPolicy)} Показаны действующие значения.` };
    }
    if (page.period.slice(0, 7) > page.editPolicy.currentMonth) {
        return { tone: "future", text: `Значения будут действовать с ${formatMonth(page.period)}. Более ранние месяцы останутся без изменений.` };
    }
    return { tone: "current", text: "Этот месяц открыт для изменения." };
}

function CoefficientHelp({ cutoffDay }: { cutoffDay: number | null }) {
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Период</h3>
                <p className="text-muted-foreground">
                    Для изменения доступны текущий месяц и последующие.
                    {cutoffDay === null ? " Предыдущий месяц доступен до дня отсечки включительно." : ` Предыдущий месяц доступен до ${cutoffDay}-го числа включительно.`}
                    {" "}Чтобы применить изменения со следующего месяца, выберите будущий период. Более ранние месяцы при этом не изменяются. Смена версии корзины в открытом месяце удаляет коэффициенты этой корзины за месяц; удаление фиксируется в истории. Вкладка «История» показывает, кто изменял коэффициенты в выбранном месяце и какие значения действовали до сохранения.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Значение</h3>
                <p className="text-muted-foreground">
                    В таблице только филиалы, включённые в мотивацию на выбранный месяц. Для каждого из них указывается значение коэффициента подключённой версии. Если значение не установлено, применяется{" "}
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border bg-background px-1 align-middle text-xs font-medium text-foreground tabular-nums">1</span>
                    .
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Ограничения</h3>
                <p className="text-muted-foreground">При вводе отображаются описание коэффициента и допустимые ограничения. Сохранение значения, не соответствующего ограничениям, не допускается.</p>
            </section>
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Запись значений</h3>
                <p className="text-muted-foreground">
                    Клавиша <Kbd>Enter</Kbd> завершает ввод в ячейке. Запись значений выполняется кнопкой{" "}
                    <span className={cn(buttonVariants({ size: "xs" }), "pointer-events-none h-5 px-1.5 align-middle")}>
                        <Save />
                        Сохранить
                    </span>{" "}
                    после подтверждения. Кнопка{" "}
                    <span className={cn(buttonVariants({ variant: "outline", size: "xs" }), "pointer-events-none h-5 px-1.5 align-middle")}>
                        <Undo2 />
                        Отменить
                    </span>{" "}
                    восстанавливает ранее установленные значения.
                </p>
            </section>
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Контекстное меню</h3>
                <p className="text-muted-foreground">
                    <Kbd className="gap-1 px-1.5">
                        <MousePointerClick />
                        ПКМ
                    </Kbd>{" "}
                    открывает меню ячейки, если месяц открыт для изменения.
                </p>
                <div className="flex flex-col gap-2">
                    <div className="w-fit rounded-md bg-popover text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 [&_svg]:size-3">
                        <div className="flex items-center gap-1.5 px-1.5 py-1">
                            <RotateCcw />
                            Вернуть значение по умолчанию
                        </div>
                    </div>
                    <p className="text-muted-foreground">
                        Устанавливает в выбранной ячейке значение{" "}
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border bg-background px-1 align-middle text-xs font-medium text-foreground tabular-nums">1</span>
                        .
                    </p>
                    <div className="w-fit rounded-md bg-popover text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10 [&_svg]:size-3">
                        <div className="flex items-center gap-1.5 px-1.5 py-1">
                            <ArrowDownFromLine />
                            Заполнить столбец этим значением
                        </div>
                    </div>
                    <p className="text-muted-foreground">Применяет значение выбранной ячейки ко всем филиалам этой таблицы по данному коэффициенту.</p>
                </div>
            </section>
        </div>
    );
}

const DEFAULT_COEFFICIENT = "1";

function displayedValues(page: RrsCoefficientPage): Record<string, string> {
    const stored = new Map(page.values.map((item) => [coefficientFieldKey(item.branchUuid, item.basketId, item.key), item.value]));
    const next: Record<string, string> = {};
    for (const branch of page.branches) {
        for (const basket of page.baskets) {
            for (const coefficient of basket.coefficients) {
                const id = coefficientFieldKey(branch.uuid, basket.id, coefficient.key);
                const value = stored.get(id)?.trim() ?? "";
                next[id] = value === "" ? DEFAULT_COEFFICIENT : value;
            }
        }
    }
    return next;
}

