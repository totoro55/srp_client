"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChevronRight, CircleHelp, Maximize2 } from "lucide-react";
import { FormAlert } from "@/components/form-alert";
import { AnalyticsSkeleton } from "@/components/loading-state";
import { HelpDrawer } from "@/components/help-drawer";
import { PinnedTable } from "@/components/pinned-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tariffAxisTitle, type TariffAxis } from "@/lib/baskets";
import { applyPremiumView, DEFAULT_PREMIUM_VIEW, isPremiumGroupLevel, isPremiumMonthCount, PREMIUM_GROUP_LEVELS, PREMIUM_MONTH_CHOICES, PREMIUM_BAR_LIMIT, PREMIUM_PIE_LIMIT, premiumGroupTitle, premiumShareSlices, premiumSpanTitle, STAT_WINDOW_MONTHS, type PremiumGroupLevel, type PremiumMonthCount, type PremiumShareSlice, type PremiumView, type TariffPremiumPage, type TariffPremiumRow } from "@/lib/tariff-premium";
import { ApiResponse } from "@/types/api";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { formatMonth } from "../../../_components/model";

type SortKey = "title" | "parent" | "avgPrice" | "monthlyQuantity" | "mode" | "rate" | "premium" | "share";
type Sort = { key: SortKey; direction: "asc" | "desc" };

const moneyFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export function TariffPremium() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const [page, setPage] = useState<TariffPremiumPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [view, setView] = useState<PremiumView>(DEFAULT_PREMIUM_VIEW);

    const load = useCallback(async (period?: string) => {
        setLoading(true);
        setError(null);
        const chosen = period ?? requestedPeriod;
        const suffix = chosen ? `?period=${encodeURIComponent(chosen)}` : "";
        try {
            const response = await fetch(`/api/rrs/cards/${territoryUuid}/tariff-premium${suffix}`);
            const json = (await response.json()) as ApiResponse<TariffPremiumPage>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setPage(json.data);
            setFilter("");
        } catch {
            setError("Не удалось загрузить аналитику премии");
        } finally {
            setLoading(false);
        }
    }, [requestedPeriod, territoryUuid]);

    useEffect(() => {
        void load();
    }, [load]);

    const viewed = useMemo(
        () => page ? applyPremiumView(page.rows, view) : null,
        [page, view],
    );
    const hint = page ? periodHint(page, loading, view.months) : null;

    return (
        <div className="flex flex-col gap-4">
            <RrsSectionNav
                territoryUuid={territoryUuid}
                territoryName={page?.territory.name}
                active="premium"
                period={page?.period}
                cardPeriod={page ? connectionCardPeriod(page.period, page.savedPeriods) : null}
                controls={page && hint ? (
                    <>
                        <RrsPeriodControls
                            period={page.period}
                            appliedPeriod={page.appliedPeriod}
                            savedPeriods={page.savedPeriods.map((period) => ({ period }))}
                            disabled={loading}
                            hint={hint}
                            onPeriodChange={(period) => {
                                router.replace(`/rrs/${territoryUuid}/premium?period=${period}`);
                                void load(period);
                            }}
                        />
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <HelpDrawer title="Аналитика премии">
                                <PremiumHelp />
                            </HelpDrawer>
                        </div>
                    </>
                ) : null}
            />
            <FormAlert message={error} />
            {loading && !page ? <AnalyticsSkeleton /> : null}
            {page ? (
                <section className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        {page.axis ? tariffAxisTitle(page.axis) : "Вид расчёта у подключённой версии продаж не задан."}
                    </p>
                    {page.axis && viewed ? (
                        <PremiumSettings axis={page.axis} view={view} onChange={setView} />
                    ) : null}
                    {viewed ? <PoolSummary viewed={viewed} months={view.months} /> : null}
                    {page.axis && viewed ? <ShareChart rows={viewed.rows} pool={viewed.pool} axis={page.axis} level={view.level} /> : null}
                    {page.axis && viewed ? (
                        <PremiumTable
                            key={view.level}
                            rows={viewed.rows}
                            pool={viewed.pool}
                            months={view.months}
                            excluded={viewed.excluded}
                            filter={filter}
                            onFilter={setFilter}
                        />
                    ) : null}
                </section>
            ) : null}
        </div>
    );
}

