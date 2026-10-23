"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownFromLine, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { coefficientRangeLabel, coefficientValueIssue } from "@/lib/coefficient-value";
import type { BasketCoefficient } from "@/lib/baskets";
import { cn } from "@/lib/utils";
import { WikiVersionHint } from "@/components/wiki-version-hint";

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
const DEFAULT_COEFFICIENT = "1";
const menuItemClass = "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

export type CoefficientTableBranch = {
    uuid: string;
    name: string;
};

export type CoefficientTableBasket = {
    id: number;
    name: string;
    indicatorName: string;
    versionNo: number;
    versionName: string;
    versionId: number;
    coefficients: BasketCoefficient[];
};

type CellMenu = {
    x: number;
    y: number;
    branchUuid: string;
    basketId: number;
    coefficientKey: string;
};

export function coefficientFieldKey(branchUuid: string, basketId: number, key: string): string {
    return `${branchUuid}:${basketId}:${key}`;
}

export function coefficientCellDirty(values: Record<string, string>, saved: Record<string, string>, id: string): boolean {
    return (values[id] ?? DEFAULT_COEFFICIENT).trim() !== (saved[id] ?? DEFAULT_COEFFICIENT).trim();
}

export function CoefficientTable({
    branches,
    baskets,
    values,
    saved,
    editable,
    disabled,
    bottomReserve = 32,
    onChange,
}: {
    branches: CoefficientTableBranch[];
    baskets: CoefficientTableBasket[];
    values: Record<string, string>;
    saved: Record<string, string>;
    editable: boolean;
    disabled?: boolean;
    bottomReserve?: number;
    onChange?: (update: (current: Record<string, string>) => Record<string, string>) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRowRef = useRef<HTMLTableRowElement>(null);
    const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);
    const [headerOffset, setHeaderOffset] = useState(0);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [hover, setHover] = useState<{ row: string | null; column: string } | null>(null);
    const [cellMenu, setCellMenu] = useState<CellMenu | null>(null);
    const locked = disabled || !editable;

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

    useLayoutEffect(() => {
        function update() {
            const container = containerRef.current;
            if (!container) {
                return;
            }
            const top = container.getBoundingClientRect().top;
            setTableMaxHeight(Math.max(280, window.innerHeight - top - bottomReserve));
        }
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [bottomReserve, branches, baskets]);

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
    }, [baskets]);

    function openCellMenu(event: { preventDefault(): void; clientX: number; clientY: number }, branchUuid: string, basketId: number, coefficientKey: string) {
        if (locked) {
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
        const id = coefficientFieldKey(cellMenu.branchUuid, cellMenu.basketId, cellMenu.coefficientKey);
        onChange?.((current) => ({ ...current, [id]: DEFAULT_COEFFICIENT }));
        setCellMenu(null);
    }

    function fillColumnFromCell() {
        if (!cellMenu) {
            return;
        }
        const sourceId = coefficientFieldKey(cellMenu.branchUuid, cellMenu.basketId, cellMenu.coefficientKey);
        onChange?.((current) => {
            const value = (current[sourceId] ?? "").trim() || DEFAULT_COEFFICIENT;
            const next = { ...current };
            for (const branch of branches) {
                next[coefficientFieldKey(branch.uuid, cellMenu.basketId, cellMenu.coefficientKey)] = value;
            }
            return next;
        });
        setCellMenu(null);
    }

    if (baskets.length === 0) {
        return <p className="text-sm text-muted-foreground">У подключённых версий коэффициенты не заданы.</p>;
    }
    if (branches.length === 0) {
        return <p className="text-sm text-muted-foreground">В этом периоде нет филиалов, включённых в мотивацию.</p>;
    }

    return (
        <>
            <div
                ref={containerRef}
                className="overflow-auto rounded-lg"
                style={tableMaxHeight === null ? undefined : { maxHeight: tableMaxHeight }}
                onMouseLeave={() => setHover(null)}
                onScroll={() => setCellMenu(null)}
            >
                <Table containerClassName="overflow-visible" className="w-max border-separate border-spacing-0">
                    <TableHeader>
                        <tr ref={headerRowRef}>
                            <TableHead
                                rowSpan={baskets.length === 0 ? 1 : 2}
                                style={{ zIndex: 40 }}
                                className={cn("sticky left-0 w-44 min-w-44 border-t border-l bg-background", cellGrid, crosshairClass(hover, null, "branch"))}
                                onMouseEnter={() => setHover({ row: null, column: "branch" })}
                            >
                                Филиал
                            </TableHead>
                            {baskets.map((basket, basketIndex) => {
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
                                        <WikiVersionHint versionId={basket.versionId} />
                                    </TableHead>
                                );
                            })}
                        </tr>
                        {baskets.length > 0 ? (
                            <TableRow className="hover:bg-transparent">
                                {baskets.flatMap((basket, basketIndex) => basket.coefficients.map((coefficient) => {
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
                        {branches.map((branch) => (
                            <TableRow key={branch.uuid} className="hover:bg-transparent">
                                <TableCell
                                    style={{ zIndex: 10 }}
                                    className={cn("sticky left-0 w-44 min-w-44 border-l bg-background font-medium", cellGrid, crosshairClass(hover, branch.uuid, "branch"))}
                                    onMouseEnter={() => setHover({ row: branch.uuid, column: "branch" })}
                                >
                                    {branch.name}
                                </TableCell>
                                {baskets.flatMap((basket, basketIndex) => basket.coefficients.map((coefficient) => {
                                    const id = coefficientFieldKey(branch.uuid, basket.id, coefficient.key);
                                    const value = values[id] ?? DEFAULT_COEFFICIENT;
                                    const dirty = coefficientCellDirty(values, saved, id);
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
                                                            readOnly={locked}
                                                            disabled={Boolean(disabled)}
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
                                                                onChange?.((current) => {
                                                                    if ((current[id] ?? "").trim() !== "") {
                                                                        return current;
                                                                    }
                                                                    return { ...current, [id]: DEFAULT_COEFFICIENT };
                                                                });
                                                            }}
                                                            onChange={(event) => {
                                                                const nextValue = event.target.value;
                                                                onChange?.((current) => ({ ...current, [id]: nextValue }));
                                                            }}
                                                        />
                                                    }
                                                />
                                                <TooltipContent className="max-w-[min(14rem,calc(100vw-1.5rem))] text-left whitespace-normal">
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
        </>
    );
}

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
