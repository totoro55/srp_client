"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
    detailChevronClass,
    detailGridDual,
    detailHeaderClass,
    detailModeToggleClass,
    detailModeToggleItemClass,
    detailNestedClass,
    detailNestedRowClass,
    detailRowClass,
} from "./bonus-detail-ui";
import {
    formatMoney,
    issueOperationDetail,
    pickingOperationDetail,
    type IssueDetailGroup,
    type IssueDetailLine,
    type IssueOperationDetail,
} from "./mock";

type GroupMode = "category" | "document";
type QuantityKind = "issue" | "picking";

export function IssueBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    return (
        <QuantityVolumeBonusDetail
            employeeId={employeeId}
            period={period}
            kind="issue"
            emptyLabel="Нет данных по выдаче."
            quantityHeader="Расчёт премии за выдачу"
            volumeHeader="Расчёт премии за объём"
            ariaLabel="Группировка выдачи"
            searchPlaceholder="Поиск по выдаче"
        />
    );
}

export function PickingBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    return (
        <QuantityVolumeBonusDetail
            employeeId={employeeId}
            period={period}
            kind="picking"
            emptyLabel="Нет данных по набору товара."
            quantityHeader="Расчёт премии за количество"
            volumeHeader="Расчёт премии за объём"
            ariaLabel="Группировка набора товара"
            searchPlaceholder="Поиск по набору"
        />
    );
}

function QuantityVolumeBonusDetail({
    employeeId,
    period,
    kind,
    emptyLabel,
    quantityHeader,
    volumeHeader,
    ariaLabel,
    searchPlaceholder,
}: {
    employeeId: string;
    period: string;
    kind: QuantityKind;
    emptyLabel: string;
    quantityHeader: string;
    volumeHeader: string;
    ariaLabel: string;
    searchPlaceholder: string;
}) {
    const detail: IssueOperationDetail | null =
        kind === "picking" ? pickingOperationDetail(employeeId, period) : issueOperationDetail(employeeId, period);
    const [mode, setMode] = useState<GroupMode>("category");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const { sort, setSort, toggle } = useBonusDetailSort("amount", "desc");

    useEffect(() => {
        setSort({ key: mode === "document" ? "date" : "amount", dir: "desc" });
        setOpenIds([]);
        setQuery("");
    }, [mode, setSort]);

    const categoryLines = useMemo(() => {
        if (!detail || mode !== "category") return [];
        const lines = detail.byCategory.flatMap((group) => group.lines);
        const filtered = filterDetailItems(
            lines,
            query,
            (line) => `${line.categoryTitle} ${line.quantityCalculation} ${line.volumeCalculation}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (line) => line.categoryTitle,
            quantity: (line) => line.quantityAmount,
            volume: (line) => line.volumeAmount,
            amount: (line) => line.amount,
        });
    }, [detail, mode, query, sort]);

    const documentGroups = useMemo(() => {
        if (!detail || mode !== "document") return [];
        const filtered = filterDetailItems(
            detail.byDocument,
            query,
            (group) => `${group.title} ${group.lines.map((line) => `${line.categoryTitle} ${line.quantityCalculation} ${line.volumeCalculation}`).join(" ")}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (group) => group.title,
            date: (group) => parseDetailDate(group.title),
            quantity: (group) => group.quantityAmount,
            volume: (group) => group.volumeAmount,
            amount: (group) => group.amount,
        });
    }, [detail, mode, query, sort]);

    const itemCount = mode === "category" ? categoryLines.length : documentGroups.length;
    const pager = useBonusDetailPagination(itemCount, `${kind}-${mode}-${sort.key}-${sort.dir}-${query}`);
    const pageLines = categoryLines.slice(pager.start, pager.end);
    const pageGroups = documentGroups.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    const categoryModeLabel = /издел/i.test(detail.rowLabel) ? "По изделиям" : "По категориям";

    return (
        <BonusDetailShell
            measureRef={pager.measureRef}
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
                            aria-label={ariaLabel}
                            className={detailModeToggleClass}
                        >
                            <ToggleGroupItem value="category" className={detailModeToggleItemClass}>{categoryModeLabel}</ToggleGroupItem>
                            <ToggleGroupItem value="document" className={detailModeToggleItemClass}>По документам</ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    sort={(
                        <BonusDetailSortButton
                            sort={sort}
                            onToggle={toggle}
                            options={[
                                { key: mode === "document" ? "date" : "title", label: mode === "category" ? detail.rowLabel : "Документ" },
                                { key: "quantity", label: quantityHeader },
                                { key: "volume", label: volumeHeader },
                                { key: "amount", label: "Сумма" },
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
                    total={itemCount}
                    onPageChange={pager.setPage}
                />
            ) : null}
        >
            <BonusDetailTableFrame minWidthClass="min-w-[36rem] sm:min-w-[52rem]">
                <div className={cn(detailGridDual, detailHeaderClass)}>
                    <BonusDetailSortHeader
                        label={mode === "category" ? detail.rowLabel : "Документ"}
                        sortKey={mode === "document" ? "date" : "title"}
                        sort={sort}
                        onToggle={toggle}
                    />
                    <BonusDetailSortHeader label={quantityHeader} sortKey="quantity" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label={volumeHeader} sortKey="volume" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Сумма" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    <span />
                </div>
                {itemCount === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                ) : mode === "category" ? (
                    pageLines.map((line) => (
                        <IssueCalcRow key={line.id} line={line} title={line.categoryTitle} />
                    ))
                ) : (
                    pageGroups.map((group) => (
                        <IssueDocumentGroup
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
        </BonusDetailShell>
    );
}

function IssueDocumentGroup({
    group,
    open,
    onOpenChange,
}: {
    group: IssueDetailGroup;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger className={cn(detailGridDual, detailRowClass, "text-left hover:bg-muted/50")}>
                <span className="min-w-0 truncate font-medium">{group.title}</span>
                <span className="tabular-nums text-muted-foreground">{formatMoney(group.quantityAmount)}</span>
                <span className="tabular-nums text-muted-foreground">{formatMoney(group.volumeAmount)}</span>
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className={detailNestedClass}>
                    {group.lines.map((line) => (
                        <IssueCalcRow key={line.id} line={line} title={line.categoryTitle} nested />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function IssueCalcRow({
    line,
    title,
    nested = false,
}: {
    line: IssueDetailLine;
    title: string;
    nested?: boolean;
}) {
    return (
        <div className={cn(detailGridDual, nested ? detailNestedRowClass : detailRowClass)}>
            <span className="min-w-0 truncate font-medium">{title}</span>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{line.quantityCalculation}</p>
                <p className="tabular-nums">{formatMoney(line.quantityAmount)}</p>
            </div>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{line.volumeCalculation}</p>
                <p className="tabular-nums">{formatMoney(line.volumeAmount)}</p>
            </div>
            <span className={detailAmountClass}>{formatMoney(line.amount)}</span>
            <span />
        </div>
    );
}