function PoolSummary({ viewed, months }: { viewed: { pool: number | null; counted: number; withoutTariff: number; excluded: number }; months: PremiumMonthCount }) {
    const span = premiumSpanTitle(months);
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCell label={`Пул премии за ${span}`} value={viewed.pool === null ? "—" : `${moneyFormat.format(viewed.pool)} ₽`} />
            <SummaryCell label="Строк в пуле" value={String(viewed.counted)} />
            <SummaryCell label="Без сохранённого тарифа" value={String(viewed.withoutTariff)} />
            <SummaryCell label="Скрыто по порогу" value={String(viewed.excluded)} />
        </div>
    );
}

function PremiumSettings({
    axis,
    view,
    onChange,
}: {
    axis: TariffAxis;
    view: PremiumView;
    onChange: (view: PremiumView) => void;
}) {
    return (
        <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-1.5">
                <FieldLabel htmlFor="premium-group">Группировка</FieldLabel>
                <Select
                    value={view.level}
                    onValueChange={(value) => {
                        if (isPremiumGroupLevel(value)) {
                            onChange({ ...view, level: value });
                        }
                    }}
                >
                    <SelectTrigger id="premium-group" className="w-full">
                        <SelectValue>
                            {(value) => <GroupChoice level={isPremiumGroupLevel(value) ? value : view.level} axis={axis} />}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {PREMIUM_GROUP_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                                <GroupChoice level={level} axis={axis} detail={groupParentLabel(level)} />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
                <FieldLabel htmlFor="premium-months" hint={`Выгрузка собрана за ${STAT_WINDOW_MONTHS} месяца. Здесь берётся доля этого количества.`}>
                    Месяцев в расчёте
                </FieldLabel>
                <Select
                    value={String(view.months)}
                    onValueChange={(value) => {
                        const months = Number(value);
                        if (isPremiumMonthCount(months)) {
                            onChange({ ...view, months });
                        }
                    }}
                >
                    <SelectTrigger id="premium-months" className="w-full">
                        <SelectValue>
                            {(value) => {
                                const months = Number(value);
                                return isPremiumMonthCount(months) ? premiumSpanTitle(months) : premiumSpanTitle(view.months);
                            }}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {PREMIUM_MONTH_CHOICES.map((months) => (
                            <SelectItem key={months} value={String(months)}>{premiumSpanTitle(months)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <MinQuantityField
                value={view.minQuantity}
                onChange={(minQuantity) => onChange({ ...view, minQuantity })}
            />
        </div>
    );
}

function MinQuantityField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
    const [draft, setDraft] = useState(value === 0 ? "" : String(value));
    useEffect(() => setDraft(value === 0 ? "" : String(value)), [value]);
    function commit(raw: string) {
        const normalized = raw.trim().replace(",", ".");
        if (normalized === "") {
            onChange(0);
            return;
        }
        const next = Number(normalized);
        if (!Number.isFinite(next) || next < 0) {
            setDraft(value === 0 ? "" : String(value));
            return;
        }
        onChange(next);
    }
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <FieldLabel htmlFor="premium-min-quantity" hint="Строки с меньшим числом штук за выбранные месяцы не входят в пул и диаграммы.">
                Минимум штук
            </FieldLabel>
            <Input
                id="premium-min-quantity"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => commit(draft)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        commit(draft);
                        event.currentTarget.blur();
                    }
                }}
            />
        </div>
    );
}

function FieldLabel({ htmlFor, hint, children }: { htmlFor: string; hint?: string; children: string }) {
    return (
        <span className="flex min-w-0 items-center gap-1">
            <Label htmlFor={htmlFor}>{children}</Label>
            {hint ? <HintIcon hint={hint} /> : null}
        </span>
    );
}

function HintIcon({ hint }: { hint: string }) {
    return (
        <Tooltip>
            <TooltipTrigger render={<button type="button" className="text-muted-foreground" aria-label={hint} />}>
                <CircleHelp className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
    );
}

function groupParentLabel(level: PremiumGroupLevel): string | null {
    if (level === "near") {
        return "Родитель 1";
    }
    if (level === "mid") {
        return "Родитель 2";
    }
    if (level === "top") {
        return "Родитель 3";
    }
    return null;
}

