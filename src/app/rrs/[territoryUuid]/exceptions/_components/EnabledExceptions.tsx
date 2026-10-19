"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PinnedTable } from "@/components/pinned-table";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BadgePercent, Check, ChevronRight, Eye, EyeOff, Folder, Hash, ListChecks, Package, Save, Tag, Trash2, Undo2, X } from "lucide-react";
import { ConfirmDialog } from "@/app/admin/_components/ConfirmDialog";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner, DataTableSkeleton } from "@/components/loading-state";
import { HelpDrawer } from "@/components/help-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TariffAxis } from "@/lib/baskets";
import { calculateAlgorithmTariffs, calculateServiceTariffs, parseTariffRate, rowBecomesException, tariffRowComplete } from "@/lib/tariff-calculation";
import type { CalculatedTariffRow, TariffBaseMode, TariffExceptionInput, TariffExceptionReport } from "@/lib/tariff-exceptions";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { describePeriodEffect, formatMonth } from "../../../_components/model";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";

const ARCHIVE_FOLDER = "Архивные";

export function EnabledExceptions() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<TariffExceptionReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [picker, setPicker] = useState(false);
    const [pickerQuery, setPickerQuery] = useState("");
    const [hideAdded, setHideAdded] = useState(false);
    const [selection, setSelection] = useState<Set<string>>(() => new Set());
    const [pendingAdds, setPendingAdds] = useState<Set<string>>(() => new Set());
    const [removed, setRemoved] = useState<Set<string>>(() => new Set());
    const [open, setOpen] = useState<Set<string>>(() => new Set());
    const [edits, setEdits] = useState<Record<string, RuleDraft>>({});
    const [saving, setSaving] = useState(false);
    const [recalcPrompt, setRecalcPrompt] = useState(false);
    const [recalcPending, setRecalcPending] = useState(false);
    const [preview, setPreview] = useState<CalculatedTariffRow[] | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [savingTariffs, setSavingTariffs] = useState(false);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        setError(null);
        const chosen = period ?? requestedPeriod;
        const suffix = chosen ? `?period=${encodeURIComponent(chosen)}` : "";
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/enabled-exceptions${suffix}`);
            const json = (await response.json()) as ApiResponse<TariffExceptionReport>;
            if (!json.success) {
                setError(json.error.message);
                setPage(null);
                return;
            }
            setEdits({});
            setPendingAdds(new Set());
            setRemoved(new Set());
            setSelection(new Set());
            setPage(json.data);
        } catch {
            setError("Не удалось загрузить исключения");
            setPage(null);
        } finally {
            setLoading(false);
        }
    }, [requestedPeriod, territoryUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const listed = useMemo(() => (page ? enabledList(page, edits, removed, pendingAdds) : []), [page, edits, removed, pendingAdds]);
    const listedCodes = useMemo(() => new Set(listed.map((item) => item.code)), [listed]);
    const pickerChanged = selection.size !== listedCodes.size || [...selection].some((code) => !listedCodes.has(code));
    const catalog = useMemo(() => (page ? buildTree(page) : []), [page]);
    const visibleCatalog = useMemo(() => filterTree(catalog, pickerQuery), [catalog, pickerQuery]);
    const pickerNodes = useMemo(() => {
        if (!hideAdded) {
            return visibleCatalog;
        }
        return withoutListed(visibleCatalog, new Set(listed.map((item) => item.code)));
    }, [hideAdded, listed, visibleCatalog]);
    const hint = page ? periodHint(page, loading) : null;
    const dirty = page ? Object.keys(edits).length > 0 || removed.size > 0 || pendingAdds.size > 0 : false;
    const includedCodes = listed.map((item) => item.code);
    const saveBlocked = page ? exceptionItems(page, edits, includedCodes).some((item) => !item.automatic && (item.main === null || item.im === null || item.b2b === null)) : false;
    const previewIncomplete = preview?.some((row) => !tariffRowComplete(row)) ?? false;

    function patchRule(axis: TariffAxis, code: string, partial: Partial<RuleDraft>, fillCalculated = false) {
        if (!page) {
            return;
        }
        const key = `${axis}:${code}`;
        setEdits((current) => {
            const base = current[key] ?? savedRule(page, axis, code);
            let next = { ...base, ...partial };
            if (partial.automatic === true) {
                next = { ...next, main: null, im: null, b2b: null };
            } else if (fillCalculated && base.automatic && !next.automatic) {
                const channels = algorithmChannels(page, code, next.baseMode);
                next = {
                    ...next,
                    main: partial.main !== undefined ? partial.main : channels?.main ?? null,
                    im: partial.im !== undefined ? partial.im : channels?.im ?? null,
                    b2b: partial.b2b !== undefined ? partial.b2b : channels?.b2b ?? null,
                };
            }
            if (sameDraft(next, savedRule(page, axis, code))) {
                const rest = { ...current };
                delete rest[key];
                return rest;
            }
            return { ...current, [key]: next };
        });
    }

    function includeItem(axis: TariffAxis, code: string) {
        patchRule(axis, code, { automatic: true, baseMode: "per_unit" });
    }

    function toggleSelection(code: string, selected: boolean) {
        setSelection((current) => {
            const next = new Set(current);
            if (selected) {
                next.add(code);
            } else {
                next.delete(code);
            }
            return next;
        });
    }

    function confirmAdd() {
        if (!page?.axis) {
            return;
        }
        const axis = page.axis;
        const listedCodes = new Set(listed.map((item) => item.code));
        const toAdd = [...selection].filter((code) => !listedCodes.has(code));
        const toRemove = [...listedCodes].filter((code) => !selection.has(code));
        if (toAdd.length === 0 && toRemove.length === 0) {
            return;
        }
        setRemoved((current) => {
            const next = new Set(current);
            for (const code of toAdd) {
                next.delete(`${axis}:${code}`);
            }
            return next;
        });
        setPendingAdds((current) => {
            const next = new Set(current);
            for (const code of toAdd) {
                next.add(`${axis}:${code}`);
            }
            for (const code of toRemove) {
                next.delete(`${axis}:${code}`);
            }
            return next;
        });
        for (const code of toAdd) {
            includeItem(axis, code);
        }
        for (const code of toRemove) {
            removeItem(axis, code, true);
        }
        setSelection(new Set());
        setPicker(false);
    }

    function removeItem(axis: TariffAxis, code: string, keepSelection = false) {
        const key = `${axis}:${code}`;
        const saved = page?.rows.some((row) => row.axis === axis && row.code === code) ?? false;
        setPendingAdds((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
        });
        if (!keepSelection) {
            setSelection((current) => {
                const next = new Set(current);
                next.delete(code);
                return next;
            });
        }
        if (saved) {
            setRemoved((current) => new Set(current).add(key));
            includeItem(axis, code);
            return;
        }
        setEdits((current) => {
            const rest = { ...current };
            delete rest[key];
            return rest;
        });
    }

    function discardDraft() {
        setEdits({});
        setPendingAdds(new Set());
        setRemoved(new Set());
        setSelection(new Set());
    }

    function openPicker() {
        if (!page?.axis) {
            return;
        }
        const included = new Set(listed.map((item) => item.code));
        setOpen(foldersWithIncluded(buildTree(page), included));
        setPickerQuery("");
        setHideAdded(false);
        setSelection(included);
        setPicker(true);
    }

    async function saveExceptions() {
        if (!page) {
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/enabled-exceptions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period: page.period, items: exceptionItems(page, edits, includedCodes) }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: true }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            notifySuccess("Исключения сохранены");
            setRecalcPending(true);
            setRecalcPrompt(true);
            await load(page.period);
        } catch {
            setError("Не удалось сохранить исключения");
        } finally {
            setSaving(false);
        }
    }

    async function recalculate() {
        if (!page) {
            return;
        }
        setSaving(true);
        setPreviewError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/tariff-recalc`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period: page.period }),
            });
            const json = (await response.json()) as ApiResponse<CalculatedTariffRow[]>;
            if (!json.success) {
                setPreviewError(json.error.message);
                setRecalcPending(true);
                return;
            }
            setPreview(json.data);
            setRecalcPrompt(false);
            setRecalcPending(false);
        } catch {
            setPreviewError("Не удалось пересчитать тарифы");
            setRecalcPending(true);
        } finally {
            setSaving(false);
        }
    }

    async function saveTariffs() {
        if (!page || !preview) {
            return;
        }
        setSavingTariffs(true);
        setPreviewError(null);
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/tariff-recalc`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ period: page.period }),
            });
            const json = (await response.json()) as ApiResponse<{ saved: number }>;
            if (!json.success) {
                setPreviewError(json.error.message);
                return;
            }
            notifySuccess("Тарифы сохранены");
            setPreview(null);
        } catch {
            setPreviewError("Не удалось сохранить тарифы");
        } finally {
            setSavingTariffs(false);
        }
    }

    function setFolderOpen(key: string, next: boolean) {
        setOpen((current) => {
            const updated = new Set(current);
            if (next) {
                updated.add(key);
            } else {
                updated.delete(key);
            }
            return updated;
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="exceptions"
                period={page?.period ?? requestedPeriod}
                cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : requestedPeriod}
                controls={page && hint ? (
                    <>
                        <RrsPeriodControls
                            period={page.period}
                            appliedPeriod={page.appliedPeriod}
                            savedPeriods={page.savedPeriods.map((period) => ({ period }))}
                            disabled={loading}
                            hint={hint}
                            onPeriodChange={(period) => {
                                router.replace(`/rrs/${territoryUuid}/exceptions?period=${period}`);
                                void load(period);
                            }}
                        />
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" disabled={!page.editable || !dirty || saveBlocked || saving} onClick={() => void saveExceptions()}>
                                {saving ? <ButtonSpinner /> : <Save />}
                                Сохранить
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={!dirty || saving} onClick={discardDraft}>
                                <Undo2 />
                                Отменить
                            </Button>
                            <HelpDrawer title="Исключения">
                                <ExceptionsHelp axis={page.axis} />
                            </HelpDrawer>
                        </div>
                    </>
                ) : null}
            />
            <FormAlert message={preview ? null : (error ?? previewError)} />
            {loading && !page ? <DataTableSkeleton columns={6} rows={8} /> : null}
            {page?.editable ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" disabled={!page.axis || saving} onClick={openPicker}>
                        <ListChecks />
                        {selectionTitle(page.axis)}
                    </Button>
                    {recalcPending && !recalcPrompt ? (
                        <>
                            <p className="text-sm">Тарифы этого месяца нужно пересчитать.</p>
                            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void recalculate()}>
                                {saving ? <ButtonSpinner /> : null}
                                Пересчитать
                            </Button>
                        </>
                    ) : null}
                </div>
            ) : recalcPending && !recalcPrompt ? (
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm">Тарифы этого месяца нужно пересчитать.</p>
                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void recalculate()}>
                        {saving ? <ButtonSpinner /> : null}
                        Пересчитать
                    </Button>
                </div>
            ) : null}
            {page && listed.length === 0 ? <p className="text-sm text-muted-foreground">Включённых исключений нет.</p> : null}
            {page && listed.length > 0 ? (
                <ExceptionsTable
                    rows={listed}
                    editable={page.editable}
                    axis={page.axis}
                    onPatch={patchRule}
                    onRemove={removeItem}
                />
            ) : null}
            <Dialog open={picker} onOpenChange={(next) => {
                setPicker(next);
                if (!next) {
                    setSelection(new Set());
                }
            }}>
                <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{selectionTitle(page?.axis ?? null)}</DialogTitle>
                        <DialogDescription>
                            {selectionDescription(page?.axis ?? null)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-end gap-2">
                        <label className="flex min-w-0 max-w-xl flex-1 flex-col gap-1.5 text-sm">
                            <span className="text-muted-foreground">Найти в справочнике</span>
                            <span className="relative">
                                <Input
                                    value={pickerQuery}
                                    placeholder="Название или папка"
                                    className={pickerQuery ? "pr-9" : undefined}
                                    onChange={(event) => setPickerQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.currentTarget.blur();
                                        }
                                    }}
                                />
                                {pickerQuery ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="absolute top-1/2 right-0.5 -translate-y-1/2"
                                        aria-label="Очистить поиск"
                                        onClick={() => setPickerQuery("")}
                                    >
                                        <X />
                                    </Button>
                                ) : null}
                            </span>
                        </label>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            aria-pressed={hideAdded}
                            title={hideAdded ? "Показать уже добавленные" : "Скрыть уже добавленные"}
                            aria-label={hideAdded ? "Показать уже добавленные" : "Скрыть уже добавленные"}
                            onClick={() => setHideAdded((current) => !current)}
                        >
                            {hideAdded ? <Eye /> : <EyeOff />}
                        </Button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                        {pickerNodes.length === 0 ? (
                            <p className="p-3 text-sm text-muted-foreground">Нет записей для добавления.</p>
                        ) : (
                            <PickerTree
                                nodes={pickerNodes}
                                open={pickerQuery.trim() ? folderKeys(pickerNodes) : open}
                                axis={page?.axis ?? null}
                                selected={(node) => selection.has(node.code)}
                                editable={Boolean(page?.editable && page.axis)}
                                onOpenChange={setFolderOpen}
                                onSelect={toggleSelection}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setPicker(false); setSelection(new Set()); }}>Закрыть</Button>
                        <Button type="button" size="sm" disabled={!pickerChanged} onClick={confirmAdd}>
                            <Check />
                            Применить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={recalcPrompt}
                title="Нужен пересчёт тарифов"
                description="Исключения сохранены. Тарифы этого месяца нужно пересчитать заново."
                confirmLabel="Пересчитать"
                cancelLabel="Позже"
                confirmVariant="default"
                isPending={saving}
                onConfirm={() => void recalculate()}
                onOpenChange={setRecalcPrompt}
            />
            <Dialog open={preview !== null} onOpenChange={(next) => {
                if (savingTariffs || next) {
                    return;
                }
                setPreview(null);
                setRecalcPending(true);
            }}>
                <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Рассчитанные тарифы</DialogTitle>
                        <DialogDescription>
                            {preview ? `Рассчитано тарифов: ${preview.length}. Проверьте ставки и сохраните их.` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <FormAlert message={previewError} />
                    {previewIncomplete ? <p className="text-sm text-muted-foreground">Есть пустые ставки. Такой расчёт сохранить нельзя.</p> : null}
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{nameColumnTitle(page?.axis ?? null)}</TableHead>
                                    <TableHead>Автоматический расчет</TableHead>
                                    <TableHead>Тариф от цены или количества</TableHead>
                                    <TableHead className="text-right">Тариф розница</TableHead>
                                    <TableHead className="text-right">Тариф ИМ</TableHead>
                                    <TableHead className="text-right">Тариф Безнал</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {preview?.map((row) => (
                                    <TableRow key={row.code} className={row.exception ? "bg-amber-50" : undefined}>
                                        <TableCell className="font-medium">{row.title}</TableCell>
                                        <TableCell>{row.automatic ? "Автоматический" : "Вручную"}</TableCell>
                                        <TableCell>{row.baseMode === "percent" ? "От цены" : "От количества"}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatRate(row.main, row.baseMode === "percent")}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatRate(row.im, false)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{formatRate(row.b2b, false)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" size="sm" disabled={savingTariffs} onClick={() => { setPreview(null); setRecalcPending(true); }}>Закрыть</Button>
                        <Button type="button" size="sm" disabled={previewIncomplete || savingTariffs || !preview?.length} onClick={() => void saveTariffs()}>
                            {savingTariffs ? <ButtonSpinner /> : <Save />}
                            Сохранить в базу
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ExceptionsTable({
    rows,
    editable,
    axis,
    onPatch,
    onRemove,
}: {
    rows: ListedException[];
    editable: boolean;
    axis: TariffAxis | null;
    onPatch: (axis: TariffAxis, code: string, partial: Partial<RuleDraft>, fillCalculated?: boolean) => void;
    onRemove: (axis: TariffAxis, code: string) => void;
}) {
    return (
        <PinnedTable
            minWidthClass="min-w-[980px]"
            columns={() => (
                <colgroup>
                    <col />
                    <col />
                    <col className="w-20" />
                    <col className="w-[6.25rem]" />
                    <col className="w-[5.25rem]" />
                    <col className="w-[4.5rem]" />
                    <col className="w-[5rem]" />
                    <col className="w-[7rem]" />
                    {editable ? <col className="w-10" /> : null}
                </colgroup>
            )}
            head={(
                <tr>
                    <th className="border border-border bg-muted px-1.5 py-1.5 font-medium">{nameColumnTitle(axis)}</th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 font-medium">Папка</th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 text-center font-medium">
                        <span className="whitespace-normal break-words leading-tight">Автомати-<br />ческий<br />расчет</span>
                    </th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 text-center font-medium">
                        <span className="whitespace-normal break-words leading-tight">Тариф от цены или количества</span>
                    </th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 text-right font-medium">Тариф розница</th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 text-right font-medium">Тариф ИМ</th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 text-right font-medium">Тариф Безнал</th>
                    <th className="border border-border bg-muted px-1.5 py-1.5 font-medium">С месяца</th>
                    {editable ? <th className="border border-border bg-muted px-1.5 py-1.5"><span className="sr-only">Удаление</span></th> : null}
                </tr>
            )}
        >
            {rows.map((row) => (
                <ExceptionRow key={`${row.axis}:${row.code}`} row={row} editable={editable && axis === row.axis} onPatch={onPatch} onRemove={onRemove} />
            ))}
        </PinnedTable>
    );
}

function ExceptionRow({
    row,
    editable,
    onPatch,
    onRemove,
}: {
    row: ListedException;
    editable: boolean;
    onPatch: (axis: TariffAxis, code: string, partial: Partial<RuleDraft>, fillCalculated?: boolean) => void;
    onRemove: (axis: TariffAxis, code: string) => void;
}) {
    const percent = row.rule.baseMode === "percent";
    const automaticHint = row.rule.automatic ? AUTOMATIC_HINT : undefined;
    const shown = row.rule.automatic ? (row.preview ?? { main: null, im: null, b2b: null }) : row.rule;
    return (
        <tr
            className={cn("align-top", row.pending && "bg-amber-50 dark:bg-amber-950/40")}
            title={row.pending ? "Добавлено и ещё не сохранено" : undefined}
        >
            <td className="border border-border px-2 py-1.5 font-medium break-words">{row.title}</td>
            <td className="border border-border px-2 py-1.5 break-words text-muted-foreground" title={row.path || undefined}>{row.folder ?? "—"}</td>
            <td className="border border-border px-1 py-1.5 align-middle">
                <div className="flex justify-center">
                    <Checkbox
                        checked={row.rule.automatic}
                        disabled={!editable}
                        aria-label={`Автоматический расчет для «${row.title}»`}
                        onCheckedChange={(checked) => onPatch(row.axis, row.code, { automatic: checked === true }, checked !== true)}
                    />
                </div>
            </td>
            <td className="border border-border px-1 py-1.5 align-middle">
                <div className="flex justify-center">
                    <TariffModeToggle
                        mode={row.rule.baseMode}
                        disabled={!editable}
                        title={row.title}
                        onChange={(baseMode) => onPatch(row.axis, row.code, { baseMode, automatic: true })}
                    />
                </div>
            </td>
            <RateCell editable={editable && !row.rule.automatic} percent={percent} value={shown.main} hint={automaticHint} label={`Тариф розница для «${row.title}»`} onCommit={(main) => onPatch(row.axis, row.code, { main, automatic: false }, true)} />
            <RateCell editable={editable && !row.rule.automatic} percent={false} value={shown.im} hint={automaticHint} label={`Тариф ИМ для «${row.title}»`} onCommit={(im) => onPatch(row.axis, row.code, { im, automatic: false }, true)} />
            <RateCell editable={editable && !row.rule.automatic} percent={false} value={shown.b2b} hint={automaticHint} label={`Тариф безнал для «${row.title}»`} onCommit={(b2b) => onPatch(row.axis, row.code, { b2b, automatic: false }, true)} />
            <td className="border border-border px-2 py-1.5 whitespace-nowrap">{row.fromPeriod ? formatMonth(row.fromPeriod) : "—"}</td>
            {editable ? (
                <td className="border border-border px-1 py-1 align-middle">
                    <div className="flex justify-center">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Удалить «${row.title}» из исключений`}
                            onClick={() => onRemove(row.axis, row.code)}
                        >
                            <Trash2 />
                        </Button>
                    </div>
                </td>
            ) : null}
        </tr>
    );
}

