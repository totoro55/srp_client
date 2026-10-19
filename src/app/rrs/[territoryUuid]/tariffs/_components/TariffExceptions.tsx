"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Hash, BadgePercent, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/form-alert";
import { HelpDrawer } from "@/components/help-drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tariffAxisTitle, type TariffAxis } from "@/lib/baskets";
import { closedPeriodMessage } from "@/lib/rrs-edit-window";
import { PinnedTable } from "@/components/pinned-table";
import { notifySuccess } from "@/lib/notify";
import {
    calculateAlgorithmTariffs,
    calculateServiceTariffs,
    DEFAULT_TARIFF_REFERENCE,
    EMPTY_TARIFF_SAVE_MESSAGE,
    territoryReference,
    TRIMMED_MEAN_PROPORTION,
    type TariffReference,
    type TariffServiceContext,
    openPeriodRows,
    parseTariffRate,
    rowBecomesException,
    setManualChannel,
    setRowAutomatic,
    setRowMode,
    tariffRowComplete,
    type TariffChannels,
    type TariffRowDraft,
} from "@/lib/tariff-calculation";
import { type TariffBaseMode, type TariffExceptionPage, type TariffExceptionWeights, type TariffSaleStat } from "@/lib/tariff-exceptions";
import { ApiResponse } from "@/types/api";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { formatMonth } from "../../../_components/model";
import { cn } from "@/lib/utils";

interface DraftLine extends TariffRowDraft {}

interface WeightDraft {
    salesShareWeight: number;
    priceShareWeight: number;
}

