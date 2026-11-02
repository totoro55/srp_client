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
    detailGridDoc,
    detailGridWarranty,
    detailHeaderClass,
    detailRowClass,
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
            {withExtras ? (
                <BonusDetailTableFrame minWidthClass="min-w-[34rem] sm:min-w-[48rem]">
                    <div className={cn(detailGridWarranty, detailHeaderClass)}>
                        <BonusDetailSortHeader label="Документ" sortKey="date" sort={sort} onToggle={toggle} />
                        <BonusDetailSortHeader label="Товар" sortKey="product" sort={sort} onToggle={toggle} />
                        <BonusDetailSortHeader label="Расчёт" sortKey="calculation" sort={sort} onToggle={toggle} />
                        <BonusDetailSortHeader label="Премия" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    </div>
                    {rows.length === 0 ? (
                        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                    ) : (
                        pageRows.map((row) => (
                            <div key={row.id} className={cn(detailGridWarranty, detailRowClass)}>
                                <span className="min-w-0 truncate font-medium">{row.documentTitle}</span>
                                <span className="min-w-0 truncate text-muted-foreground">{row.productTitle}</span>
                                <span className="min-w-0 truncate text-muted-foreground">{row.calculation}</span>
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