function PickerTree({
    nodes,
    open,
    axis,
    selected,
    editable,
    onOpenChange,
    onSelect,
    depth = 0,
}: {
    nodes: TreeNode[];
    open: Set<string>;
    axis: TariffAxis | null;
    selected: (node: ItemNode) => boolean;
    editable: boolean;
    onOpenChange: (key: string, next: boolean) => void;
    onSelect: (code: string, selected: boolean) => void;
    depth?: number;
}) {
    return (
        <div className="flex flex-col">
            {nodes.map((node) => node.type === "folder" ? (
                <Collapsible key={node.key} open={open.has(node.key)} onOpenChange={(next) => onOpenChange(node.key, next)}>
                    <CollapsibleTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start font-normal transition-none hover:bg-accent hover:text-accent-foreground"
                                style={{ paddingLeft: `${0.625 + depth * 1.25}rem` }}
                            />
                        }
                    >
                        <ChevronRight className="transition-transform group-data-panel-open/button:rotate-90" />
                        <Folder />
                        <span className="truncate">{node.name}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent keepMounted={false}>
                        <PickerTree
                            nodes={node.children}
                            open={open}
                            axis={axis}
                            selected={selected}
                            editable={editable}
                            onOpenChange={onOpenChange}
                            onSelect={onSelect}
                            depth={depth + 1}
                        />
                    </CollapsibleContent>
                </Collapsible>
            ) : (
                <PickerLeaf
                    key={node.key}
                    node={node}
                    depth={depth}
                    selected={selected(node)}
                    editable={editable && axis === node.axis}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}

function PickerLeaf({
    node,
    depth,
    selected,
    editable,
    onSelect,
}: {
    node: ItemNode;
    depth: number;
    selected: boolean;
    editable: boolean;
    onSelect: (code: string, selected: boolean) => void;
}) {
    const ItemIcon = node.axis === "product_kind" ? Package : Tag;
    return (
        <label className="flex h-8 items-center gap-2 pr-2 text-sm" style={{ paddingLeft: `${0.625 + depth * 1.25}rem` }}>
            <Checkbox
                checked={selected}
                disabled={!editable}
                aria-label={selected ? `Снять отметку «${node.title}»` : `Отметить «${node.title}» для добавления`}
                onCheckedChange={(checked) => onSelect(node.code, checked === true)}
            />
            <ItemIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{node.title}</span>
        </label>
    );
}

function TariffModeToggle({
    mode,
    disabled,
    title,
    onChange,
}: {
    mode: TariffBaseMode;
    disabled: boolean;
    title: string;
    onChange: (mode: TariffBaseMode) => void;
}) {
    const percent = mode === "percent";
    return (
        <div className="relative inline-grid grid-cols-2 overflow-hidden rounded-md border">
            <span
                aria-hidden
                className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-primary motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
                    percent && "translate-x-full",
                )}
            />
            <button
                type="button"
                title="Тариф от количества"
                aria-label={`Тариф от количества для «${title}»`}
                aria-pressed={!percent}
                disabled={disabled}
                className={cn(
                    "relative z-10 inline-flex size-7 items-center justify-center motion-safe:transition-colors motion-safe:duration-200",
                    percent ? "text-muted-foreground hover:bg-muted" : "text-primary-foreground",
                )}
                onClick={() => onChange("per_unit")}
            >
                <Hash className="size-3.5" />
            </button>
            <button
                type="button"
                title="Тариф от цены"
                aria-label={`Тариф от цены для «${title}»`}
                aria-pressed={percent}
                disabled={disabled}
                className={cn(
                    "relative z-10 inline-flex size-7 items-center justify-center motion-safe:transition-colors motion-safe:duration-200",
                    percent ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => onChange("percent")}
            >
                <BadgePercent className="size-3.5" />
            </button>
        </div>
    );
}

function RateCell({
    editable,
    percent,
    value,
    hint,
    label,
    onCommit,
}: {
    editable: boolean;
    percent: boolean;
    value: string | null;
    hint?: string;
    label: string;
    onCommit: (value: string | null) => void;
}) {
    const [draft, setDraft] = useState(percent ? storedPercentToDraft(value) : (value ?? ""));
    useEffect(() => {
        setDraft(percent ? storedPercentToDraft(value) : (value ?? ""));
    }, [percent, value]);
    if (!editable) {
        const text = formatRate(value, percent);
        return (
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">
                {hint ? (
                    <Tooltip>
                        <TooltipTrigger render={<span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-4" />}>
                            {text}
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{hint}</TooltipContent>
                    </Tooltip>
                ) : text}
            </td>
        );
    }
    return (
        <td className="border border-border px-1 py-1 align-middle">
            <Input
                aria-label={label}
                value={draft}
                inputMode="decimal"
                className="h-7 px-1 text-right text-xs tabular-nums"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => {
                    const raw = draft.trim();
                    if (raw === "") {
                        onCommit(null);
                        return;
                    }
                    onCommit(percent ? draftPercentToStored(raw) : raw.replace(",", "."));
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur();
                    }
                }}
            />
        </td>
    );
}

interface FolderNode {
    type: "folder";
    key: string;
    name: string;
    archive: boolean;
    children: TreeNode[];
}

interface ItemNode {
    type: "item";
    key: string;
    code: string;
    title: string;
    axis: TariffAxis;
}

interface ListedException {
    code: string;
    title: string;
    axis: TariffAxis;
    folder: string | null;
    path: string;
    fromPeriod: string | null;
    saved: boolean;
    exception: boolean;
    pending: boolean;
    preview: { main: string | null; im: string | null; b2b: string | null } | null;
    rule: RuleDraft;
}

interface RuleDraft {
    automatic: boolean;
    baseMode: TariffBaseMode;
    main: string | null;
    im: string | null;
    b2b: string | null;
}

const AUTOMATIC_RULE: RuleDraft = { automatic: true, baseMode: "per_unit", main: null, im: null, b2b: null };
const AUTOMATIC_HINT = "Тариф будет рассчитан после запуска пересчёта тарифов.";

type TreeNode = FolderNode | ItemNode;

function enabledList(page: TariffExceptionReport, edits: Record<string, RuleDraft>, removed: Set<string>, pendingAdds: Set<string>): ListedException[] {
    if (!page.axis) {
        return [];
    }
    const axis = page.axis;
    const saved = new Map(page.rows.filter((row) => row.axis === axis).map((row) => [row.code, row]));
    const seen = new Set<string>();
    const items: ListedException[] = [];
    function consider(code: string, title: string, folders: string[], fromPeriod: string | null, savedFlag: boolean) {
        const key = `${axis}:${code}`;
        if (removed.has(key)) {
            return;
        }
        const rule = ruleFor(page, edits, axis, code);
        const exception = rowBecomesException(rule);
        if (!exception && !savedFlag && !pendingAdds.has(key)) {
            return;
        }
        items.push({
            code,
            title,
            axis,
            folder: folders.at(-1) ?? null,
            path: folders.join(" / "),
            fromPeriod,
            saved: savedFlag,
            exception,
            pending: pendingAdds.has(key),
            preview: rule.automatic ? algorithmChannels(page, code, rule.baseMode) : null,
            rule,
        });
    }
    for (const item of page.directory) {
        seen.add(item.code);
        const row = saved.get(item.code);
        consider(item.code, item.title, item.folders, row?.fromPeriod ?? null, row !== undefined);
    }
    for (const row of saved.values()) {
        if (seen.has(row.code)) {
            continue;
        }
        consider(row.code, row.title, row.archived ? [ARCHIVE_FOLDER] : row.folders, row.fromPeriod, true);
    }
    return items.sort((left, right) => left.title.localeCompare(right.title, "ru", { numeric: true }));
}

function buildTree(page: TariffExceptionReport): TreeNode[] {
    if (!page.axis) {
        return [];
    }
    const axis = page.axis;
    const root: TreeNode[] = [];
    for (const item of page.directory) {
        place(root, item.folders, {
            type: "item",
            key: `${axis}:${item.code}`,
            code: item.code,
            title: item.title,
            axis,
        });
    }
    return sortNodes(root);
}

function withoutListed(nodes: TreeNode[], listed: Set<string>): TreeNode[] {
    const visible: TreeNode[] = [];
    for (const node of nodes) {
        if (node.type === "item") {
            if (!listed.has(node.code)) {
                visible.push(node);
            }
            continue;
        }
        const children = withoutListed(node.children, listed);
        if (children.length > 0) {
            visible.push({ ...node, children });
        }
    }
    return visible;
}

function filterTree(nodes: TreeNode[], needle: string): TreeNode[] {
    const query = needle.trim().toLowerCase();
    if (!query) {
        return nodes;
    }
    const matched: TreeNode[] = [];
    for (const node of nodes) {
        if (node.type === "folder") {
            if (node.name.toLowerCase().includes(query)) {
                matched.push(node);
                continue;
            }
            const children = filterTree(node.children, query);
            if (children.length > 0) {
                matched.push({ ...node, children });
            }
            continue;
        }
        if (node.title.toLowerCase().includes(query)) {
            matched.push(node);
        }
    }
    return matched;
}

function folderKeys(nodes: TreeNode[], acc = new Set<string>()): Set<string> {
    for (const node of nodes) {
        if (node.type === "folder") {
            acc.add(node.key);
            folderKeys(node.children, acc);
        }
    }
    return acc;
}

function place(nodes: TreeNode[], folders: string[], item: ItemNode, archive = false) {
    let children = nodes;
    const path: string[] = [];
    folders.forEach((name, index) => {
        path.push(name);
        const key = path.join("\0");
        let folder = children.find((node): node is FolderNode => node.type === "folder" && node.key === key);
        if (!folder) {
            folder = { type: "folder", key, name, archive: archive && index === 0, children: [] };
            children.push(folder);
        }
        children = folder.children;
    });
    children.push(item);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
    const folders = nodes.filter((node): node is FolderNode => node.type === "folder" && !node.archive);
    const archive = nodes.filter((node): node is FolderNode => node.type === "folder" && node.archive);
    const items = nodes.filter((node): node is ItemNode => node.type === "item");
    const byName = (left: { name: string }, right: { name: string }) => left.name.localeCompare(right.name, "ru", { numeric: true });
    const byTitle = (left: ItemNode, right: ItemNode) => left.title.localeCompare(right.title, "ru", { numeric: true });
    return [
        ...folders.sort(byName).map((folder) => ({ ...folder, children: sortNodes(folder.children) })),
        ...items.sort(byTitle),
        ...archive.map((folder) => ({ ...folder, children: sortNodes(folder.children) })),
    ];
}

function foldersWithIncluded(nodes: TreeNode[], included: Set<string>, acc = new Set<string>()): Set<string> {
    for (const node of nodes) {
        if (node.type === "folder" && folderHasIncluded(node, included)) {
            acc.add(node.key);
            foldersWithIncluded(node.children, included, acc);
        }
    }
    return acc;
}

function folderHasIncluded(node: TreeNode, included: Set<string>): boolean {
    if (node.type === "item") {
        return included.has(node.code);
    }
    return node.children.some((child) => folderHasIncluded(child, included));
}

function ExceptionsHelp({ axis }: { axis: TariffAxis | null }) {
    const subject = axis === "product_kind" ? "изделия" : "категории";
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Список</h3>
                <p className="text-muted-foreground">В списке показаны {subject}, для которых установлено исключение. Состав списка меняется в окне «{selectionTitle(axis)}»: отмеченные позиции входят в список, снятая отметка исключает позицию. Изменение переносится в список кнопкой «Применить». До сохранения добавленная строка выделяется цветом.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Удаление</h3>
                <p className="text-muted-foreground">Кнопка в конце строки исключает позицию из списка. Изменение применяется после сохранения.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Редактирование</h3>
                <p className="text-muted-foreground">Список можно изменять в открытом месяце. Переключение вида расчёта включает автоматический расчёт и показывает его значения. Пока автоматический расчёт включён, ставки будут записаны после пересчёта тарифов. Закрытый месяц доступен для просмотра.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сохранение</h3>
                <p className="text-muted-foreground">Кнопка «Сохранить» записывает список исключений выбранного месяца. После сохранения тарифы этого месяца необходимо пересчитать. «Отменить» возвращает последний сохранённый список.</p>
            </section>
        </div>
    );
}

