"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Search, X } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageControls } from "@/components/page-controls";
import { cn } from "@/lib/utils";
import { detailTableFrameClass, detailTableInnerClass } from "./bonus-detail-ui";
import { formatMoney } from "./mock";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };
export type BonusDetailSortOption = { key: string; label: string };

export function BonusDetailTotal({ total, className }: { total: number; className?: string }) {
    return (
        <p className={cn("shrink-0 text-sm text-muted-foreground", className)}>
            Премия: <span className="font-medium tabular-nums text-foreground">{formatMoney(total)}</span>
        </p>
    );
}

export function BonusDetailSearch({
    value,
    onChange,
    placeholder = "Поиск",
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    const hasValue = value.trim().length > 0;

    return (
        <div className={cn("relative min-w-0 w-full", className)}>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={cn("h-8 pl-8 text-sm md:h-8", hasValue && "pr-8")}
                aria-label={placeholder}
            />
            {hasValue ? (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    className="absolute top-1/2 right-1.5 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Очистить поиск"
                >
                    <X className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}

export function BonusDetailSortButton({
    sort,
    options,
    onToggle,
}: {
    sort: SortState;
    options: BonusDetailSortOption[];
    onToggle: (key: string) => void;
}) {
    const active = options.find((option) => option.key === sort.key);
    const DirIcon = sort.dir === "desc" ? ArrowDown : ArrowUp;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                type="button"
                aria-label="Сортировка"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs transition-colors hover:bg-muted/50"
            >
                <ArrowUpDown className="size-4 shrink-0" />
                <DirIcon className="size-3.5 shrink-0 opacity-70" />
                <span className="sr-only">{active ? `${active.label}, ${sort.dir === "desc" ? "по убыванию" : "по возрастанию"}` : "Сортировка"}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48 w-auto">
                <DropdownMenuLabel>Сортировать по</DropdownMenuLabel>
                {options.map((option) => {
                    const selected = option.key === sort.key;
                    return (
                        <DropdownMenuItem key={option.key} onClick={() => onToggle(option.key)}>
                            <span className="flex-1">{option.label}</span>
                            {selected ? <DirIcon className="size-4 opacity-70" /> : null}
                            {selected ? <Check className="size-4" /> : <span className="size-4" />}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Desktop: controls left, compact search + total right. Mobile: controls/total, then search + sort. */
export function BonusDetailToolbar({
    controls,
    search,
    sort,
    total,
}: {
    controls?: ReactNode;
    search: ReactNode;
    sort?: ReactNode;
    total: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
                {controls ? (
                    <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {controls}
                    </div>
                ) : null}
                <div className="ml-auto hidden min-w-0 items-center gap-3 md:flex">
                    <div className="w-52 min-w-0 lg:w-60">{search}</div>
                    {total}
                </div>
                <div className={cn("md:hidden", !controls && "ml-auto")}>{total}</div>
            </div>
            <div className="flex min-w-0 items-center gap-2 md:hidden">
                <div className="min-w-0 flex-1">{search}</div>
                {sort}
            </div>
        </div>
    );
}

export function BonusDetailTableFrame({
    children,
    minWidthClass,
    className,
}: {
    children: ReactNode;
    minWidthClass: string;
    className?: string;
}) {
    return (
        <div className={cn(detailTableFrameClass, "min-h-0", className)}>
            <div className={cn(detailTableInnerClass, minWidthClass)}>
                {children}
            </div>
        </div>
    );
}

/** Fills remaining viewport under the toolbar; measureRef sizes the page by this block. */
export function BonusDetailShell({
    toolbar,
    children,
    pagination,
    measureRef,
}: {
    toolbar: ReactNode;
    children: ReactNode;
    pagination?: ReactNode;
    measureRef: Ref<HTMLDivElement | null>;
}) {
    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="shrink-0">{toolbar}</div>
            <div ref={measureRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                {children}
                {pagination}
            </div>
        </div>
    );
}

export function useBonusDetailSort(defaultKey: string, defaultDir: SortDir = "desc") {
    const [sort, setSort] = useState<SortState>({ key: defaultKey, dir: defaultDir });

    function toggle(key: string) {
        setSort((current) => (
            current.key === key
                ? { key, dir: current.dir === "desc" ? "asc" : "desc" }
                : { key, dir: "desc" }
        ));
    }

    return { sort, setSort, toggle };
}

export function parseDetailDate(text: string): number {
    const match = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
    if (!match) return 0;
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : 2026;
    if (year < 100) year += 2000;
    return Date.UTC(year, month - 1, day);
}

export function sortDetailItems<T>(
    items: T[],
    sort: SortState,
    accessors: Record<string, (item: T) => string | number>,
): T[] {
    const get = accessors[sort.key];
    if (!get) return items;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...items].sort((left, right) => {
        const a = get(left);
        const b = get(right);
        if (typeof a === "number" && typeof b === "number") {
            return (a - b) * dir;
        }
        return String(a).localeCompare(String(b), "ru", { sensitivity: "base", numeric: true }) * dir;
    });
}

export function filterDetailItems<T>(items: T[], query: string, haystack: (item: T) => string): T[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => haystack(item).toLowerCase().includes(needle));
}

export function BonusDetailSortHeader({
    label,
    sortKey,
    sort,
    onToggle,
    className,
    align = "start",
}: {
    label: string;
    sortKey: string;
    sort: SortState;
    onToggle: (key: string) => void;
    className?: string;
    align?: "start" | "end";
}) {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
    return (
        <div className={cn(align === "end" && "justify-self-end text-right", className)}>
            <span className="md:hidden">{label}</span>
            <button
                type="button"
                onClick={() => onToggle(sortKey)}
                className={cn(
                    "hidden max-w-full items-center gap-1 rounded-sm text-left transition-colors hover:text-foreground md:inline-flex",
                    active ? "text-foreground" : "text-muted-foreground",
                )}
            >
                <span className="min-w-0 leading-snug [overflow-wrap:anywhere]">{label}</span>
                <Icon className="size-3.5 shrink-0 opacity-70" />
            </button>
        </div>
    );
}

export function useBonusDetailPagination(itemCount: number, resetKey?: string | number) {
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(14);
    const measureRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const observer = new ResizeObserver(() => sync());

        function sync() {
            const node = measureRef.current;
            const tableHeader = 36;
            const row = 40;
            const gap = 12;
            const paginationReserve = 44;

            let height = node?.clientHeight ?? 0;
            if (height <= 0) {
                const top = node?.getBoundingClientRect().top ?? 220;
                const viewport = window.visualViewport?.height ?? window.innerHeight;
                height = Math.max(0, viewport - top - 8);
            }

            const fullRows = Math.floor(Math.max(0, height - gap - tableHeader) / row);
            if (itemCount <= fullRows) {
                setPageSize(Math.max(8, fullRows));
                return;
            }
            const pagedRows = Math.floor(Math.max(0, height - paginationReserve - gap - tableHeader) / row);
            setPageSize(Math.max(8, pagedRows));
        }

        function attach() {
            const node = measureRef.current;
            if (node) {
                observer.observe(node);
            }
            sync();
        }

        attach();
        const frame = window.requestAnimationFrame(attach);
        window.addEventListener("resize", sync);
        window.visualViewport?.addEventListener("resize", sync);
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", sync);
            window.visualViewport?.removeEventListener("resize", sync);
        };
    }, [itemCount, resetKey]);

    useEffect(() => {
        setPage(0);
    }, [itemCount, pageSize, resetKey]);

    const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
    const safePage = Math.min(page, pageCount - 1);
    const start = safePage * pageSize;
    const end = Math.min(itemCount, start + pageSize);
    const needsPagination = itemCount > pageSize;

    return {
        page: safePage,
        setPage,
        pageSize,
        pageCount,
        start,
        end,
        needsPagination,
        measureRef,
    };
}

export function BonusDetailPagination({
    page,
    pageSize,
    total,
    onPageChange,
    className,
}: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    if (total <= pageSize) {
        return null;
    }
    return (
        <div className={cn("min-w-0", className)}>
            <PageControls
                page={page + 1}
                pageSize={pageSize}
                total={total}
                onPageChange={(next) => onPageChange(next - 1)}
            />
        </div>
    );
}