export function TariffExceptions() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<TariffExceptionPage | null>(null);
    const [lines, setLines] = useState<DraftLine[]>([]);
    const [saved, setSaved] = useState<DraftLine[]>([]);
    const linesRef = useRef<DraftLine[]>([]);
    const savedRef = useRef<DraftLine[]>([]);
    const shownPeriodRef = useRef<string | null>(null);
    const revertError = useRef<string | null>(null);
    const flushEdit = useRef<(() => void) | null>(null);
    const [fieldEditing, setFieldEditing] = useState(false);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [weights, setWeights] = useState<WeightDraft | null>(null);
    const weightsRef = useRef<WeightDraft | null>(null);
    const weightFlush = useRef<(() => void) | null>(null);
    const [weightBaseline, setWeightBaseline] = useState<WeightDraft | null>(null);
    const [weightsEditable, setWeightsEditable] = useState(false);
    const [algorithmTitle, setAlgorithmTitle] = useState<string | null>(null);
    const [reference, setReference] = useState<TariffReference>(DEFAULT_TARIFF_REFERENCE);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        if (!revertError.current) {
            setError(null);
        }
        const chosen = period ?? requestedPeriod;
        const suffix = chosen ? `?period=${encodeURIComponent(chosen)}` : "";
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/tariff-exceptions${suffix}`);
            const json = (await response.json()) as ApiResponse<TariffExceptionPage>;
            if (!json.success) {
                setError(json.error.message);
                const shown = shownPeriodRef.current;
                if (shown && chosen && chosen !== shown) {
                    revertError.current = json.error.message;
                    router.replace(`/rrs/${territoryUuid}/tariffs?period=${shown}`);
                } else if (!shown) {
                    setPage(null);
                }
                return;
            }
            const next = json.data;
            const nextWeights = weightDraft(next.weights);
            const drafts = openPeriodRows(next.stats, next.exceptions, next.editable, serviceContext(nextWeights, next, DEFAULT_TARIFF_REFERENCE));
            const keptError = revertError.current;
            revertError.current = null;
            shownPeriodRef.current = next.period;
            linesRef.current = drafts;
            savedRef.current = drafts;
            weightsRef.current = nextWeights;
            setPage(next);
            setLines(drafts);
            setSaved(drafts);
            setWeights(nextWeights);
            setWeightBaseline(nextWeights);
            setWeightsEditable(next.weights?.editable ?? false);
            setAlgorithmTitle(next.weights?.title ?? null);
            setReference(DEFAULT_TARIFF_REFERENCE);
            setFilter("");
            setError(keptError && next.period === shownPeriodRef.current ? keptError : null);
        } catch {
            setError("Не удалось загрузить статистику");
            if (!shownPeriodRef.current) {
                setPage(null);
            }
        } finally {
            setLoading(false);
        }
    }, [requestedPeriod, territoryUuid, router]);

    useEffect(() => {
        void load();
    }, [load]);

    const commitLines = useCallback((update: (current: DraftLine[]) => DraftLine[]) => {
        const next = update(linesRef.current);
        if (next === linesRef.current) {
            return;
        }
        linesRef.current = next;
        setLines(next);
    }, []);

    useEffect(() => {
        if (!page?.editable) {
            return;
        }
        const context = serviceContext(weights, page, page.weights?.referenceSelectable ? reference : DEFAULT_TARIFF_REFERENCE);
        const statsByCode = new Map(page.stats.map((stat) => [stat.code, stat]));
        commitLines((current) => {
            let changed = false;
            const next = current.map((line) => {
                if (!line.automatic) {
                    return line;
                }
                const stat = statsByCode.get(line.code);
                if (!stat) {
                    return line;
                }
                const calculated = calculateAlgorithmTariffs({
                    stat,
                    mode: line.baseMode,
                    service: calculateServiceTariffs(stat, context),
                });
                if (line.main === calculated.main && line.im === calculated.im && line.b2b === calculated.b2b) {
                    return line;
                }
                changed = true;
                return { ...line, ...calculated };
            });
            return changed ? next : current;
        });
    }, [page, weights, reference, commitLines]);

    const dirty = rowFingerprint(lines) !== rowFingerprint(saved);
    const weightsDirty = weightKey(weights) !== weightKey(weightBaseline);
    const incomplete = lines.some((row) => !tariffRowComplete(row));
    const hint = page ? periodHint(page, loading) : null;

    const currentWithoutData = Boolean(page && page.stats.length === 0 && page.period.slice(0, 7) === page.editPolicy.currentMonth);
    const blankPeriod = Boolean(page && page.stats.length === 0 && !currentWithoutData);

    const referenceSelectable = Boolean(page?.weights?.referenceSelectable);
    const shownReference = referenceSelectable ? reference : DEFAULT_TARIFF_REFERENCE;
    const tariffContext = useMemo(() => page ? serviceContext(weights, page, shownReference) : null, [page, weights, shownReference]);
    const referenceTest = shownReference !== DEFAULT_TARIFF_REFERENCE;

    const applyWeights = useCallback((next: WeightDraft) => {
        weightsRef.current = next;
        setWeights(next);
    }, []);

    async function save() {
        flushEdit.current?.();
        weightFlush.current?.();
        const current = linesRef.current;
        if (!page) {
            return;
        }
        if (current.some((row) => !tariffRowComplete(row))) {
            setError(EMPTY_TARIFF_SAVE_MESSAGE);
            return;
        }
        const rows = current.map((line) => {
            const main = parseTariffRate(line.main);
            const im = parseTariffRate(line.im);
            const b2b = parseTariffRate(line.b2b);
            return main === null || im === null || b2b === null ? null : {
                code: line.code,
                automatic: line.automatic,
                baseMode: line.baseMode,
                main,
                im,
                b2b,
            };
        });
        if (rows.some((row) => row === null)) {
            setError(EMPTY_TARIFF_SAVE_MESSAGE);
            return;
        }
        setSaving(true);
        setError(null);
        const response = await fetch(`/api/rrs/cards/${territoryUuid}/tariff-exceptions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                period: page.period,
                rows,
                weights: page.weights?.editable ? weightsRef.current : undefined,
            }),
        });
        const json = (await response.json()) as ApiResponse<{ saved: true }>;
        setSaving(false);
        if (!json.success) {
            setError(json.error.message);
            return;
        }
        notifySuccess("Тарифы сохранены");
        await load(page.period);
    }

    return (
        <div className="flex flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="tariffs"
                period={page?.period}
                cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : null}
                controls={page && hint ? (
                    <>
                        <RrsPeriodControls
                            period={page.period}
                            appliedPeriod={page.appliedPeriod}
                            savedPeriods={page.savedPeriods.map((period) => ({ period }))}
                            disabled={loading || saving}
                            hint={hint}
                            onPeriodChange={(period) => {
                                router.replace(`/rrs/${territoryUuid}/tariffs?period=${period}`);
                                void load(period);
                            }}
                        />
                        {blankPeriod ? null : (
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" title={referenceTest ? "Тестовый расчёт не записывается. Для сохранения выберите среднее." : undefined} disabled={saving || referenceTest || incomplete || (!page.editable && !currentWithoutData)} onMouseDown={() => { flushEdit.current?.(); weightFlush.current?.(); }} onClick={() => void save()}>
                                <Save />
                                Сохранить
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={saving || (!dirty && !weightsDirty && !fieldEditing && !referenceTest)} onMouseDown={() => { flushEdit.current?.(); weightFlush.current?.(); }} onClick={() => { flushEdit.current = null; weightFlush.current = null; linesRef.current = savedRef.current; setLines(savedRef.current); setFieldEditing(false); weightsRef.current = weightBaseline; setWeights(weightBaseline); setReference(DEFAULT_TARIFF_REFERENCE); }}>
                                <Undo2 />
                                Отменить
                            </Button>
                            <HelpDrawer title="Расчёт тарифов">
                                <TariffHelp cutoffDay={page.editPolicy.cutoffDay} axis={page.connection?.axis ?? null} />
                            </HelpDrawer>
                        </div>
                        )}
                    </>
                ) : null}
            />
            <FormAlert message={error} />
            {loading && !page ? <p className="text-sm text-muted-foreground">Загрузка статистики...</p> : null}
            {page && !blankPeriod ? (
                <section className="flex flex-col gap-4">
                    <ConnectionNote connection={page.connection} />
                    {page.connection?.axis ? (
                        <CalculationSettings
                            title={algorithmTitle}
                            weights={weights}
                            weightsEditable={weightsEditable && !saving}
                            bounds={page.bounds}
                            stats={page.stats}
                            reference={shownReference}
                            referenceSelectable={referenceSelectable}
                            referenceDisabled={!page.editable || saving || page.stats.length === 0}
                            weightFlush={weightFlush}
                            onWeights={applyWeights}
                            onReference={setReference}
                        />
                    ) : null}
                    {page.connection?.axis ? (
                        <StatsTable
                            stats={page.stats}
                            lines={lines}
                            filter={filter}
                            editable={page.editable}
                            saving={saving}
                            serviceContext={tariffContext}
                            flushEdit={flushEdit}
                            onFilter={setFilter}
                            onLines={commitLines}
                            onEditing={setFieldEditing}
                        />
                    ) : null}
                </section>
            ) : null}
        </div>
    );
}

