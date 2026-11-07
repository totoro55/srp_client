"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2Icon } from "lucide-react";
import { DataTableSkeleton } from "@/components/loading-state";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
    BonusDetailCount,
    BonusDetailEnd,
    BonusDetailSearch,
    BonusDetailShell,
    BonusDetailTableFrame,
    BonusDetailToolbar,
    filterDetailItems,
    parseDetailDate,
    sortDetailItems,
    useResetWhenChanged,
} from "./BonusDetailPager";
import {
    detailAmountClass,
    detailChevronClass,
    detailHeaderClass,
    detailModeToggleClass,
    detailModeToggleItemClass,
    detailNestedClass,
    detailNestedRowClass,
    detailRowClass,
} from "./bonus-detail-ui";
import { useBranchDirectory } from "./branch-directory";
import { useBranchLocation } from "./BranchFrame";
import { findStaffSegment } from "./staff";
import {
    formatMoney,
    salesOperationDetail,
    type SalesDetailGroup,
    type SalesDetailLine,
} from "./mock";

type GroupMode = "category" | "document";

interface LiveSalesDetail {
    rowLabel: string;
    groupCount: number;
    groups: SalesDetailGroup[];
}

const salesWideColumns = "sm:grid sm:grid-cols-[minmax(12rem,1.5fr)_8.5rem_minmax(11rem,1fr)_7.5rem_1.5rem] sm:items-center sm:gap-x-3";

const CHANNEL_BADGE: Record<string, string> = {
    "СТМ": "border-sky-700/20 bg-sky-600/15 text-sky-800 dark:border-sky-300/25 dark:bg-sky-400/15 dark:text-sky-200",
    "не СТМ": "border-violet-700/20 bg-violet-600/15 text-violet-800 dark:border-violet-300/25 dark:bg-violet-400/15 dark:text-violet-200",
    "ИМ": "border-amber-700/20 bg-amber-600/15 text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/15 dark:text-amber-200",
    "Безнал": "border-emerald-700/20 bg-emerald-600/15 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/15 dark:text-emerald-200",
};

const CHANNEL_HINT: Record<string, string> = {
    "СТМ": "Собственная торговая марка",
    "не СТМ": "Не собственная торговая марка",
    "ИМ": "Интернет-магазин",
    "Безнал": "Безналичная продажа",
    "Розница": "Розница",
};

const DOUBLED_HINT = "Тариф от количества удвоен: цена от 100 000";
const NARROW_DETAIL_QUERY = "(max-width: 639px)";
const MOBILE_PORTION = 20;

