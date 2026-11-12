"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DataTableSkeleton } from "@/components/loading-state";
import { DETAIL_TIMEOUT_MESSAGE, isDetailTimeoutBody } from "@/lib/detail-timeout";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
    BonusDetailSearch,
    BonusDetailShell,
    BonusDetailTableFrame,
    BonusDetailToolbar,
    filterDetailItems,
    useResetWhenChanged,
} from "./BonusDetailPager";
import { groupPremiumLines } from "./detail-groups";
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
    lines: ReleaseLine[];
}

const releaseWideColumns = "sm:grid sm:grid-cols-[minmax(12rem,1.5fr)_minmax(14rem,1.2fr)_7.5rem_1.5rem] sm:items-center sm:gap-x-3";

export function ReleaseBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const { branchId } = useBranchLocation();
    const directory = useBranchDirectory();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const employee = findStaffSegment(directory.employees, employeeId, searchParams.get("from"));
    const [loaded, setLoaded] = useState<LiveReleaseDetail | null>(null);
    const [pending, setPending] = useState(true);
    const [failed, setFailed] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    const [mode, setMode] = useState<GroupMode>("category");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const scopeKey = `${branchId}|${employeeId}|${period}|${employee?.activeFrom ?? ""}|${employee?.activeUntil ?? ""}`;
    const [scope, setScope] = useState(scopeKey);
    if (scope !== scopeKey) {
        setScope(scopeKey);
        setLoaded(null);
        setPending(true);
        setFailed(false);
        setTimedOut(false);
    }

    useResetWhenChanged(mode, () => {
        setOpenIds([]);
        setQuery("");
    });

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
            });
            fetch(`/api/branch/release-premium/detail?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const body = await response.json() as {
                        success?: boolean;
                        data?: { rowLabel?: string; lines?: ReleaseLine[] };
                    };
                    if (isDetailTimeoutBody(body)) {
                        setTimedOut(true);
                        setFailed(false);
                        setLoaded(null);
                        return;
                    }
                    setTimedOut(false);
                    const lines = Array.isArray(body.data?.lines) ? body.data.lines : null;
                    if (!response.ok || !body.success || !lines) {
                        setFailed(true);
                        setLoaded(null);
                        return;
                    }
                    setFailed(false);
                    setLoaded({ rowLabel: body.data?.rowLabel || "Категория", lines });
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") {
                        return;
                    }
                    setFailed(true);
                    setLoaded(null);
                    setTimedOut(false);
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
    }, [branchId, employee?.activeFrom, employee?.activeUntil, employeeId, period]);

    const pageGroups = useMemo(() => {
        if (!loaded) {
            return [];
        }
        const groups = groupPremiumLines(loaded.lines, mode, {
            categoryTitle: (line) => line.categoryTitle,
            documentId: (line) => line.documentId,
            documentTitle: (line) => line.documentTitle,
        });
        return filterDetailItems(
            groups,
            query,
            (group) => `${group.title} ${group.lines.map((line) => `${line.productName} ${line.categoryTitle} ${line.documentTitle} ${line.calculation}`).join(" ")}`,
        );
    }, [loaded, mode, query]);
    const showSkeleton = pending && !loaded && !failed && !timedOut;
    const showEmpty = !showSkeleton && !failed && !timedOut && loaded !== null && loaded.lines.length === 0 && query.trim() === "";

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
            pagination={null}
        >
            {showSkeleton ? (
                <DataTableSkeleton columns={3} rows={6} />
            ) : timedOut ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{DETAIL_TIMEOUT_MESSAGE}</p>
            ) : failed ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Не удалось прочитать выдачу.</p>
            ) : showEmpty ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по выдаче.</p>
            ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

function linesWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "строка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "строки";
    return "строк";
}
