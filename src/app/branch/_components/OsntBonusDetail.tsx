"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTableSkeleton } from "@/components/loading-state";
import { DETAIL_TIMEOUT_MESSAGE, isDetailTimeoutBody } from "@/lib/detail-timeout";
import { cn } from "@/lib/utils";
import {
    BonusDetailSearch,
    BonusDetailShell,
    BonusDetailTableFrame,
    BonusDetailToolbar,
    filterDetailItems,
    parseDetailDate,
    sortDetailItems,
    useResetWhenChanged,
} from "./BonusDetailPager";
import { detailAmountClass, detailHeaderClass, detailRowClass } from "./bonus-detail-ui";
import { BrigadeMemberFilter, useBrigadeMemberFilter } from "./BrigadeDetailFilter";
import { useBranchDirectory } from "./branch-directory";
import { useBranchLocation } from "./BranchFrame";
import { formatMoney } from "./mock";
import { findStaffSegment } from "./staff";

interface OsntLine {
    id: string;
    day: string;
    calculation: string;
    amount: number;
    employeeId?: string;
    employeeName?: string;
}

const osntWideColumns = "sm:grid sm:grid-cols-[minmax(8rem,1fr)_minmax(12rem,1.4fr)_7.5rem] sm:items-center sm:gap-x-3";

export function OsntBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const { branchId } = useBranchLocation();
    const directory = useBranchDirectory();
    const searchParams = useSearchParams();
    const employee = findStaffSegment(directory.employees, employeeId, searchParams.get("from"));
    const [lines, setLines] = useState<OsntLine[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [timedOut, setTimedOut] = useState(false);
    const [query, setQuery] = useState("");
    const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
    const brigade = useBrigadeMemberFilter(members);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const measureRef = useRef<HTMLDivElement | null>(null);
    const scopeKey = `${branchId}|${employeeId}|${period}|${employee?.activeFrom ?? ""}|${employee?.activeUntil ?? ""}`;
    const [scope, setScope] = useState(scopeKey);
    if (scope !== scopeKey) {
        setScope(scopeKey);
        setLines(null);
        setMembers([]);
        setFailed(false);
        setTimedOut(false);
    }
    useResetWhenChanged(scopeKey, () => setQuery(""));

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({
            period,
            branch: branchId,
            employee: employeeId,
            from: employee?.activeFrom ?? "",
            until: employee?.activeUntil ?? "",
        });
        fetch(`/api/branch/osnt-premium/detail?${params.toString()}`, { signal: controller.signal })
            .then(async (response) => {
                const body = await response.json() as { success?: boolean; data?: { lines?: OsntLine[]; members?: { id: string; name: string }[] } };
                if (controller.signal.aborted) {
                    return;
                }
                if (isDetailTimeoutBody(body)) {
                    setTimedOut(true);
                    setFailed(false);
                    setLines(null);
                    return;
                }
                const next = Array.isArray(body.data?.lines) ? body.data.lines : null;
                if (!response.ok || !body.success || !next) {
                    setFailed(true);
                    setLines(null);
                    return;
                }
                setFailed(false);
                setTimedOut(false);
                setLines(next);
                setMembers(Array.isArray(body.data?.members) ? body.data.members : []);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
                    return;
                }
                setFailed(true);
                setLines(null);
                setTimedOut(false);
            });
        return () => controller.abort();
    }, [branchId, employee?.activeFrom, employee?.activeUntil, employeeId, period]);

    const rows = useMemo(() => {
        const filtered = filterDetailItems((lines ?? []).filter((line) => brigade.allows(line.employeeId)), query, (line) => `${line.employeeName ?? ""} ${line.day} ${line.calculation}`);
        return sortDetailItems(filtered, { key: "date", dir: "desc" }, {
            date: (line) => parseDetailDate(line.day),
        });
    }, [brigade, lines, query]);
    const showSkeleton = lines === null && !failed && !timedOut;
    const showEmpty = !showSkeleton && !failed && !timedOut && lines !== null && lines.length === 0;

    return (
        <BonusDetailShell
            measureRef={measureRef}
            scrollRef={scrollRef}
            toolbar={(
                <BonusDetailToolbar
                    controls={brigade.active ? (
                        <BrigadeMemberFilter className="hidden md:inline-flex" members={brigade.members} selected={brigade.selected} onToggle={brigade.toggle} />
                    ) : null}
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    sort={brigade.active ? (
                        <BrigadeMemberFilter members={brigade.members} selected={brigade.selected} onToggle={brigade.toggle} />
                    ) : null}
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
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Не удалось прочитать ОСНТ.</p>
            ) : showEmpty ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">За выбранный период операций ОСНТ нет.</p>
            ) : (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <BonusDetailTableFrame minWidthClass="min-w-0 sm:min-w-[40rem]">
                        <div className={cn(detailHeaderClass, "flex items-center justify-between", osntWideColumns)}>
                            <span>Дата</span>
                            <span className="hidden sm:block">Расчёт</span>
                            <span className={detailAmountClass}>Премия</span>
                        </div>
                        {rows.length === 0 ? (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                        ) : rows.map((line) => (
                            <div key={line.id} data-scroll-row="" className={cn(detailRowClass, "flex items-center justify-between gap-2", osntWideColumns)}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium tabular-nums">{line.day}</span>
                                    {line.employeeName ? <span className="block truncate text-xs text-muted-foreground">{line.employeeName}</span> : null}
                                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{line.calculation}</span>
                                </span>
                                <span className="hidden min-w-0 truncate text-muted-foreground sm:block">{line.calculation}</span>
                                <span className={detailAmountClass}>{formatMoney(line.amount)}</span>
                            </div>
                        ))}
                    </BonusDetailTableFrame>
                </div>
            )}
        </BonusDetailShell>
    );
}