function subscribeNarrowDetail(onChange: () => void) {
    const media = window.matchMedia(NARROW_DETAIL_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

function useNarrowDetail() {
    return useSyncExternalStore(subscribeNarrowDetail, () => window.matchMedia(NARROW_DETAIL_QUERY).matches, () => false);
}

export function SalesBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const { branchId } = useBranchLocation();
    const directory = useBranchDirectory();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const employee = findStaffSegment(directory.employees, employeeId, searchParams.get("from"));
    const [loaded, setLoaded] = useState<LiveSalesDetail | null>(null);
    const [loadedMode, setLoadedMode] = useState<GroupMode>("category");
    const [live, setLive] = useState(false);
    const [pending, setPending] = useState(true);
    const [mode, setMode] = useState<GroupMode>("category");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebouncedValue(query, 300);
    const narrow = useNarrowDetail();
    const [mobilePage, setMobilePage] = useState(0);
    const [endReached, setEndReached] = useState(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const portionArmed = useRef(true);
    const loadedRef = useRef<LiveSalesDetail | null>(null);
    const mock = salesOperationDetail(employeeId, period);
    const scopeKey = `${branchId}|${employeeId}|${period}|${employee?.activeFrom ?? ""}|${employee?.activeUntil ?? ""}`;
    const [scope, setScope] = useState(scopeKey);
    if (scope !== scopeKey) {
        setScope(scopeKey);
        setLoaded(null);
        setLoadedMode("category");
        setLive(false);
        setPending(true);
    }

    useResetWhenChanged(mode, () => {
        setOpenIds([]);
        setQuery("");
    });

    const mockGroups = useMemo(() => {
        if (live || !mock) return [];
        const source = mode === "category" ? mock.byCategory : mock.byDocument;
        const filtered = filterDetailItems(
            source,
            query,
            (group) => `${group.title} ${group.lines.map((line) => `${line.productName ?? ""} ${line.categoryTitle} ${line.documentTitle} ${line.channel} ${line.calculation}`).join(" ")}`,
        );
        return sortDetailItems(filtered, { key: mode === "document" ? "date" : "amount", dir: "desc" }, {
            title: (group) => group.title,
            date: (group) => parseDetailDate(group.title),
            amount: (group) => group.amount,
        });
    }, [live, mock, mode, query]);

    const page = mobilePage;
    const pageSize = MOBILE_PORTION;
    const feedKey = `${scopeKey}|${mode}|${debouncedQuery}`;
    const [feed, setFeed] = useState(feedKey);
    if (feed !== feedKey) {
        setFeed(feedKey);
        setMobilePage(0);
        setEndReached(false);
        setLoaded(null);
        setPending(true);
        setOpenIds([]);
    }
    const measureRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (!params.has("page")) {
            return;
        }
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setPending(true);
            const params = new URLSearchParams({
                period,
                branch: branchId,
                employee: employeeId,
                from: employee?.activeFrom ?? "",
                until: employee?.activeUntil ?? "",
                mode,
                page: String(page),
                pageSize: String(pageSize),
                q: debouncedQuery,
            });
            fetch(`/api/branch/sale-premium/detail?${params.toString()}`, { signal: controller.signal })
            .then(async (response) => {
                const body = await response.json() as { success?: boolean; data?: LiveSalesDetail };
                if (!response.ok || !body.success || !body.data || (body.data.groupCount === 0 && debouncedQuery === "")) {
                    if (page === 0) {
                        setLive(false);
                        setLoaded(null);
                    } else {
                        setEndReached(true);
                    }
                    return;
                }
                const data = body.data;
                if (!data) {
                    return;
                }
                setLive(true);
                setLoadedMode(mode);
                const current = loadedRef.current;
                if (page === 0 || !current) {
                    setLoaded(data);
                    return;
                }
                const seen = new Set(current.groups.map((group) => group.id));
                const extra = data.groups.filter((group) => !seen.has(group.id));
                if (extra.length === 0) {
                    setEndReached(true);
                    return;
                }
                setLoaded({
                    rowLabel: data.rowLabel,
                    groupCount: data.groupCount,
                    groups: [...current.groups, ...extra],
                });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") {
                    return;
                }
                if (page === 0) {
                    setLive(false);
                    setLoaded(null);
                } else {
                    setEndReached(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setPending(false);
                }
            });
        }, 80);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [branchId, debouncedQuery, employee?.activeFrom, employee?.activeUntil, employeeId, mode, page, pageSize, period]);

    loadedRef.current = loaded;
    const liveDetail = live && loaded && loadedMode === mode ? loaded : null;
    const pageGroups = liveDetail ? liveDetail.groups : mockGroups;
    const elementCount = liveDetail ? liveDetail.groupCount : pageGroups.length;
    const rowLabel = liveDetail ? liveDetail.rowLabel : mock?.rowLabel ?? "Категория";
    const showSkeleton = !liveDetail && (pending || (live && loadedMode !== mode));
    const appending = Boolean(liveDetail && pending && page > 0);
    const hasMore = Boolean(liveDetail && !endReached && liveDetail.groups.length < liveDetail.groupCount);
    const showEmpty = !showSkeleton && !liveDetail && !mock;

    useEffect(() => {
        if (!pending) {
            portionArmed.current = true;
        }
    }, [pending]);

    useEffect(() => {
        if (!hasMore || pending || showSkeleton) {
            return;
        }
        const inner = scrollRef.current;
        const outer = inner?.closest<HTMLElement>("[data-narrow-scroll]") ?? null;
        const root = narrow && outer ? outer : inner;
        const sentinel = sentinelRef.current;
        if (!root || !sentinel) {
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            if (!portionArmed.current || !entries.some((entry) => entry.isIntersecting)) {
                return;
            }
            portionArmed.current = false;
            setMobilePage((current) => current + 1);
        }, { root, rootMargin: "240px" });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, narrow, pending, showSkeleton, pageGroups.length]);

    const categoryModeLabel = /издел/i.test(rowLabel) ? "По изделиям" : "По категориям";

    return (
        <BonusDetailShell
            measureRef={measureRef}
            scrollRef={scrollRef}
            toolbar={(
                <BonusDetailToolbar
                    controls={(
                        <ToggleGroup
                            variant="outline"
                            size="sm"
                            spacing={0}
                            value={[mode]}
                            onValueChange={(values) => {
                                const next = values[0];
                                if (next === "category" || next === "document") {
                                    setMode(next);
                                }
                            }}
                            aria-label="Группировка продаж"
                            className={detailModeToggleClass}
                        >
                            <ToggleGroupItem value="category" className={detailModeToggleItemClass}>{categoryModeLabel}</ToggleGroupItem>
                            <ToggleGroupItem value="document" className={detailModeToggleItemClass}>По документам</ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    total={null}
                />
            )}
            pagination={!showSkeleton && elementCount > 0 ? <BonusDetailCount loaded={pageGroups.length} total={elementCount} /> : null}
        >
            {showSkeleton ? (
                <DataTableSkeleton columns={4} rows={6} />
            ) : showEmpty ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по продажам.</p>
            ) : (
            <div className="relative min-h-0 flex-1">
                <div aria-busy={appending}>
                    <BonusDetailTableFrame minWidthClass="min-w-0 sm:min-w-[48rem]">
                        <div className={cn(detailHeaderClass, "flex items-center justify-between", salesWideColumns)}>
                            <span>{mode === "category" ? rowLabel : "Документ"}</span>
                            <span className="hidden sm:block">Вид</span>
                            <span className="hidden sm:block">Расчёт</span>
                            <span className={detailAmountClass}>Сумма</span>
                            <span className="hidden sm:block" />
                        </div>
                        {pageGroups.length === 0 ? (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                        ) : (
                            pageGroups.map((group) => (
                                <SalesGroupRow
                                    key={group.id}
                                    group={group}
                                    open={openIds.includes(group.id)}
                                    onOpenChange={(next) => {
                                        setOpenIds((current) => (next ? [...current, group.id] : current.filter((id) => id !== group.id)));
                                    }}
                                />
                            ))
                        )}
                    </BonusDetailTableFrame>
                </div>
                {hasMore ? (
                    <div ref={sentinelRef} className="flex items-center justify-center py-4">
                        {appending ? <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden /> : null}
                        <span className="sr-only">{appending ? "Следующая порция" : "Дальше"}</span>
                    </div>
                ) : pageGroups.length > 0 ? <BonusDetailEnd loaded={pageGroups.length} total={elementCount} /> : null}
            </div>
            )}
        </BonusDetailShell>
    );
}