function StatsTable({
    stats,
    lines,
    filter,
    editable,
    saving,
    serviceContext,
    flushEdit,
    onFilter,
    onLines,
    onEditing,
}: {
    stats: TariffSaleStat[];
    lines: DraftLine[];
    filter: string;
    editable: boolean;
    saving: boolean;
    serviceContext: TariffServiceContext | null;
    flushEdit: { current: (() => void) | null };
    onFilter: (value: string) => void;
    onLines: (update: (current: DraftLine[]) => DraftLine[]) => void;
    onEditing: (editing: boolean) => void;
}) {
    const needle = filter.trim().toLowerCase();
    const [sort, setSort] = useState<StatSort>({ key: "quantity", direction: "desc" });
    const byCode = useMemo(() => new Map(lines.map((line) => [line.code, line])), [lines]);
    const services = useMemo(
        () => new Map(stats.map((stat) => [stat.code, calculateServiceTariffs(stat, serviceContext)])),
        [stats, serviceContext],
    );
    const priceScale = useMemo(() => columnScale([...services.values()].map((service) => service.priceTariff)), [services]);
    const shareScale = useMemo(() => columnScale([...services.values()].map((service) => service.shareTariff)), [services]);
    const sortUsesLines = sort.key === "main" || sort.key === "im" || sort.key === "b2b" || sort.key === "auto" || sort.key === "mode";
    const lineOrder = sortUsesLines
        ? lines.map((line) => `${line.code}:${line.automatic}:${line.baseMode}:${line.main ?? ""}:${line.im ?? ""}:${line.b2b ?? ""}`).join("\n")
        : "";
    const visible = useMemo(() => {
        const filtered = needle
            ? stats.filter((stat) => stat.title.toLowerCase().includes(needle) || (stat.parent ?? "").toLowerCase().includes(needle))
            : stats;
        const linesByCode = lineOrder
            ? new Map(lines.map((line) => [line.code, line]))
            : new Map<string, DraftLine>();
        return filtered.slice().sort((left, right) => compareStats(left, right, sort, linesByCode, services));
    }, [stats, needle, sort, lineOrder, services]);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                    <span className="text-muted-foreground">Найти в статистике</span>
                    <Input value={filter} placeholder="Название или папка" onKeyDown={blurOnEnter} onChange={(event) => onFilter(event.target.value)} />
                </label>
                <p className="text-sm text-muted-foreground">{visible.length} из {stats.length}</p>
            </div>
            {stats.length === 0 ? (
                <p className="text-sm text-muted-foreground">За этот месяц статистики продаж по выбранному виду расчета нет.</p>
            ) : (
                <PinnedTable
                    minWidthClass="min-w-[1128px]"
                    columns={() => (
                        <colgroup>
                            <col />
                            <col />
                            <col className="w-[5.5rem]" />
                            <col className="w-[5.25rem]" />
                            <col className="w-[5.25rem]" />
                            <col className="w-[5.25rem]" />
                            <col className="w-20" />
                            <col className="w-[6.25rem]" />
                            <col className="w-[5.25rem]" />
                            <col className="w-[4.5rem]" />
                            <col className="w-[5rem]" />
                        </colgroup>
                    )}
                    head={(
                        <tr>
                            <SortHeader label="Название" column="title" sort={sort} onSort={setSort} />
                            <SortHeader label="Папка" column="parent" sort={sort} onSort={setSort} />
                            <SortHeader label="Средняя стоимость" column="avgPrice" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label="Продано, шт" column="quantity" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label={<>Тариф<br />за цену</>} column="priceTariff" sort={sort} onSort={setSort} align="right" title="Тариф за цену" />
                            <SortHeader label={<>Тариф<br />за долю</>} column="shareTariff" sort={sort} onSort={setSort} align="right" title="Тариф за долю" />
                            <SortHeader
                                label={<>Автомати-<br />ческий<br />расчет</>}
                                column="auto"
                                sort={sort}
                                onSort={setSort}
                                title="Автоматический расчет"
                                align="center"
                            />
                            <SortHeader label="Тариф от цены или количества" column="mode" sort={sort} onSort={setSort} align="center" />
                            <SortHeader label="Тариф розница" column="main" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label="Тариф ИМ" column="im" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label="Тариф Безнал" column="b2b" sort={sort} onSort={setSort} align="right" />
                        </tr>
                    )}
                >
                    {visible.map((stat) => (
                        <StatRow
                            key={stat.code}
                            stat={stat}
                            line={byCode.get(stat.code)}
                            service={services.get(stat.code) ?? EMPTY_SERVICE}
                            pricePlace={placeInColumn(services.get(stat.code)?.priceTariff ?? null, priceScale)}
                            sharePlace={placeInColumn(services.get(stat.code)?.shareTariff ?? null, shareScale)}
                            editable={editable}
                            saving={saving}
                            serviceContext={serviceContext}
                            flushEdit={flushEdit}
                            onLines={onLines}
                            onEditing={onEditing}
                        />
                    ))}
                </PinnedTable>
            )}
        </div>
    );
}

type StatColumn = "title" | "parent" | "avgPrice" | "quantity" | "priceTariff" | "shareTariff" | "auto" | "mode" | "main" | "im" | "b2b";
type StatSort = { key: StatColumn; direction: "asc" | "desc" };