function selectionTitle(axis: TariffAxis | null): string {
    if (axis === "product_kind") {
        return "Выбор изделий";
    }
    return "Выбор категорий";
}

function selectionDescription(axis: TariffAxis | null): string {
    if (axis === "product_kind") {
        return "Отметьте изделия, которые должны входить в исключения. Снятая отметка исключит изделие из списка.";
    }
    return "Отметьте категории, которые должны входить в исключения. Снятая отметка исключит категорию из списка.";
}

function savedRule(page: TariffExceptionReport, axis: TariffAxis, code: string): RuleDraft {
    const row = page.rows.find((item) => item.axis === axis && item.code === code);
    if (!row) {
        return AUTOMATIC_RULE;
    }
    return { automatic: row.automatic, baseMode: row.baseMode, main: row.main, im: row.im, b2b: row.b2b };
}

function ruleFor(page: TariffExceptionReport, edits: Record<string, RuleDraft>, axis: TariffAxis, code: string): RuleDraft {
    return edits[`${axis}:${code}`] ?? savedRule(page, axis, code);
}

function sameDraft(left: RuleDraft, right: RuleDraft): boolean {
    return left.automatic === right.automatic
        && left.baseMode === right.baseMode
        && left.main === right.main
        && left.im === right.im
        && left.b2b === right.b2b;
}

