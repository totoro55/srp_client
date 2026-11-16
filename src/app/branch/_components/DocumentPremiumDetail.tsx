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
    filterDetailItems,
    parseDetailDate,
    sortDetailItems,
    useBonusDetailPagination,
    useBonusDetailSort,
} from "./BonusDetailPager";
import {
    detailAmountClass,
    detailGridDoc,
    detailGridWarranty,
    detailHeaderClass,
    detailRowClass,
    detailWideCell,
} from "./bonus-detail-ui";
import { documentPremiumDetail, formatMoney, type DocumentPremiumKind } from "./mock";

export function DocumentPremiumDetail({
    employeeId,
    period,
    kind,
}: {
    employeeId: string;
    period: string;
    kind: DocumentPremiumKind;
}) {
    const detail = documentPremiumDetail(employeeId, period, kind);
    const [query, setQuery] = useState("");
    const { sort, toggle } = useBonusDetailSort("date", "desc");
    const emptyLabel =
        kind === "warranty" ? "Нет данных по доп. гарантии."
            : kind === "delivery" ? "Нет данных по доставке."
                : kind === "sim" ? "Нет данных по сим-картам."
                    : "Нет данных по кредитам.";
    const withExtras = kind === "warranty";

    const rows = useMemo(() => {
        if (!detail) return [];
        const filtered = filterDetailItems(
            detail.rows,
            query,
            (row) => `${row.documentTitle} ${row.productTitle ?? ""} ${row.calculation ?? ""}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (row) => row.documentTitle,
            date: (row) => parseDetailDate(row.documentTitle),
            product: (row) => row.productTitle ?? "",
            calculation: (row) => row.calculation ?? "",
            amount: (row) => row.amount,
        });
    }, [detail, query, sort]);

    const pager = useBonusDetailPagination(rows.length, `${kind}-${sort.key}-${sort.dir}-${query}`);
    const pageRows = rows.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
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
                            options={withExtras
                                ? [
                                    { key: "date", label: "Документ" },
                                    { key: "product", label: "Товар" },
                                    { key: "calculation", label: "Расчёт" },
                                    { key: "amount", label: "Премия" },
                                ]
                                : [
                                    { key: "date", label: "Документ" },
                                    { key: "amount", label: "Премия" },
                                ]}
                        />
                    )}
                    total={null}
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
            {withExtras ? (
                <BonusDetailTableFrame minWidthClass="min-w-0 sm:min-w-[48rem]">
                    <div className={cn(detailGridWarranty, detailHeaderClass)}>
                        <BonusDetailSortHeader label="Документ" sortKey="date" sort={sort} onToggle={toggle} />
                        <BonusDetailSortHeader label="Товар" sortKey="product" sort={sort} onToggle={toggle} className={detailWideCell} />
                        <BonusDetailSortHeader label="Расчёт" sortKey="calculation" sort={sort} onToggle={toggle} className={detailWideCell} />
                        <BonusDetailSortHeader label="Премия" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    </div>
                    {rows.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                    ) : (
                        pageRows.map((row) => (
                            <div key={row.id} className={cn(detailGridWarranty, detailRowClass)}>
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">{row.documentTitle}</span>
                                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{row.productTitle}</span>
                                    <span className="block truncate text-xs text-muted-foreground sm:hidden">{row.calculation}</span>
                                </span>
                                <span className={cn("truncate text-muted-foreground", detailWideCell)}>{row.productTitle}</span>
                                <span className={cn("truncate text-muted-foreground", detailWideCell)}>{row.calculation}</span>
                                <span className={detailAmountClass}>{formatMoney(row.amount)}</span>
                            </div>
                        ))
                    )}
                </BonusDetailTableFrame>
            ) : (
                <BonusDetailTableFrame minWidthClass="min-w-0">
                    <div className={cn(detailGridDoc, detailHeaderClass)}>
                        <BonusDetailSortHeader label="Документ" sortKey="date" sort={sort} onToggle={toggle} />
                        <BonusDetailSortHeader label="Премия" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    </div>
                    {rows.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                    ) : (
                        pageRows.map((row) => (
                            <div key={row.id} className={cn(detailGridDoc, detailRowClass)}>
                                <span className="min-w-0 truncate font-medium">{row.documentTitle}</span>
                                <span className={detailAmountClass}>{formatMoney(row.amount)}</span>
                            </div>
                        ))
                    )}
                </BonusDetailTableFrame>
            )}
        </BonusDetailShell>
    );
}
