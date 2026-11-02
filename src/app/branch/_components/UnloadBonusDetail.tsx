"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
    BonusDetailPagination,
    BonusDetailSearch,
    BonusDetailShell,
    BonusDetailSortButton,
    BonusDetailSortHeader,
    BonusDetailTableFrame,
    BonusDetailToolbar,
    BonusDetailTotal,
    filterDetailItems,
    parseDetailDate,
    sortDetailItems,
    useBonusDetailPagination,
    useBonusDetailSort,
} from "./BonusDetailPager";
import {
    detailAmountClass,
    detailGridUnload,
    detailHeaderClass,
    detailRowClass,
} from "./bonus-detail-ui";
import { formatMoney, unloadOperationDetail } from "./mock";

export function UnloadBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const detail = unloadOperationDetail(employeeId, period);
    const [query, setQuery] = useState("");
    const { sort, toggle } = useBonusDetailSort("amount", "desc");

    const rows = useMemo(() => {
        if (!detail) return [];
        const filtered = filterDetailItems(
            detail.rows,
            query,
            (row) => `${row.arrivalDay} ${row.calculation} ${row.participants} ${row.totalVolume}`,
        );
        return sortDetailItems(filtered, sort, {
            date: (row) => parseDetailDate(row.arrivalDay),
            volume: (row) => row.totalVolume,
            participants: (row) => row.participants,
            calculation: (row) => row.calculation,
            amount: (row) => row.amount,
        });
    }, [detail, query, sort]);

    const pager = useBonusDetailPagination(rows.length, `${sort.key}-${sort.dir}-${query}`);
    const pageRows = rows.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по разгрузке.</p>;
    }

    return (
        <BonusDetailShell
            measureRef={pager.measureRef}
            toolbar={(
                <BonusDetailToolbar
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    sort={(
                        <BonusDetailSortButton
                            sort={sort}
                            onToggle={toggle}
                            options={[
                                { key: "date", label: "День" },
                                { key: "volume", label: "Объём" },
                                { key: "participants", label: "Участники" },
                                { key: "calculation", label: "Расчёт" },
                                { key: "amount", label: "Премия" },
                            ]}
                        />
                    )}
                    total={<BonusDetailTotal total={detail.total} />}
                />
            )}
            pagination={pager.needsPagination ? (
                <BonusDetailPagination
                    page={pager.page}
                    pageSize={pager.pageSize}
                    total={rows.length}
                    onPageChange={pager.setPage}
                />
            ) : null}
        >
            <BonusDetailTableFrame minWidthClass="min-w-[32rem] sm:min-w-[44rem]">
                <div className={cn(detailGridUnload, detailHeaderClass)}>
                    <BonusDetailSortHeader label="День прихода ТС" sortKey="date" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Общий объём" sortKey="volume" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Участников" sortKey="participants" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Расчёт" sortKey="calculation" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Премия" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                </div>
                {rows.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                ) : (
                    pageRows.map((row) => (
                        <div key={row.id} className={cn(detailGridUnload, detailRowClass)}>
                            <span className="font-medium tabular-nums">{row.arrivalDay}</span>
                            <span className="tabular-nums">
                                {row.totalVolume.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м³
                            </span>
                            <span className="tabular-nums">{row.participants}</span>
                            <span className="min-w-0 truncate text-muted-foreground">{row.calculation}</span>
                            <span className={detailAmountClass}>{formatMoney(row.amount)}</span>
                        </div>
                    ))
                )}
            </BonusDetailTableFrame>
        </BonusDetailShell>
    );
}