function exceptionItems(page: TariffExceptionReport, edits: Record<string, RuleDraft>, codes: string[]): TariffExceptionInput[] {
    if (!page.axis) {
        return [];
    }
    const axis = page.axis;
    const items: TariffExceptionInput[] = [];
    for (const code of codes) {
        const rule = ruleFor(page, edits, axis, code);
        items.push({
            code,
            baseMode: rule.baseMode,
            automatic: rule.automatic,
            main: rule.automatic ? null : parseTariffRate(rule.main),
            im: rule.automatic ? null : parseTariffRate(rule.im),
            b2b: rule.automatic ? null : parseTariffRate(rule.b2b),
        });
    }
    return items;
}

function algorithmChannels(page: TariffExceptionReport, code: string, mode: TariffBaseMode) {
    const quote = page.quotes.find((item) => item.code === code);
    if (!quote) {
        return null;
    }
    return calculateAlgorithmTariffs({
        stat: quote,
        mode,
        service: calculateServiceTariffs(quote, page.service),
    });
}

function nameColumnTitle(axis: TariffAxis | null): string {
    if (axis === "product_kind") {
        return "Изделие";
    }
    if (axis === "category") {
        return "Категория";
    }
    return "Название";
}

function periodHint(page: TariffExceptionReport, loading: boolean): { text: string; tone: PeriodHintTone } {
    if (loading) {
        return { tone: "loading", text: "Загрузка периода…" };
    }
    const effect = describePeriodEffect({
        period: page.period,
        appliedPeriod: page.appliedPeriod,
        savedPeriods: page.savedPeriods.map((period) => ({ period })),
    });
    return { tone: effect.kind, text: "Показаны включённые исключения на выбранный месяц." };
}

function storedPercentToDraft(stored: string | null): string {
    if (stored === null || stored === "") {
        return "";
    }
    const number = Number(stored);
    if (!Number.isFinite(number)) {
        return stored;
    }
    return String(Math.round(number * 10_000) / 100);
}

function draftPercentToStored(raw: string): string {
    const number = Number(raw.trim().replace(",", "."));
    if (!Number.isFinite(number)) {
        return raw.trim();
    }
    return String(Math.round(number * 100) / 10_000);
}

function formatRate(value: string | null, percent: boolean): string {
    if (value === null || value === "") {
        return "—";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return value;
    }
    if (percent) {
        return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Math.round(number * 10_000) / 100)}%`;
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(number);
}
