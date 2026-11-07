"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2Icon } from "lucide-react";
import { DataTableSkeleton } from "@/components/loading-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
    BonusDetailCount,
    BonusDetailEnd,
    BonusDetailSearch,
    BonusDetailShell,
    BonusDetailTableFrame,
    BonusDetailToolbar,
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
import { useBranchLocation } from "./BranchFrame";
import { CopyDocumentButton, DetailHint } from "./SalesBonusDetail";
import { findStaffSegment } from "./staff";
import { useBranchDirectory } from "./branch-directory";
import { formatMoney } from "./mock";

type GroupMode = "category" | "document";

interface ReleaseLine {
    id: string;
    categoryTitle: string;
    calculation: string;
    amount: number;
    documentId: string;
    documentTitle: string;
    productName: string;
}

interface ReleaseGroup {
    id: string;
    title: string;
    amount: number;
    lines: ReleaseLine[];
}

interface LiveReleaseDetail {
    rowLabel: string;
    groupCount: number;
    groups: ReleaseGroup[];
}

const releaseWideColumns = "sm:grid sm:grid-cols-[minmax(12rem,1.5fr)_minmax(14rem,1.2fr)_7.5rem_1.5rem] sm:items-center sm:gap-x-3";
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

export function ReleaseBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const { branchId } = useBranchLocation();
    const directory = useBranchDirectory();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const employee = findStaffSegment(directory.employees, employeeId, searchParams.get("from"));
    const [loaded, setLoaded] = useState<LiveReleaseDetail | null>(null);
    const [loadedMode, setLoadedMode] = useState<GroupMode>("category");
    const [pending, setPending] = useState(true);
    const [failed, setFailed] = useState(false);
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
    const loadedRef = useRef<LiveReleaseDetail | null>(null);
    const scopeKey = `${branchId}|${employeeId}|${period}|${employee?.activeFrom ?? ""}|${employee?.activeUntil ?? ""}`;
    const [scope, setScope] = useState(scopeKey);
    if (scope !== scopeKey) {
        setScope(scopeKey);
        setLoaded(null);
        setLoadedMode("category");
        setPending(true);
        setFailed(false);
    }

    useResetWhenChanged(mode, () => {
        setOpenIds([]);
        setQuery("");
    });

    const page = mobilePage;
    const pageSize = MOBILE_PORTION;
    const feedKey = `${scopeKey}|${mode}|${debouncedQuery}`;
    const [feed, setFeed] = useState(feedKey);
    if (feed !== feedKey) {
        setFeed(feedKey);
        setMobilePage(0);
        setEndReached(false);
        setLoaded(null);
        setFailed(false);
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
            fetch(`/api/branch/release-premium/detail?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const body = await response.json() as { success?: boolean; data?: LiveReleaseDetail };
                    if (!response.ok || !body.success || !body.data) {
                        if (page === 0) {
                            setFailed(true);
                            setLoaded(null);
                        } else {
                            setEndReached(true);
                        }
                        return;
                    }
                    setFailed(false);
                    setLoadedMode(mode);
                    const data = body.data;
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
                        setFailed(true);
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
    const liveDetail = loaded && loadedMode === mode ? loaded : null;
    const pageGroups = liveDetail?.groups ?? [];
    const elementCount = liveDetail?.groupCount ?? 0;
    const showSkeleton = !failed && !liveDetail;
    const appending = Boolean(liveDetail && pending && page > 0);
    const hasMore = Boolean(liveDetail && !endReached && liveDetail.groups.length < liveDetail.groupCount);
    const showEmpty = !showSkeleton && !failed && liveDetail !== null && liveDetail.groupCount === 0 && debouncedQuery === "";

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
                            aria-label="Группировка выдачи"
                            className={detailModeToggleClass}
                        >
                            <ToggleGroupItem value="category" className={detailModeToggleItemClass}>По категориям</ToggleGroupItem>
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
                <DataTableSkeleton columns={3} rows={6} />
            ) : failed ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Не удалось прочитать выдачу.</p>
            ) : showEmpty ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по выдаче.</p>
            ) : (
                <div className="relative min-h-0 flex-1">
                    <div aria-busy={appending}>
                        <BonusDetailTableFrame minWidthClass="min-w-0 sm:min-w-[40rem]">
                            <div className={cn(detailHeaderClass, "flex items-center justify-between", releaseWideColumns)}>
                                <span>{mode === "category" ? "Категория" : "Документ"}</span>
                                <span className="hidden sm:block">Расчёт</span>
                                <span className={detailAmountClass}>Сумма</span>
                                <span className="hidden sm:block" />
                            </div>
                            {pageGroups.length === 0 ? (
                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                            ) : (
                                pageGroups.map((group) => (
                                    <ReleaseGroupRow
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

function ReleaseGroupRow({
    group,
    open,
    onOpenChange,
}: {
    group: ReleaseGroup;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const summary = open ? "Скрыть строки" : `${group.lines.length} ${linesWord(group.lines.length)}`;
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger data-scroll-row="" className={cn(detailRowClass, "flex w-full items-center gap-2 text-left hover:bg-muted/50", releaseWideColumns)}>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{group.title}</span>
                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{summary}</span>
                </span>
                <span className="hidden min-w-0 truncate text-muted-foreground sm:block">{summary}</span>
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul className={cn(detailNestedClass, "sm:pl-0")}>
                    {group.lines.map((line) => (
                        <ReleaseLineRow key={line.id} line={line} />
                    ))}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

function ReleaseLineRow({ line }: { line: ReleaseLine }) {
    const product = line.productName.trim();
    const category = product && product !== line.categoryTitle ? line.categoryTitle : null;
    const documentTitle = line.documentTitle.trim();
    return (
        <li data-scroll-row="" className={cn(detailNestedRowClass, "flex flex-col gap-1", releaseWideColumns)}>
            <div className="min-w-0">
                <DetailHint text={product || line.categoryTitle} className="block w-full min-w-0 truncate text-left text-xs font-medium leading-snug" contentClassName="text-[11px]">
                    {product || line.categoryTitle}
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
            <span className="min-w-0 truncate text-xs text-muted-foreground sm:hidden">{line.calculation}</span>
            <span className={cn(detailAmountClass, "sm:hidden")}>{formatMoney(line.amount)}</span>
            <span className="hidden min-w-0 truncate text-muted-foreground sm:block">{line.calculation}</span>
            <span className={cn(detailAmountClass, "hidden sm:block")}>{formatMoney(line.amount)}</span>
            <span className="hidden sm:block" />
        </li>
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