function SalesGroupRow({
    group,
    open,
    onOpenChange,
}: {
    group: SalesDetailGroup;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const summary = open ? "Скрыть строки" : `${group.lines.length} ${linesWord(group.lines.length)}`;
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger data-scroll-row="" className={cn(detailRowClass, "flex w-full items-center gap-2 text-left hover:bg-muted/50", salesWideColumns)}>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{group.title}</span>
                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{summary}</span>
                </span>
                <span className="hidden text-muted-foreground sm:block">—</span>
                <span className="hidden min-w-0 truncate text-muted-foreground sm:block">{summary}</span>
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul className={cn(detailNestedClass, "sm:pl-0")}>
                    {group.lines.map((line) => (
                        <SalesLineRow key={line.id} line={line} />
                    ))}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

function SalesLineRow({ line }: { line: SalesDetailLine }) {
    const product = line.productName?.trim();
    const primary = product || line.categoryTitle;
    const category = product ? line.categoryTitle : null;
    const documentTitle = line.documentTitle.trim();
    return (
        <li data-scroll-row="" className={cn(detailNestedRowClass, "flex flex-col gap-1", salesWideColumns)}>
            <div className="min-w-0">
                <DetailHint
                    text={primary}
                    className={cn(
                        "block w-full min-w-0 truncate text-left font-medium leading-snug",
                        product && "text-xs",
                    )}
                    contentClassName={product ? "text-[11px]" : undefined}
                >
                    {primary}
                </DetailHint>
                {category || documentTitle ? (
                    <div className="mt-0.5 flex min-w-0 flex-col gap-0.5 sm:hidden">
                        {category ? <span className="truncate text-xs text-muted-foreground">{category}</span> : null}
                        {documentTitle ? <CopyDocumentButton title={documentTitle} /> : null}
                    </div>
                ) : null}
                {category || documentTitle ? (
                    <div className="mt-0.5 hidden min-w-0 items-baseline text-xs text-muted-foreground sm:flex">
                        {category ? <span className="min-w-0 truncate">{category}</span> : null}
                        {category && documentTitle ? <span className="shrink-0 px-1" aria-hidden>·</span> : null}
                        {documentTitle ? <CopyDocumentButton title={documentTitle} className="shrink-0" /> : null}
                    </div>
                ) : null}
            </div>
            <span className="flex min-w-0 items-center gap-1">
                <SalesChannelBadge channel={line.channel} />
                {line.doubled ? <DoubledBadge /> : null}
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground sm:hidden">{line.calculation}</span>
                <span className={cn(detailAmountClass, "sm:hidden")}>{formatMoney(line.amount)}</span>
            </span>
            <span className="hidden min-w-0 truncate text-muted-foreground sm:block">{line.calculation}</span>
            <span className={cn(detailAmountClass, "hidden sm:block")}>{formatMoney(line.amount)}</span>
            <span className="hidden sm:block" />
        </li>
    );
}

export function DetailHint({ text, className, contentClassName, children }: { text: string; className?: string; contentClassName?: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const pointerType = useRef("mouse");
    return (
        <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
                type="button"
                closeOnClick={false}
                className={cn("border-0 bg-transparent p-0", className)}
                onPointerDown={(event) => {
                    pointerType.current = event.pointerType;
                }}
                onClick={() => {
                    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
                    if (pointerType.current === "touch" || !finePointer) {
                        setOpen((current) => !current);
                    }
                }}
            >
                {children}
            </TooltipTrigger>
            <TooltipContent className={cn("max-w-xs text-pretty text-left", contentClassName)}>{text}</TooltipContent>
        </Tooltip>
    );
}

export function CopyDocumentButton({ title, className }: { title: string; className?: string }) {
    return (
        <button
            type="button"
            className={cn(
                "block max-w-full truncate text-left text-xs text-muted-foreground underline decoration-dotted underline-offset-2",
                className,
            )}
            onClick={() => {
                void copyDocument(title);
            }}
        >
            {title}
        </button>
    );
}

function copyDocument(title: string) {
    const copied = copyThroughSelection(title);
    const write = navigator.clipboard?.writeText(title);
    if (!write) {
        if (copied) notifySuccess("Документ скопирован");
        else notifyError("Не удалось скопировать документ");
        return;
    }
    void write.then(
        () => {
            if (!copied) notifySuccess("Документ скопирован");
        },
        () => {
            if (!copied) notifyError("Не удалось скопировать документ");
        },
    );
    if (copied) notifySuccess("Документ скопирован");
}

function copyThroughSelection(title: string): boolean {
    const area = document.createElement("textarea");
    area.value = title;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.append(area);
    area.focus();
    area.select();
    let copied = false;
    try {
        copied = document.execCommand("copy");
    } catch {
        copied = false;
    }
    area.remove();
    return copied;
}

function DoubledBadge() {
    return (
        <DetailHint text={DOUBLED_HINT} className="inline-flex shrink-0">
            <Badge
                variant="outline"
                className="h-5 rounded-md border-rose-700/20 bg-rose-600/15 px-1.5 font-medium text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/15 dark:text-rose-200"
            >
                ×2
            </Badge>
        </DetailHint>
    );
}

function SalesChannelBadge({ channel }: { channel: string }) {
    return (
        <DetailHint text={CHANNEL_HINT[channel] ?? channel} className="inline-flex shrink-0">
            <Badge
                variant="outline"
                className={cn("h-5 rounded-md px-1.5 font-medium", CHANNEL_BADGE[channel] ?? "bg-muted text-foreground")}
            >
                {channel}
            </Badge>
        </DetailHint>
    );
}

function useDebouncedValue(value: string, delay: number): string {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function linesWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "строка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "строки";
    return "строк";
}