function SortHeader({
    label,
    title,
    column,
    sort,
    onSort,
    align = "left",
}: {
    label: ReactNode;
    title?: string;
    column: StatColumn;
    sort: StatSort;
    onSort: (sort: StatSort) => void;
    align?: "left" | "right" | "center";
}) {
    const active = sort.key === column;
    const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
    const buttonClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
    return (
        <th className={`relative border border-border bg-muted px-1.5 py-1.5 font-medium ${alignClass}`} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
            <button
                type="button"
                className={`flex w-full min-w-0 items-center gap-0.5 hover:text-foreground ${buttonClass}`}
                title={title}
                aria-label={title}
                onClick={() => onSort(active ? { key: column, direction: sort.direction === "asc" ? "desc" : "asc" } : { key: column, direction: column === "title" || column === "parent" || column === "mode" ? "asc" : "desc" })}
            >
                <span className="min-w-0 whitespace-normal break-words leading-tight">{label}</span>
            </button>
            {active ? <span className="pointer-events-none absolute top-0.5 right-0.5 text-[10px]" aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
        </th>
    );
}

function compareStats(
    left: TariffSaleStat,
    right: TariffSaleStat,
    sort: StatSort,
    exceptions: Map<string, DraftLine>,
    services: Map<string, { priceTariff: string | null; shareTariff: string | null }>,
): number {
    const factor = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "mode") {
        const leftMode = exceptions.get(left.code)?.baseMode === "percent" ? "Тариф от цены" : "Тариф от количества";
        const rightMode = exceptions.get(right.code)?.baseMode === "percent" ? "Тариф от цены" : "Тариф от количества";
        const difference = leftMode.localeCompare(rightMode, "ru");
        return difference === 0 ? left.title.localeCompare(right.title, "ru") : difference * factor;
    }
    if (sort.key === "auto") {
        const leftOn = exceptions.get(left.code)?.automatic === false ? 0 : 1;
        const rightOn = exceptions.get(right.code)?.automatic === false ? 0 : 1;
        return leftOn === rightOn ? left.title.localeCompare(right.title, "ru") : (leftOn - rightOn) * factor;
    }
    if (sort.key === "priceTariff" || sort.key === "shareTariff") {
        return compareNumbers(services.get(left.code)?.[sort.key] ?? null, services.get(right.code)?.[sort.key] ?? null, left.title, right.title, factor);
    }
    if (sort.key === "main" || sort.key === "im" || sort.key === "b2b") {
        return compareNumbers(exceptions.get(left.code)?.[sort.key] ?? null, exceptions.get(right.code)?.[sort.key] ?? null, left.title, right.title, factor);
    }
    if (sort.key === "avgPrice" || sort.key === "quantity") {
        return compareNumbers(left[sort.key], right[sort.key], left.title, right.title, factor);
    }
    const leftText = (sort.key === "parent" ? left.parent : left.title) ?? "";
    const rightText = (sort.key === "parent" ? right.parent : right.title) ?? "";
    if (!leftText && !rightText) {
        return left.title.localeCompare(right.title, "ru");
    }
    if (!leftText) {
        return 1;
    }
    if (!rightText) {
        return -1;
    }
    const difference = leftText.localeCompare(rightText, "ru");
    return difference === 0 ? left.title.localeCompare(right.title, "ru") : difference * factor;
}

function compareNumbers(leftValue: string | null, rightValue: string | null, leftTitle: string, rightTitle: string, factor: number): number {
    const leftNumber = numericValue(leftValue);
    const rightNumber = numericValue(rightValue);
    if (leftNumber === null && rightNumber === null) {
        return leftTitle.localeCompare(rightTitle, "ru");
    }
    if (leftNumber === null) {
        return 1;
    }
    if (rightNumber === null) {
        return -1;
    }
    return leftNumber === rightNumber ? leftTitle.localeCompare(rightTitle, "ru") : (leftNumber - rightNumber) * factor;
}

const EMPTY_SERVICE = { priceTariff: null, shareTariff: null };

const StatRow = memo(function StatRow({
    stat,
    line,
    service,
    pricePlace,
    sharePlace,
    editable,
    saving,
    serviceContext,
    flushEdit,
    onLines,
    onEditing,
}: {
    stat: TariffSaleStat;
    line: DraftLine | undefined;
    service: { priceTariff: string | null; shareTariff: string | null };
    pricePlace: number | null;
    sharePlace: number | null;
    editable: boolean;
    saving: boolean;
    serviceContext: TariffServiceContext | null;
    flushEdit: { current: (() => void) | null };
    onLines: (update: (current: DraftLine[]) => DraftLine[]) => void;
    onEditing: (editing: boolean) => void;
}) {
    const automatic = line ? line.automatic : true;
    const mode = line?.baseMode === "percent" ? "percent" : "per_unit";
    const manual = line ? rowBecomesException(line) : false;
    return (
        <tr className={cn("align-top", manual && "bg-amber-50 dark:bg-amber-950/40")} title={manual ? "В строке ручные изменения" : undefined}>
            <td className="border border-border px-2 py-1.5 font-medium break-words">{stat.title}</td>
            <td className="border border-border px-2 py-1.5 break-words text-muted-foreground">{stat.parent ?? "—"}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{formatStat(stat.avgPrice)}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{formatStat(stat.quantity)}</td>
            <TariffCell value={service.priceTariff} place={pricePlace} tone="price" />
            <TariffCell value={service.shareTariff} place={sharePlace} tone="share" />
            <td className="border border-border px-1 py-1.5 align-middle">
                <div className="flex justify-center">
                    <Checkbox
                        checked={automatic}
                        disabled={!editable || saving || !line}
                        aria-label={`Автоматический расчет для «${stat.title}»`}
                        onCheckedChange={(value) => {
                            if (!line) {
                                return;
                            }
                            onLines((current) => current.map((item) => item.code === stat.code ? setRowAutomatic(item, stat, value === true, serviceContext) : item));
                        }}
                    />
                </div>
            </td>
            <td className="border border-border px-1 py-1.5 align-middle">
                <div className="flex justify-center">
                    <TariffModeToggle
                        mode={mode}
                        disabled={!editable || saving || !line}
                        title={stat.title}
                        onChange={(nextMode) => {
                            if (!line) {
                                return;
                            }
                            onLines((current) => current.map((item) => item.code === stat.code ? setRowMode(item, stat, nextMode, serviceContext) : item));
                        }}
                    />
                </div>
            </td>
            <RateCell stat={stat} line={line} channel="main" label="Тариф розница" editable={editable} saving={saving} flushEdit={flushEdit} onLines={onLines} onEditing={onEditing} />
            <RateCell stat={stat} line={line} channel="im" label="Тариф ИМ" editable={editable} saving={saving} flushEdit={flushEdit} onLines={onLines} onEditing={onEditing} />
            <RateCell stat={stat} line={line} channel="b2b" label="Тариф Безнал" editable={editable} saving={saving} flushEdit={flushEdit} onLines={onLines} onEditing={onEditing} />
        </tr>
    );
});

