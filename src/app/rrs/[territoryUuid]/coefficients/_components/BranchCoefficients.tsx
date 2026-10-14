"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownFromLine, History, MousePointerClick, RotateCcw, Save, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/app/admin/_components/ConfirmDialog";
import { HelpDrawer } from "@/components/help-drawer";
import { FormAlert } from "@/components/form-alert";
import { coefficientRangeLabel, coefficientValueIssue } from "@/lib/coefficient-value";
import { closedPeriodMessage } from "@/lib/rrs-edit-window";
import { notifySuccess } from "@/lib/notify";
import type { RrsCoefficientPage } from "@/lib/rrs";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { PeriodChangeHistory } from "../../../_components/PeriodChangeHistory";
import { RrsPeriodControls, type PeriodHintTone } from "../../../_components/RrsPeriodControls";
import { connectionCardPeriod, RrsSectionNav } from "../../../_components/RrsSectionNav";
import { formatMonth } from "../../../_components/model";

const COLUMN_GROUPS = [
    {
        head: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
        cell: "bg-sky-50 dark:bg-sky-950/50",
    },
    {
        head: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
        cell: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
        head: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
        cell: "bg-violet-50 dark:bg-violet-950/50",
    },
    {
        head: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50",
        cell: "bg-rose-50 dark:bg-rose-950/50",
    },
    {
        head: "bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-50",
        cell: "bg-teal-50 dark:bg-teal-950/50",
    },
    {
        head: "bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-50",
        cell: "bg-indigo-50 dark:bg-indigo-950/50",
    },
] as const;

const cellGrid = "border-r border-b border-foreground/30";