function GroupChoice({ level, axis, detail }: { level: PremiumGroupLevel; axis: TariffAxis; detail?: string | null }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <GroupMark level={level} />
            <span className="flex min-w-0 flex-col">
                <span className="truncate">{premiumGroupTitle(level, axis)}</span>
                {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
            </span>
        </span>
    );
}

function GroupMark({ level }: { level: PremiumGroupLevel }) {
    if (level === "item") {
        return <Boxes className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
    }
    const number = level === "near" ? "1" : level === "mid" ? "2" : "3";
    return (
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true">
            <path
                fill="currentColor"
                d="M2.2 4.8h11.6v7.4a1.2 1.2 0 0 1-1.2 1.2H3.4a1.2 1.2 0 0 1-1.2-1.2V4.8Z"
                opacity="0.18"
            />
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                d="M2.2 5.1V4.1a1 1 0 0 1 1-1h2.15l1.05 1.15h6.4a1 1 0 0 1 1 1v7.15a1.2 1.2 0 0 1-1.2 1.2H3.4a1.2 1.2 0 0 1-1.2-1.2V5.1Z"
            />
            <text x="8" y="11.4" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="currentColor">{number}</text>
        </svg>
    );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-medium tabular-nums">{value}</p>
        </div>
    );
}

function ShareChart({ rows, pool, axis, level }: { rows: TariffPremiumRow[]; pool: number | null; axis: TariffAxis; level: PremiumGroupLevel }) {
    const [barLimit, setBarLimit] = useState(PREMIUM_BAR_LIMIT);
    const [pieLimit, setPieLimit] = useState(PREMIUM_PIE_LIMIT);
    const grouped = level !== "item";
    const otherTitle = grouped ? "Остальные папки" : axis === "product_kind" ? "Остальные изделия" : "Остальные категории";
    const unit = grouped ? "папок" : axis === "product_kind" ? "изделий" : "категорий";
    const topTitle = `Топ-${barLimit} ${unit}`;
    const pieTitle = `Первые ${pieLimit} ${unit}`;
    const leaders = useMemo(() => premiumShareSlices(rows, pool, barLimit), [rows, pool, barLimit]);
    const pieSlices = useMemo(() => premiumShareSlices(rows, pool, pieLimit, otherTitle), [rows, pool, pieLimit, otherTitle]);
    if (leaders.length === 0) {
        return null;
    }
    const widest = leaders[0]?.share ?? 0;
    return (
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <ChartFrame
                title={topTitle}
                ariaLabel={topTitle}
                limit={barLimit}
                limitLabel={`Сколько ${unit} в топе`}
                onLimit={setBarLimit}
                render={() => (
                    <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                        {leaders.map((slice) => (
                            <li key={slice.key}>
                                <div className="flex items-baseline justify-between gap-3 text-sm">
                                    <span className="min-w-0 truncate" title={slice.title}>{slice.title}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                        {`${percentFormat.format(slice.share * 100)}% · ${moneyFormat.format(slice.premium)} ₽`}
                                    </span>
                                </div>
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${slice.title}: ${percentFormat.format(slice.share * 100)}%`}>
                                    <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${widest > 0 ? (slice.share / widest) * 100 : 0}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            />
            <ChartFrame
                title={pieTitle}
                ariaLabel="Круговая диаграмма долей"
                limit={pieLimit}
                limitLabel={`Сколько ${unit} на круговой диаграмме`}
                onLimit={setPieLimit}
                caption={`Дальше строки собраны в «${otherTitle}».`}
                render={(expanded) => <PieBody slices={pieSlices} expanded={expanded} />}
            />
        </div>
    );
}

function ChartFrame({
    title,
    ariaLabel,
    limit,
    limitLabel,
    onLimit,
    caption,
    render,
}: {
    title: string;
    ariaLabel: string;
    limit: number;
    limitLabel: string;
    onLimit: (value: number) => void;
    caption?: string;
    render: (expanded: boolean) => ReactNode;
}) {
    return (
        <section className="flex h-[32rem] flex-col overflow-hidden rounded-lg border bg-card p-4" aria-label={ariaLabel}>
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-1 text-sm font-medium">
                    <span className="truncate">{title}</span>
                    {caption ? <HintIcon hint={caption} /> : null}
                </h2>
                <div className="flex shrink-0 items-center gap-1">
                    <LimitField value={limit} label={limitLabel} onChange={onLimit} />
                    <ExpandChart title={title} caption={caption} limit={limit} limitLabel={limitLabel} onLimit={onLimit}>
                        {render(true)}
                    </ExpandChart>
                </div>
            </div>
            {render(false)}
        </section>
    );
}

function ExpandChart({
    title,
    caption,
    limit,
    limitLabel,
    onLimit,
    children,
}: {
    title: string;
    caption?: string;
    limit: number;
    limitLabel: string;
    onLimit: (value: number) => void;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Развернуть «${title}»`} />}
            >
                <Maximize2 />
            </DialogTrigger>
            <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none flex-col gap-4 overflow-hidden sm:max-w-none">
                <div className="flex items-start justify-between gap-3 pr-8">
                    <DialogHeader className="min-w-0">
                        <DialogTitle className="flex min-w-0 items-center gap-1">
                            <span className="truncate">{title}</span>
                            {caption ? <HintIcon hint={caption} /> : null}
                        </DialogTitle>
                    </DialogHeader>
                    <LimitField value={limit} label={limitLabel} onChange={onLimit} />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {open ? children : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function LimitField({ value, label, onChange }: { value: number; label: string; onChange: (value: number) => void }) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    function commit(raw: string) {
        const next = Number(raw);
        if (!Number.isInteger(next) || next < 1 || next > 200) {
            setDraft(String(value));
            return;
        }
        onChange(next);
    }
    return (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Показать</span>
            <Input
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                aria-label={label}
                value={draft}
                className="h-8 w-16 px-2"
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => commit(draft)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        commit(draft);
                        event.currentTarget.blur();
                    }
                }}
            />
        </label>
    );
}

function PieBody({ slices, expanded }: { slices: PremiumShareSlice[]; expanded: boolean }) {
    const paths = piePaths(slices);
    return (
        <div className={expanded
            ? "flex min-h-0 flex-1 flex-col items-center gap-6 overflow-hidden md:flex-row md:items-center"
            : "mt-4 flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto sm:flex-row sm:items-start"}>
            <svg
                viewBox="-1.05 -1.05 2.1 2.1"
                className={expanded ? "aspect-square w-[min(100%,70dvh,36rem)] max-w-full shrink-0" : "size-56 shrink-0"}
                role="img"
                aria-label="Круговая диаграмма доли пула"
            >
                {paths.map((slice) => (
                    <path key={slice.key} d={slice.d} fill={slice.color} stroke={expanded ? "var(--popover)" : "var(--card)"} strokeWidth="0.015">
                        <title>{`${slice.title}: ${percentFormat.format(slice.share * 100)}%`}</title>
                    </path>
                ))}
            </svg>
            <ul className={expanded ? "min-h-0 w-full flex-1 overflow-y-auto md:columns-2" : "min-w-0 flex-1"}>
                {paths.map((slice) => (
                    <li key={slice.key} className="flex items-center gap-2 break-inside-avoid py-0.5 text-sm">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                        <span className="min-w-0 flex-1 truncate" title={slice.title}>
                            {slice.title}
                            {slice.grouped ? <span className="text-muted-foreground">{` · ${slice.count}`}</span> : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{`${percentFormat.format(slice.share * 100)}%`}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function piePaths(slices: PremiumShareSlice[]): Array<PremiumShareSlice & { d: string; color: string }> {
    const total = slices.reduce((sum, slice) => sum + slice.share, 0);
    let angle = -Math.PI / 2;
    let colorIndex = 0;
    return slices.map((slice) => {
        const sweep = total > 0 ? (slice.share / total) * Math.PI * 2 : 0;
        const start = angle;
        const end = angle + sweep;
        angle = end;
        const color = slice.grouped ? "var(--muted-foreground)" : pieColor(colorIndex);
        if (!slice.grouped) {
            colorIndex += 1;
        }
        return { ...slice, d: pieSlice(start, end), color };
    });
}

function pieSlice(start: number, end: number): string {
    const radius = 1;
    if (end - start >= Math.PI * 2 - 0.0001) {
        return `M ${radius} 0 A ${radius} ${radius} 0 1 1 ${-radius} 0 A ${radius} ${radius} 0 1 1 ${radius} 0 Z`;
    }
    const large = end - start > Math.PI ? 1 : 0;
    const sx = Math.cos(start) * radius;
    const sy = Math.sin(start) * radius;
    const ex = Math.cos(end) * radius;
    const ey = Math.sin(end) * radius;
    return `M 0 0 L ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey} Z`;
}

function pieColor(index: number): string {
    const hue = Math.round((index * 137.508) % 360);
    const lightness = index % 2 === 0 ? 42 : 58;
    return `hsl(${hue} 74% ${lightness}%)`;
}

function PremiumTable({
    rows,
    pool,
    months,
    excluded,
    filter,
    onFilter,
}: {
    rows: TariffPremiumRow[];
    pool: number | null;
    months: PremiumMonthCount;
    excluded: number;
    filter: string;
    onFilter: (value: string) => void;
}) {
    const [sort, setSort] = useState<Sort>({ key: "premium", direction: "desc" });
    const [openCodes, setOpenCodes] = useState<Set<string>>(() => new Set());
    const needle = filter.trim().toLowerCase();
    const visible = useMemo(() => {
        const filtered = needle
            ? rows.filter((row) => rowMatches(row, needle))
            : rows;
        return filtered.slice().sort((left, right) => compareRows(left, right, sort, pool));
    }, [rows, needle, sort, pool]);
    function toggleRow(code: string) {
        setOpenCodes((current) => {
            const next = new Set(current);
            if (next.has(code)) {
                next.delete(code);
            } else {
                next.add(code);
            }
            return next;
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                    <span className="text-muted-foreground">Найти</span>
                    <Input value={filter} placeholder="Название или папка" onChange={(event) => onFilter(event.target.value)} />
                </label>
                <p className="text-sm text-muted-foreground">{visible.length} из {rows.length}</p>
            </div>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {excluded > 0
                        ? "Все строки скрыты порогом штук."
                        : "За этот месяц статистики продаж по выбранному виду расчёта нет."}
                </p>
            ) : (
                <PinnedTable
                    minWidthClass="min-w-[980px]"
                    columns={() => (
                        <colgroup>
                            <col />
                            <col />
                            <col className="w-[8rem]" />
                            <col className="w-[7rem]" />
                            <col className="w-[8rem]" />
                            <col className="w-[6.5rem]" />
                            <col className="w-[8.5rem]" />
                            <col className="w-[5.5rem]" />
                        </colgroup>
                    )}
                    head={(
                        <tr>
                            <SortHeader label="Название" column="title" sort={sort} onSort={setSort} />
                            <SortHeader label="Папка" column="parent" sort={sort} onSort={setSort} />
                            <SortHeader label="Средняя стоимость" column="avgPrice" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label={`Штук за ${premiumSpanTitle(months)}`} column="monthlyQuantity" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label="Вид тарифа" column="mode" sort={sort} onSort={setSort} />
                            <SortHeader label="Тариф" column="rate" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label={`Премия за ${premiumSpanTitle(months)}`} column="premium" sort={sort} onSort={setSort} align="right" />
                            <SortHeader label="Доля пула" column="share" sort={sort} onSort={setSort} align="right" />
                        </tr>
                    )}
                >
                    {visible.map((row) => {
                        const details = row.children ?? [];
                        const searchOpens = needle !== "" && !textMatches(row, needle) && details.some((child) => textMatches(child, needle));
                        const open = details.length > 0 && (openCodes.has(row.code) || searchOpens);
                        return (
                            <Fragment key={row.code}>
                                <PremiumRow row={row} pool={pool} open={open} onToggle={details.length > 0 ? () => toggleRow(row.code) : undefined} />
                                {open ? details.map((child) => (
                                    <PremiumRow key={child.code} row={child} pool={pool} nested />
                                )) : null}
                            </Fragment>
                        );
                    })}
                </PinnedTable>
            )}
        </div>
    );
}

function PremiumRow({
    row,
    pool,
    nested = false,
    open = false,
    onToggle,
}: {
    row: TariffPremiumRow;
    pool: number | null;
    nested?: boolean;
    open?: boolean;
    onToggle?: () => void;
}) {
    return (
        <tr className={nested ? "bg-muted/40 align-top" : "align-top"}>
            <td className="border border-border px-2 py-1.5 font-medium break-words">
                <div className={`flex items-start gap-1 ${nested ? "pl-6" : ""}`}>
                    {onToggle ? (
                        <button
                            type="button"
                            className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-expanded={open}
                            aria-label={open ? `Свернуть «${row.title}»` : `Развернуть «${row.title}»`}
                            onClick={onToggle}
                        >
                            <ChevronRight className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} />
                        </button>
                    ) : null}
                    <span className="min-w-0">{row.title}</span>
                </div>
            </td>
            <td className="border border-border px-2 py-1.5 break-words text-muted-foreground">{row.parent ?? "—"}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{quantityFormat.format(row.avgPrice)}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{quantityFormat.format(row.monthlyQuantity)}</td>
            <td className="border border-border px-2 py-1.5">{modeTitle(row)}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{formatRate(row)}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{row.premium === null ? "—" : moneyFormat.format(row.premium)}</td>
            <td className="border border-border px-2 py-1.5 text-right tabular-nums">{formatShare(row.premium, pool)}</td>
        </tr>
    );
}

function textMatches(row: Pick<TariffPremiumRow, "title" | "parent">, needle: string): boolean {
    return row.title.toLowerCase().includes(needle) || (row.parent ?? "").toLowerCase().includes(needle);
}

function rowMatches(row: TariffPremiumRow, needle: string): boolean {
    return textMatches(row, needle) || (row.children?.some((child) => textMatches(child, needle)) ?? false);
}

function SortHeader({
    label,
    column,
    sort,
    onSort,
    align = "left",
}: {
    label: string;
    column: SortKey;
    sort: Sort;
    onSort: (sort: Sort) => void;
    align?: "left" | "right";
}) {
    const active = sort.key === column;
    const alignClass = align === "right" ? "text-right" : "text-left";
    return (
        <th className={`relative border border-border bg-muted px-1.5 py-1.5 font-medium ${alignClass}`} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
            <button
                type="button"
                className={`flex w-full items-center gap-0.5 hover:text-foreground ${align === "right" ? "justify-end" : "justify-start"}`}
                onClick={() => onSort(active
                    ? { key: column, direction: sort.direction === "asc" ? "desc" : "asc" }
                    : { key: column, direction: column === "title" || column === "parent" || column === "mode" ? "asc" : "desc" })}
            >
                <span className="min-w-0 whitespace-normal break-words leading-tight">{label}</span>
            </button>
            {active ? <span className="pointer-events-none absolute top-0.5 right-0.5 text-[10px]" aria-hidden="true">{sort.direction === "asc" ? "↑" : "↓"}</span> : null}
        </th>
    );
}

function PremiumHelp() {
    return (
        <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Окно статистики</h3>
                <p className="text-muted-foreground">Количество в выгрузке собрано за {STAT_WINDOW_MONTHS} месяца. Средняя стоимость уже является средней ценой штуки и на число месяцев не делится. Поле «Месяцев в расчёте» берёт долю этого количества: один месяц — треть, два месяца — две трети, три месяца — всё число штук.</p>
            </section>
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Группировка и порог</h3>
                <p className="text-muted-foreground">По умолчанию строка — категория или изделие подключённой версии. «По папке» собирает строки в их папку, «По папке выше» — в папку над ней, «По корневой папке» — в верхнюю папку справочника. Премия папки — сумма премий её строк. Средняя стоимость папки взвешена по штукам. Строку папки в таблице можно развернуть и увидеть, какие категории или изделия в неё вошли. «Минимум штук» убирает строки, у которых штук за выбранные месяцы меньше порога. Такие строки не входят в пул. Пустой порог ничего не скрывает.</p>
            </section>
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Тариф</h3>
                <p className="text-muted-foreground">Используется сохранённая ставка выбранного месяца. Опора, применённая при расчёте тарифа, на этом экране не пересчитывается. Канал продаж не учитывается: в расчёт входит ставка выбранного вида тарифа. При тарифе за количество премия равна ставке в рублях, умноженной на количество за выбранные месяцы. При тарифе от цены премия равна произведению доли ставки и средней стоимости на это количество. Строка без сохранённого тарифа в пул не входит. Если в папке ставки различаются, вид тарифа отображается как «Разные».</p>
            </section>
            <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Пул</h3>
                <p className="text-muted-foreground">Пул — сумма премий за выбранные месяцы по строкам с сохранённым тарифом. Доля строки считается от этого пула. Число строк на каждой диаграмме задаётся полем «Показать». Остальные на круговой собраны в одну долю.</p>
            </section>
        </div>
    );
}

function periodHint(page: TariffPremiumPage, loading: boolean, months: PremiumMonthCount): { text: string; tone: PeriodHintTone } {
    if (loading) {
        return { tone: "loading", text: "Загрузка периода…" };
    }
    if (!page.axis) {
        return { tone: "past", text: "Нет вида расчёта у подключённой версии продаж." };
    }
    if (page.rows.length === 0) {
        return { tone: "past", text: "За этот период статистики нет." };
    }
    if (page.pool === null) {
        return { tone: "closed", text: "Тарифы этого месяца ещё не сохранены. Пул не посчитан." };
    }
    if (page.period.slice(0, 7) > page.editPolicy.currentMonth) {
        return { tone: "future", text: `Показана премия по тарифам с ${formatMonth(page.period)}.` };
    }
    return { tone: "current", text: `Премия посчитана по сохранённым тарифам за ${premiumSpanTitle(months)}.` };
}

function modeTitle(row: Pick<TariffPremiumRow, "baseMode" | "mixedTariff">): string {
    if (row.mixedTariff) {
        return "Разные";
    }
    if (row.baseMode === "percent") {
        return "От цены";
    }
    if (row.baseMode === "per_unit") {
        return "За количество";
    }
    return "—";
}

function formatRate(row: TariffPremiumRow): string {
    if (row.rate === null || row.baseMode === null) {
        return "—";
    }
    if (row.baseMode === "percent") {
        return `${percentFormat.format(Math.round(row.rate * 10_000) / 100)}%`;
    }
    return quantityFormat.format(row.rate);
}

function formatShare(premium: number | null, pool: number | null): string {
    if (premium === null || pool === null || pool === 0) {
        return "—";
    }
    return `${percentFormat.format(premium / pool * 100)}%`;
}

function compareRows(left: TariffPremiumRow, right: TariffPremiumRow, sort: Sort, pool: number | null): number {
    const factor = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "title" || sort.key === "parent") {
        const leftText = (sort.key === "parent" ? left.parent : left.title) ?? "";
        const rightText = (sort.key === "parent" ? right.parent : right.title) ?? "";
        const difference = leftText.localeCompare(rightText, "ru");
        return difference === 0 ? left.title.localeCompare(right.title, "ru") : difference * factor;
    }
    if (sort.key === "mode") {
        const difference = modeTitle(left).localeCompare(modeTitle(right), "ru");
        return difference === 0 ? left.title.localeCompare(right.title, "ru") : difference * factor;
    }
    const leftNumber = sortNumber(left, sort.key, pool);
    const rightNumber = sortNumber(right, sort.key, pool);
    if (leftNumber === null && rightNumber === null) {
        return left.title.localeCompare(right.title, "ru");
    }
    if (leftNumber === null) {
        return 1;
    }
    if (rightNumber === null) {
        return -1;
    }
    return leftNumber === rightNumber ? left.title.localeCompare(right.title, "ru") : (leftNumber - rightNumber) * factor;
}

function sortNumber(row: TariffPremiumRow, key: SortKey, pool: number | null): number | null {
    if (key === "avgPrice") {
        return row.avgPrice;
    }
    if (key === "monthlyQuantity") {
        return row.monthlyQuantity;
    }
    if (key === "rate") {
        return row.rate;
    }
    if (key === "premium") {
        return row.premium;
    }
    if (key === "share") {
        return row.premium === null || pool === null || pool === 0 ? null : row.premium / pool;
    }
    return null;
}