function RateCell({
    stat,
    line,
    channel,
    label,
    editable,
    saving,
    flushEdit,
    onLines,
    onEditing,
}: {
    stat: TariffSaleStat;
    line: DraftLine | undefined;
    channel: keyof TariffChannels;
    label: string;
    editable: boolean;
    saving: boolean;
    flushEdit: { current: (() => void) | null };
    onLines: (update: (current: DraftLine[]) => DraftLine[]) => void;
    onEditing: (editing: boolean) => void;
}) {
    const value = line?.[channel] ?? null;
    const percent = channel === "main" && line?.baseMode === "percent";
    const shown = percent ? formatStoredPercent(value) : formatTariff(value);
    const [draft, setDraft] = useState(percent ? storedPercentToDraft(value) : (value ?? ""));
    const draftRef = useRef(draft);
    const focused = useRef(false);

    useEffect(() => {
        if (!focused.current) {
            const nextDraft = percent ? storedPercentToDraft(value) : (value ?? "");
            draftRef.current = nextDraft;
            setDraft(nextDraft);
        }
    }, [percent, value]);

    function commit(nextDraft: string) {
        const next = nextDraft.trim() === "" ? null : (percent ? draftPercentToStored(nextDraft) : nextDraft.trim());
        if ((value ?? null) === next || !line) {
            return;
        }
        onLines((current) => current.map((item) => item.code === stat.code ? setManualChannel(item, channel, next) : item));
    }

    if (!line || line.automatic || !editable) {
        return <td className="border border-border px-2 py-1.5 text-right tabular-nums">{shown === "" ? "" : percent ? `${shown}%` : shown}</td>;
    }
    return (
        <td className="border border-border px-1 py-1 align-middle">
            <div className="flex items-center gap-0.5">
                <Input
                    value={draft}
                    disabled={saving}
                    inputMode="decimal"
                    aria-label={`${label} для «${stat.title}»`}
                    className="h-7 px-1 text-right text-xs tabular-nums"
                    onKeyDown={blurOnEnter}
                    onFocus={() => {
                        focused.current = true;
                        flushEdit.current = () => commit(draftRef.current);
                        onEditing(true);
                    }}
                    onBlur={() => {
                        focused.current = false;
                        commit(draftRef.current);
                        flushEdit.current = null;
                        onEditing(false);
                    }}
                    onChange={(event) => {
                        draftRef.current = event.target.value;
                        setDraft(event.target.value);
                        flushEdit.current = () => commit(draftRef.current);
                    }}
                />
                {percent ? <span className="text-xs text-muted-foreground">%</span> : null}
            </div>
        </td>
    );
}

function rowFingerprint(rows: DraftLine[]): string {
    return JSON.stringify(rows.map((row) => ({
        code: row.code,
        automatic: row.automatic,
        baseMode: row.baseMode,
        main: row.main,
        im: row.im,
        b2b: row.b2b,
    })));
}

function serviceContext(weights: WeightDraft | null, page: TariffExceptionPage, reference: TariffReference): TariffServiceContext | null {
    if (!weights) {
        return null;
    }
    return {
        salesShareWeight: weights.salesShareWeight,
        priceShareWeight: weights.priceShareWeight,
        min: boundNumber(page.bounds, "min"),
        base: boundNumber(page.bounds, "base"),
        max: boundNumber(page.bounds, "max"),
        averagePrice: territoryReference(page.stats.map((stat) => stat.avgPrice), reference),
        averageQuantity: territoryReference(page.stats.map((stat) => stat.quantity), reference),
        adjustShareByPrice: reference === "priceAdjusted",
    };
}