export function BranchCoefficients() {
    const params = useParams<{ territoryUuid: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const territoryUuid = params.territoryUuid;
    const requestedPeriod = searchParams.get("period");
    const chromeRef = useRef<HTMLDivElement>(null);
    const headerRowRef = useRef<HTMLTableRowElement>(null);
    const [page, setPage] = useState<RrsCoefficientPage | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});
    const [saved, setSaved] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);
    const [headerOffset, setHeaderOffset] = useState(0);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [confirmSave, setConfirmSave] = useState(false);
    const [hover, setHover] = useState<{ row: string | null; column: string } | null>(null);
    const [cellMenu, setCellMenu] = useState<CellMenu | null>(null);
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

    useEffect(() => {
        if (!cellMenu) {
            return;
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setCellMenu(null);
            }
        }
        function onPointer(event: PointerEvent) {
            const target = event.target;
            if (target instanceof Element && target.closest("[data-cell-menu]")) {
                return;
            }
            setCellMenu(null);
        }
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onPointer);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onPointer);
        };
    }, [cellMenu]);

    const showSave = Boolean(page && page.baskets.length > 0);
    const hint = page ? periodHint(page, loading) : null;

    useLayoutEffect(() => {
        function update() {
            const chrome = chromeRef.current;
            if (!chrome) {
                return;
            }
            const reserve = 32;
            const bottom = chrome.getBoundingClientRect().bottom;
            setTableMaxHeight(Math.max(280, window.innerHeight - bottom - reserve));
        }
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [page, error]);

    useLayoutEffect(() => {
        const row = headerRowRef.current;
        if (!row) {
            return;
        }
        const measure = () => setHeaderOffset(row.getBoundingClientRect().height);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        return () => observer.disconnect();
    }, [page, loading]);

    function collectItems(): { items: { branchUuid: string; basketId: number; key: string; value: string }[] } | { error: string } {
        if (!page) {
            return { error: "Не удалось прочитать коэффициенты" };
        }
        const items: { branchUuid: string; basketId: number; key: string; value: string }[] = [];
        for (const branch of page.branches) {
            for (const basket of page.baskets) {
                for (const coefficient of basket.coefficients) {
                    const id = fieldKey(branch.uuid, basket.id, coefficient.key);
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

    function openCellMenu(event: { preventDefault(): void; clientX: number; clientY: number }, branchUuid: string, basketId: number, coefficientKey: string) {
        if (!page?.editable || saving) {
            return;
        }
        event.preventDefault();
        setFocusedId(null);
        const width = 280;
        const height = 84;
        setCellMenu({
            x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
            y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
            branchUuid,
            basketId,
            coefficientKey,
        });
    }

    function resetCellToDefault() {
        if (!cellMenu) {
            return;
        }
        const id = fieldKey(cellMenu.branchUuid, cellMenu.basketId, cellMenu.coefficientKey);
        setValues((current) => ({ ...current, [id]: DEFAULT_COEFFICIENT }));
        setCellMenu(null);
    }

    function fillColumnFromCell() {
        if (!cellMenu || !page) {
            return;
        }
        const sourceId = fieldKey(cellMenu.branchUuid, cellMenu.basketId, cellMenu.coefficientKey);
        const value = (values[sourceId] ?? "").trim() || DEFAULT_COEFFICIENT;
        setValues((current) => {
            const next = { ...current };
            for (const branch of page.branches) {
                next[fieldKey(branch.uuid, cellMenu.basketId, cellMenu.coefficientKey)] = value;
            }
            return next;
        });
        setCellMenu(null);
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
            basketCount + basket.coefficients.filter((coefficient) => isDirty(values, saved, fieldKey(branch.uuid, basket.id, coefficient.key))).length
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
            <div ref={chromeRef} className="flex flex-col gap-4">
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
                                <div className="relative ml-auto flex shrink-0 items-center gap-2">
                                    <p className={cn("absolute right-full mr-2 whitespace-nowrap text-sm text-amber-800 dark:text-amber-200", dirtyCount === 0 && "hidden")}>
                                        Есть несохранённые значения
                                    </p>
                                    <Button type="button" size="sm" disabled={saving || loading || !page?.editable} onClick={requestSave}>
                                        <Save />
                                        Сохранить
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={saving || loading || !page?.editable || dirtyCount === 0}
                                        onClick={() => {
                                            setValues(saved);
                                            setCellMenu(null);
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
                {loading && !page ? <p className="text-sm text-muted-foreground">Загрузка филиалов...</p> : null}
            </div>
            <TabsContent value="values" className="flex flex-col gap-4">
            {page && page.baskets.length === 0 ? <p className="text-sm text-muted-foreground">У подключённых версий коэффициенты не заданы.</p> : null}
            {page && page.baskets.length > 0 && page.branches.length === 0 ? <p className="text-sm text-muted-foreground">В этом периоде нет филиалов, включённых в мотивацию.</p> : null}
            {page && page.branches.length > 0 ? (
                <div
                    className="overflow-auto rounded-lg"
                    style={tableMaxHeight === null ? undefined : { maxHeight: tableMaxHeight }}
                    onMouseLeave={() => setHover(null)}
                    onScroll={() => setCellMenu(null)}
                >
                    <Table containerClassName="overflow-visible" className="w-max border-separate border-spacing-0">
                        <TableHeader>
                            <tr ref={headerRowRef}>
                                <TableHead
                                    rowSpan={page.baskets.length === 0 ? 1 : 2}
                                    style={{ zIndex: 40 }}
                                    className={cn("sticky left-0 w-44 min-w-44 border-t border-l bg-background", cellGrid, crosshairClass(hover, null, "branch"))}
                                    onMouseEnter={() => setHover({ row: null, column: "branch" })}
                                >
                                    Филиал
                                </TableHead>
                                {page.baskets.map((basket, basketIndex) => {
                                    const group = COLUMN_GROUPS[basketIndex % COLUMN_GROUPS.length];
                                    return (
                                        <TableHead
                                            key={basket.id}
                                            colSpan={basket.coefficients.length}
                                            title={`${basket.name}. № ${basket.versionNo} ${basket.versionName}`}
                                            style={{ zIndex: 30 }}
                                            className={cn("h-auto border-t px-2 py-1.5 text-center whitespace-normal", cellGrid, group.head, crosshairClass(hover, null, `group:${basket.id}`))}
                                            onMouseEnter={() => setHover({ row: null, column: `group:${basket.id}` })}
                                        >
                                            {basket.indicatorName}
                                        </TableHead>
                                    );
                                })}
                            </tr>
                            {page.baskets.length > 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    {page.baskets.flatMap((basket, basketIndex) => basket.coefficients.map((coefficient) => {
                                        const group = COLUMN_GROUPS[basketIndex % COLUMN_GROUPS.length];
                                        return (
                                            <TableHead
                                                key={`${basket.id}:${coefficient.key}`}
                                                title={(coefficient.description ?? "").trim() ? `${(coefficient.description ?? "").trim()}. ${coefficientRangeLabel(coefficient)}` : coefficientRangeLabel(coefficient)}
                                                style={{ top: headerOffset, zIndex: 30 }}
                                                className={cn("h-auto w-20 min-w-20 px-1 py-1.5 text-center align-bottom whitespace-normal", cellGrid, group.head, crosshairClass(hover, null, columnKey(basket.id, coefficient.key)))}
                                                onMouseEnter={() => setHover({ row: null, column: columnKey(basket.id, coefficient.key) })}
                                            >
                                                <span className="block text-xs leading-snug">{coefficient.title}</span>
                                            </TableHead>
                                        );
                                    }))}
                                </TableRow>
                            ) : null}
                        </TableHeader>
                        <TableBody>
                            {page.branches.map((branch) => (
                                <TableRow key={branch.uuid} className="hover:bg-transparent">
                                    <TableCell
                                        style={{ zIndex: 10 }}
                                        className={cn("sticky left-0 w-44 min-w-44 border-l bg-background font-medium", cellGrid, crosshairClass(hover, branch.uuid, "branch"))}
                                        onMouseEnter={() => setHover({ row: branch.uuid, column: "branch" })}
                                    >
                                        {branch.name}
                                    </TableCell>
                                    {page.baskets.flatMap((basket, basketIndex) => basket.coefficients.map((coefficient) => {
                                        const id = fieldKey(branch.uuid, basket.id, coefficient.key);
                                        const value = values[id] ?? DEFAULT_COEFFICIENT;
                                        const dirty = isDirty(values, saved, id);
                                        const issue = coefficientValueIssue(value, coefficient, true);
                                        const savedSide = !dirty && !issue ? savedValueSide(saved[id] ?? DEFAULT_COEFFICIENT) : null;
                                        const group = COLUMN_GROUPS[basketIndex % COLUMN_GROUPS.length];
                                        return (
                                            <TableCell
                                                key={id}
                                                className={cn("w-20 cursor-default p-1", cellGrid, issue ? "bg-destructive/10" : dirty ? "bg-amber-100 dark:bg-amber-950" : group.cell)}
                                                style={valueCellShadow(savedSide, hover, branch.uuid, columnKey(basket.id, coefficient.key))}
                                                onMouseEnter={() => setHover({ row: branch.uuid, column: columnKey(basket.id, coefficient.key) })}
                                                onContextMenu={(event) => openCellMenu(event, branch.uuid, basket.id, coefficient.key)}
                                            >
                                                <Tooltip open={focusedId === id}>
                                                    <TooltipTrigger
                                                        render={
                                                            <input
                                                                id={id}
                                                                value={value}
                                                                inputMode={coefficient.integer ? "numeric" : "decimal"}
                                                                disabled={!page.editable || saving}
                                                                aria-label={`${branch.name}, ${basket.indicatorName}, ${coefficient.title}`}
                                                                aria-invalid={issue !== null}
                                                                className={cn(
                                                                    "h-7 w-full cursor-default bg-transparent text-center text-sm tabular-nums outline-none",
                                                                    "rounded-md focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/50",
                                                                    "disabled:cursor-not-allowed disabled:opacity-60",
                                                                    issue && "font-medium text-destructive ring-1 ring-destructive/70",
                                                                    !issue && dirty && "font-medium text-amber-950 ring-1 ring-amber-500/70 dark:text-amber-50",
                                                                    savedSide === "below" && "font-semibold text-rose-700 dark:text-rose-300",
                                                                    savedSide === "above" && "font-semibold text-sky-800 dark:text-sky-200",
                                                                )}
                                                                onKeyDown={(event) => {
                                                                    if (event.key !== "Enter") {
                                                                        return;
                                                                    }
                                                                    event.preventDefault();
                                                                    event.currentTarget.blur();
                                                                }}
                                                                onFocus={() => setFocusedId(id)}
                                                                onBlur={() => {
                                                                    setFocusedId((current) => current === id ? null : current);
                                                                    setValues((current) => {
                                                                        if ((current[id] ?? "").trim() !== "") {
                                                                            return current;
                                                                        }
                                                                        return { ...current, [id]: DEFAULT_COEFFICIENT };
                                                                    });
                                                                }}
                                                                onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.value }))}
                                                            />
                                                        }
                                                    />
                                                    <TooltipContent className="max-w-56 text-left whitespace-normal">
                                                        {issue ? <span className="block">{issue}</span> : null}
                                                        {(coefficient.description ?? "").trim() ? <span className="block">{(coefficient.description ?? "").trim()}</span> : null}
                                                        <span className="block">{coefficientRangeLabel(coefficient)}</span>
                                                        {dirty && !issue ? <span className="block">Значение изменено и ещё не сохранено</span> : null}
                                                        {savedSide === "below" ? <span className="block">Сохранённое значение меньше 1</span> : null}
                                                        {savedSide === "above" ? <span className="block">Сохранённое значение больше 1</span> : null}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                        );
                                    }))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
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
            {cellMenu ? (
                <div
                    data-cell-menu
                    role="menu"
                    className="fixed z-50 min-w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    style={{ left: cellMenu.x, top: cellMenu.y }}
                >
                    <button type="button" role="menuitem" className={menuItemClass} onClick={resetCellToDefault}>
                        <RotateCcw />
                        Вернуть значение по умолчанию
                    </button>
                    <button type="button" role="menuitem" className={menuItemClass} onClick={fillColumnFromCell}>
                        <ArrowDownFromLine />
                        Заполнить столбец этим значением
                    </button>
                </div>
            ) : null}
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
                    {" "}Чтобы применить изменения со следующего месяца, выберите будущий период. Более ранние месяцы при этом не изменяются. Вкладка «История» показывает, кто менял коэффициенты в выбранном месяце и что было до сохранения.
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
const menuItemClass = "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

type CellMenu = {
    x: number;
    y: number;
    branchUuid: string;
    basketId: number;
    coefficientKey: string;
};
const crosshairExact = "shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_55%,transparent),inset_0_0_0_9999px_color-mix(in_oklab,var(--foreground)_14%,transparent)]";
const crosshairLine = "shadow-[inset_0_0_0_9999px_color-mix(in_oklab,var(--foreground)_7%,transparent)]";

function columnKey(basketId: number, key: string): string {
    return `${basketId}:${key}`;
}

function sameColumn(hoverColumn: string, cellColumn: string): boolean {
    if (hoverColumn === cellColumn) {
        return true;
    }
    if (hoverColumn.startsWith("group:")) {
        return cellColumn.startsWith(`${hoverColumn.slice("group:".length)}:`);
    }
    if (cellColumn.startsWith("group:")) {
        return hoverColumn.startsWith(`${cellColumn.slice("group:".length)}:`);
    }
    return false;
}

function valueCellShadow(
    side: "below" | "above" | null,
    hover: { row: string | null; column: string } | null,
    row: string,
    column: string,
): { boxShadow: string } | undefined {
    const layers: string[] = [];
    if (hover) {
        const exact = hover.row === row && hover.column === column;
        const rowOn = hover.row === row;
        const columnOn = sameColumn(hover.column, column);
        if (exact) {
            layers.push("inset 0 0 0 1px color-mix(in oklab, var(--foreground) 55%, transparent)");
            layers.push("inset 0 0 0 9999px color-mix(in oklab, var(--foreground) 14%, transparent)");
        } else if (rowOn || columnOn) {
            layers.push("inset 0 0 0 9999px color-mix(in oklab, var(--foreground) 7%, transparent)");
        }
    }
    if (side === "below") {
        layers.push("inset 0 0 0 9999px color-mix(in oklab, #e11d48 18%, transparent)");
    } else if (side === "above") {
        layers.push("inset 0 0 0 9999px color-mix(in oklab, #0284c7 18%, transparent)");
    }
    if (layers.length === 0) {
        return undefined;
    }
    return { boxShadow: layers.join(", ") };
}

function crosshairClass(hover: { row: string | null; column: string } | null, row: string | null, column: string): string {
    if (!hover) {
        return "";
    }
    const exact = hover.row === row && hover.column === column;
    const rowOn = hover.row !== null && hover.row === row;
    const columnOn = sameColumn(hover.column, column);
    if (exact) {
        return crosshairExact;
    }
    if (rowOn || columnOn) {
        return crosshairLine;
    }
    return "";
}

function fieldKey(branchUuid: string, basketId: number, key: string): string {
    return `${branchUuid}:${basketId}:${key}`;
}

function displayedValues(page: RrsCoefficientPage): Record<string, string> {
    const stored = new Map(page.values.map((item) => [fieldKey(item.branchUuid, item.basketId, item.key), item.value]));
    const next: Record<string, string> = {};
    for (const branch of page.branches) {
        for (const basket of page.baskets) {
            for (const coefficient of basket.coefficients) {
                const id = fieldKey(branch.uuid, basket.id, coefficient.key);
                const value = stored.get(id)?.trim() ?? "";
                next[id] = value === "" ? DEFAULT_COEFFICIENT : value;
            }
        }
    }
    return next;
}

function isDirty(values: Record<string, string>, saved: Record<string, string>, id: string): boolean {
    return (values[id] ?? DEFAULT_COEFFICIENT).trim() !== (saved[id] ?? DEFAULT_COEFFICIENT).trim();
}

function savedValueSide(raw: string): "below" | "above" | null {
    const normalized = raw.trim().replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        return null;
    }
    const value = Number(normalized);
    if (value < 1) {
        return "below";
    }
    if (value > 1) {
        return "above";
    }
    return null;
}