function boundNumber(bounds: TariffExceptionPage["bounds"], key: "min" | "base" | "max"): number | null {
    const raw = bounds.find((bound) => bound.key === key)?.value ?? null;
    if (raw === null) {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function numericValue(value: string | null): number | null {
    if (value === null || value === "") {
        return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function TariffCell({ value, place, tone }: { value: string | null; place: number | null; tone: "price" | "share" }) {
    const filled = place !== null && value !== null && value !== "";
    return (
        <td className="relative border border-border p-0 text-right tabular-nums">
            {filled ? (
                <span
                    aria-hidden
                    className={cn("absolute inset-0", tone === "price" ? "bg-sky-500" : "bg-primary")}
                    style={{ opacity: 0.12 + place * 0.7 }}
                />
            ) : null}
            <span className="relative block px-2 py-1.5">{formatTariff(value)}</span>
        </td>
    );
}

function columnScale(values: Array<string | null>): { min: number; max: number } | null {
    const numbers = values
        .map((value) => value === null ? null : Number(value))
        .filter((value): value is number => value !== null && Number.isFinite(value));
    if (numbers.length === 0) {
        return null;
    }
    return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function placeInColumn(value: string | null, scale: { min: number; max: number } | null): number | null {
    if (value === null || scale === null) {
        return null;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return null;
    }
    if (scale.max === scale.min) {
        return 1;
    }
    return (number - scale.min) / (scale.max - scale.min);
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

function formatStoredPercent(stored: string | null): string {
    const draft = storedPercentToDraft(stored);
    if (draft === "") {
        return "";
    }
    const number = Number(draft);
    if (!Number.isFinite(number)) {
        return draft;
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(number);
}

function formatTariff(value: string | null): string {
    if (value === null || value === "") {
        return "";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return value;
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(number);
}

function formatStat(value: string | null): string {
    if (value === null || value === "") {
        return "—";
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return value;
    }
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(number);
}

function ConnectionNote({ connection }: { connection: TariffExceptionPage["connection"] }) {
    if (!connection) {
        return <p className="text-sm">Корзина продаж не подключена.</p>;
    }
    if (!connection.axis) {
        return <p className="text-sm">{`Версия ${connection.versionNo} «${connection.versionName}». Вид расчёта не выбран.`}</p>;
    }
    return (
        <p className="text-sm">
            {`Версия ${connection.versionNo} «${connection.versionName}». ${tariffAxisTitle(connection.axis)}.`}
        </p>
    );
}

function CalculationSettings({
    title,
    weights,
    weightsEditable,
    bounds,
    stats,
    reference,
    referenceSelectable,
    referenceDisabled,
    weightFlush,
    onWeights,
    onReference,
}: {
    title: string | null;
    weights: WeightDraft | null;
    weightsEditable: boolean;
    bounds: TariffExceptionPage["bounds"];
    stats: TariffSaleStat[];
    reference: TariffReference;
    referenceSelectable: boolean;
    referenceDisabled: boolean;
    weightFlush: { current: (() => void) | null };
    onWeights: (weights: WeightDraft) => void;
    onReference: (reference: TariffReference) => void;
}) {
    const priceAverage = territoryReference(stats.map((stat) => stat.avgPrice), reference);
    const quantityAverage = territoryReference(stats.map((stat) => stat.quantity), reference);
    const labels = referenceStatLabels(reference);
    return (
        <section className="@container w-full max-w-4xl rounded-lg border bg-card p-4">
            {referenceSelectable ? <ReferenceSwitch reference={reference} disabled={referenceDisabled} onChange={onReference} /> : null}
            <div className={cn("flex flex-col gap-4 @min-[40rem]:grid @min-[40rem]:grid-cols-2 @min-[40rem]:items-start @min-[40rem]:gap-6", referenceSelectable && "mt-4")}>
                {weights && title ? (
                <AlgorithmWeights
                    title={title}
                    weights={weights}
                    editable={weightsEditable}
                    weightFlush={weightFlush}
                    onChange={onWeights}
                />
                ) : null}
                <div className={cn("flex flex-col gap-1 text-sm", weights && title ? "border-t pt-3 @min-[40rem]:border-t-0 @min-[40rem]:border-l @min-[40rem]:pt-0 @min-[40rem]:pl-6" : undefined)}>
                    {bounds.map((bound) => (
                        <SettingRow key={bound.key} label={bound.title} value={bound.value === null ? null : formatStat(bound.value)} />
                    ))}
                    <SettingRow label={labels.price} value={priceAverage === null ? null : formatStat(String(priceAverage))} />
                    <SettingRow label={labels.quantity} value={quantityAverage === null ? null : formatStat(String(quantityAverage))} />
                </div>
            </div>
        </section>
    );
}

const REFERENCE_OPTIONS: Array<{ id: TariffReference; label: string; annotation: string }> = [
    {
        id: "mean",
        label: "Среднее",
        annotation: "Опора средней стоимости и количества продаж определяется как среднее арифметическое по строкам статистики выбранного месяца. Нулевые и незаполненные значения в расчёт опоры не включаются. Тариф за цену увеличивается при превышении средней стоимости строки над опорой. Тариф за долю увеличивается при количестве продаж ниже опоры. Надбавка за малые продажи начисляется независимо от стоимости товара. Вариант применяется по умолчанию и записывается при сохранении тарифов.",
    },
    {
        id: "median",
        label: "Медиана",
        annotation: "Опора определяется как медиана значений статистики выбранного месяца. При нечётном числе строк используется центральное значение, при чётном — среднее двух центральных. Крайние значения на опору не влияют. Порядок расчёта тарифа за цену и тарифа за долю соответствует варианту «Среднее»: надбавка за малые продажи начисляется независимо от стоимости товара. Вариант предназначен для сравнения на экране и при сохранении тарифов не записывается.",
    },
    {
        id: "trimmed",
        label: "Усечённое среднее",
        annotation: `Опора определяется как среднее арифметическое после исключения ${Math.round(TRIMMED_MEAN_PROPORTION * 100)}% наименьших и ${Math.round(TRIMMED_MEAN_PROPORTION * 100)}% наибольших значений. Опора занимает промежуточное положение между средним арифметическим и медианой. Порядок расчёта тарифа соответствует варианту «Среднее». Вариант предназначен для сравнения на экране и при сохранении тарифов не записывается.`,
    },
    {
        id: "priceAdjusted",
        label: "Поправка на цену",
        annotation: "Опора средней стоимости и количества продаж совпадает с вариантом «Среднее». Тариф за цену рассчитывается без изменений. Надбавка за малые продажи в тарифе за долю сохраняется полностью, если средняя стоимость строки не ниже опоры цены. При стоимости на уровне минимальной премии и ниже надбавка не начисляется: тариф за долю определяется отношением количества строки к опоре. В промежутке между этими уровнями надбавка увеличивается пропорционально стоимости. Вариант предназначен для сравнения на экране и при сохранении тарифов не записывается.",
    },
];

function referenceStatLabels(reference: TariffReference): { price: string; quantity: string } {
    if (reference === "median") {
        return { price: "Медианная цена", quantity: "Медианное количество продаж" };
    }
    if (reference === "trimmed") {
        return { price: "Усечённая средняя цена", quantity: "Усечённое среднее количество" };
    }
    return { price: "Средняя цена", quantity: "Среднее количество продаж" };
}

function ReferenceSwitch({
    reference,
    disabled,
    onChange,
}: {
    reference: TariffReference;
    disabled: boolean;
    onChange: (reference: TariffReference) => void;
}) {
    const selected = REFERENCE_OPTIONS.find((option) => option.id === reference) ?? REFERENCE_OPTIONS[0];
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tooltip>
                    <TooltipTrigger render={<span tabIndex={0} className="cursor-help text-sm underline decoration-dotted underline-offset-4" />}>
                        Опора расчёта
                    </TooltipTrigger>
                    <TooltipContent>
                        По умолчанию применяется среднее. Иные варианты в базу не записываются.
                    </TooltipContent>
                </Tooltip>
                <div role="radiogroup" aria-label="Опора расчёта" className="inline-flex max-w-full flex-wrap rounded-md border p-0.5">
                    {REFERENCE_OPTIONS.map((option) => {
                        const active = reference === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={disabled}
                                className={cn(
                                    "h-8 rounded-sm px-2.5 text-sm disabled:pointer-events-none disabled:opacity-50",
                                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                                )}
                                onClick={() => onChange(option.id)}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <Collapsible>
                <CollapsibleTrigger className="w-fit text-sm text-muted-foreground underline decoration-dotted underline-offset-4">
                    Описание
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <p className="pt-2 text-sm text-muted-foreground">{selected.annotation}</p>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function SettingRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span>{label}</span>
            <span className="font-medium tabular-nums">{value ?? "—"}</span>
        </div>
    );
}

function AlgorithmWeights({
    title,
    weights,
    editable,
    weightFlush,
    onChange,
}: {
    title: string;
    weights: WeightDraft;
    editable: boolean;
    weightFlush: { current: (() => void) | null };
    onChange: (weights: WeightDraft) => void;
}) {
    const [salesDraft, setSalesDraft] = useState(String(weights.salesShareWeight));
    const [priceDraft, setPriceDraft] = useState(String(weights.priceShareWeight));
    const [salesIssue, setSalesIssue] = useState<string | null>(null);
    const [priceIssue, setPriceIssue] = useState<string | null>(null);
    const salesRef = useRef(salesDraft);
    const priceRef = useRef(priceDraft);
    const salesFocused = useRef(false);
    const priceFocused = useRef(false);

    useEffect(() => {
        if (!salesFocused.current) {
            salesRef.current = String(weights.salesShareWeight);
            setSalesDraft(salesRef.current);
            setSalesIssue(null);
        }
        if (!priceFocused.current) {
            priceRef.current = String(weights.priceShareWeight);
            setPriceDraft(priceRef.current);
            setPriceIssue(null);
        }
    }, [weights.priceShareWeight, weights.salesShareWeight]);

    function commit(kind: "sales" | "price", raw: string) {
        const issue = weightIssue(raw, true);
        if (kind === "sales") {
            setSalesIssue(issue);
        } else {
            setPriceIssue(issue);
        }
        if (issue) {
            return;
        }
        const parsed = Number(raw.trim());
        onChange(kind === "sales"
            ? { salesShareWeight: parsed, priceShareWeight: 100 - parsed }
            : { salesShareWeight: 100 - parsed, priceShareWeight: parsed });
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{title}</p>
            <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center justify-between gap-3 text-primary">
                    <span>Вес количества продаж</span>
                    <span className="flex items-center gap-1.5">
                        <Input
                            value={salesDraft}
                            disabled={!editable}
                            inputMode="numeric"
                            aria-label="Вес количества продаж"
                            aria-invalid={salesIssue !== null}
                            aria-describedby={salesIssue ? "weight-input-issue" : undefined}
                            className="h-7 w-14 px-1 text-right text-xs tabular-nums"
                            onKeyDown={blurOnEnter}
                            onFocus={() => {
                                salesFocused.current = true;
                                weightFlush.current = () => {
                                    salesFocused.current = false;
                                    commit("sales", salesRef.current);
                                };
                            }}
                            onBlur={() => {
                                salesFocused.current = false;
                                commit("sales", salesRef.current);
                                weightFlush.current = null;
                            }}
                            onChange={(event) => {
                                salesRef.current = event.target.value;
                                setSalesDraft(event.target.value);
                                setSalesIssue(weightIssue(event.target.value, false));
                            }}
                        />
                        <span>%</span>
                    </span>
                </label>
                <label className="flex items-center justify-between gap-3 text-sky-700 dark:text-sky-400">
                    <span>Вес средней стоимости</span>
                    <span className="flex items-center gap-1.5">
                        <Input
                            value={priceDraft}
                            disabled={!editable}
                            inputMode="numeric"
                            aria-label="Вес средней стоимости"
                            aria-invalid={priceIssue !== null}
                            aria-describedby={priceIssue ? "weight-input-issue" : undefined}
                            className="h-7 w-14 px-1 text-right text-xs tabular-nums"
                            onKeyDown={blurOnEnter}
                            onFocus={() => {
                                priceFocused.current = true;
                                weightFlush.current = () => {
                                    priceFocused.current = false;
                                    commit("price", priceRef.current);
                                };
                            }}
                            onBlur={() => {
                                priceFocused.current = false;
                                commit("price", priceRef.current);
                                weightFlush.current = null;
                            }}
                            onChange={(event) => {
                                priceRef.current = event.target.value;
                                setPriceDraft(event.target.value);
                                setPriceIssue(weightIssue(event.target.value, false));
                            }}
                        />
                        <span>%</span>
                    </span>
                </label>
            </div>
            {salesIssue || priceIssue ? (
                <p id="weight-input-issue" className="text-xs text-destructive">{salesIssue ?? priceIssue}</p>
            ) : null}
            <div className="flex h-1.5 overflow-hidden rounded-full" aria-hidden>
                <div className="bg-primary" style={{ width: `${weights.salesShareWeight}%` }} />
                <div className="bg-sky-600" style={{ width: `${weights.priceShareWeight}%` }} />
            </div>
        </div>
    );
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
        return;
    }
    event.preventDefault();
    event.currentTarget.blur();
}

function weightIssue(raw: string, emptyIsError: boolean): string | null {
    const trimmed = raw.trim();
    if (trimmed === "") {
        return emptyIsError ? "Введите целое число от 0 до 100" : null;
    }
    if (!/^\d+$/.test(trimmed) || Number(trimmed) > 100) {
        return "Введите целое число от 0 до 100";
    }
    return null;
}

function TariffHelp({ cutoffDay, axis }: { cutoffDay: number | null; axis: TariffAxis | null }) {
    const axisText = axis === "category"
        ? "Расчёт ведётся по категориям товара."
        : axis === "product_kind"
            ? "Расчёт ведётся по видам изделия."
            : null;
    return (
        <div className="flex flex-col gap-3">
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Редактирование</h3>
                <p className="text-muted-foreground">
                    Редактирование тарифов доступно в текущем месяце
                    {cutoffDay === null ? " и в предыдущем — до дня отсечки включительно." : ` и в предыдущем — до ${cutoffDay}-го числа включительно.`}
                    {" "}Более ранние месяцы закрыты.
                </p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Автоматический расчёт</h3>
                <p className="text-muted-foreground">Тариф за количество складывается из тарифа за цену и тарифа за долю. Тариф за долю выше при меньшем количестве продаж. Тариф от цены выражает эту сумму в процентах от средней стоимости. Тарифы интернет-магазина и безналичной оплаты равны тарифу за количество.</p>
            </section>
            {axisText ? (
                <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                    <h3 className="text-sm font-medium">Вид расчёта</h3>
                    <p className="text-muted-foreground">{axisText}</p>
                </section>
            ) : null}
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Опора расчёта</h3>
                <p className="text-muted-foreground">По умолчанию применяется среднее. Выбор опоры доступен администратору и территории, которой это разрешено в настройках алгоритма. Иные варианты пересчитывают автоматические ставки на экране и при сохранении тарифов не записываются.</p>
                {REFERENCE_OPTIONS.map((option) => (
                    <div key={option.id} className="flex flex-col gap-1">
                        <h4 className="text-sm font-medium">{option.label}</h4>
                        <p className="text-muted-foreground">{option.annotation}</p>
                    </div>
                ))}
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Веса</h3>
                <p className="text-muted-foreground">Вес количества продаж и вес средней стоимости в сумме составляют 100. Если изменение веса разрешено, оно сохраняется для территории и используется при следующих расчётах.</p>
            </section>
            <section className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                <h3 className="text-sm font-medium">Сохранение</h3>
                <p className="text-muted-foreground">Кнопка «Сохранить» записывает тарифы выбранного месяца. «Отменить» возвращает последние сохранённые значения.</p>
            </section>
        </div>
    );
}

function weightDraft(weights: TariffExceptionWeights | null): WeightDraft | null {
    if (!weights) {
        return null;
    }
    return { salesShareWeight: weights.salesShareWeight, priceShareWeight: weights.priceShareWeight };
}

function weightKey(weights: WeightDraft | null): string {
    return weights ? `${weights.salesShareWeight}:${weights.priceShareWeight}` : "";
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

function periodHint(page: TariffExceptionPage, loading: boolean): { text: string; tone: PeriodHintTone } {
    if (loading) {
        return { tone: "loading", text: "Загрузка периода…" };
    }
    if (page.stats.length === 0 && page.period.slice(0, 7) !== page.editPolicy.currentMonth) {
        return { tone: "past", text: "За этот период данных нет." };
    }
    if (!page.connection?.axis) {
        return { tone: "past", text: "Нет вида расчета у подключённой версии продаж." };
    }
    if (!page.editable) {
        return { tone: "closed", text: `${closedPeriodMessage(page.editPolicy)} Показаны действующие исключения.` };
    }
    if (page.period.slice(0, 7) > page.editPolicy.currentMonth) {
        return { tone: "future", text: `Тарифы будут действовать с ${formatMonth(page.period)}.` };
    }
    return { tone: "current", text: "Этот месяц открыт для редактирования тарифов." };
}
