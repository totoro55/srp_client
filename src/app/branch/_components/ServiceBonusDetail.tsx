"use client";

import { useMemo, useState } from "react";
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
    useResetWhenChanged,
} from "./BonusDetailPager";
import {
    detailAmountClass,
    detailChevronClass,
    detailGridDual,
    detailGridSingle,
    detailHeaderClass,
    detailModeToggleClass,
    detailModeToggleItemClass,
    detailNestedClass,
    detailNestedRowClass,
    detailRowClass,
} from "./bonus-detail-ui";
import {
    formatMoney,
    serviceOperationDetail,
    type ServiceCatalogKind,
    type ServiceDetailGroup,
    type ServiceDetailLine,
} from "./mock";

type GroupMode = "service" | "document";

export function ServiceBonusDetail({
    employeeId,
    period,
    kind,
}: {
    employeeId: string;
    period: string;
    kind: ServiceCatalogKind;
}) {
    const detail = serviceOperationDetail(employeeId, period, kind);
    const [mode, setMode] = useState<GroupMode>("service");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const { sort, setSort, toggle } = useBonusDetailSort("amount", "desc");
    const emptyLabel = kind === "kbt" ? "Нет данных по услугам КБТ." : "Нет данных по услугам.";

    useResetWhenChanged(mode, () => {
        setSort({ key: mode === "document" ? "date" : "amount", dir: "desc" });
        setOpenIds([]);
        setQuery("");
    });

    const serviceLines = useMemo(() => {
        if (!detail || mode !== "service") return [];
        const lines = detail.byService.flatMap((group) => group.lines);
        const filtered = filterDetailItems(
            lines,
            query,
            (line) => `${line.serviceTitle} ${line.saleCalculation} ${line.provisionCalculation}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (line) => line.serviceTitle,
            sale: (line) => line.saleAmount,
            provision: (line) => line.provisionAmount,
            amount: (line) => line.amount,
        });
    }, [detail, mode, query, sort]);

    const documentGroups = useMemo(() => {
        if (!detail || mode !== "document") return [];
        const filtered = filterDetailItems(
            detail.byDocument,
            query,
            (group) => `${group.title} ${group.lines.map((line) => `${line.serviceTitle} ${line.saleCalculation} ${line.provisionCalculation}`).join(" ")}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (group) => group.title,
            date: (group) => parseDetailDate(group.title),
            sale: (group) => group.saleAmount,
            provision: (group) => group.provisionAmount,
            amount: (group) => group.amount,
        });
    }, [detail, mode, query, sort]);

    const itemCount = mode === "service" ? serviceLines.length : documentGroups.length;
    const pager = useBonusDetailPagination(itemCount, `${kind}-${mode}-${sort.key}-${sort.dir}-${query}`);
    const pageLines = serviceLines.slice(pager.start, pager.end);
    const pageGroups = documentGroups.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
    }

    const withProvision = detail.hasProvision;
    const grid = withProvision ? detailGridDual : detailGridSingle;

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
                                if (next === "service" || next === "document") {
                                    setMode(next);
                                }
                            }}
                            aria-label={kind === "kbt" ? "Группировка услуг КБТ" : "Группировка услуг"}
                            className={detailModeToggleClass}
                        >
                            <ToggleGroupItem value="service" className={detailModeToggleItemClass}>По услугам</ToggleGroupItem>
                            <ToggleGroupItem value="document" className={detailModeToggleItemClass}>По документам</ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    sort={(
                        <BonusDetailSortButton
                            sort={sort}
                            onToggle={toggle}
                            options={[
                                { key: mode === "document" ? "date" : "title", label: mode === "service" ? detail.rowLabel : "Документ" },
                                ...(withProvision
                                    ? [
                                        { key: "sale", label: "Продажа" },
                                        { key: "provision", label: "Оказание" },
                                    ]
                                    : [{ key: "sale", label: "Расчёт" }]),
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
            <BonusDetailTableFrame minWidthClass={withProvision ? "min-w-[36rem] sm:min-w-[52rem]" : "min-w-[30rem] sm:min-w-[42rem]"}>
                <div className={cn(grid, detailHeaderClass)}>
                    <BonusDetailSortHeader
                        label={mode === "service" ? detail.rowLabel : "Документ"}
                        sortKey={mode === "document" ? "date" : "title"}
                        sort={sort}
                        onToggle={toggle}
                    />
                    {withProvision ? (
                        <>
                            <BonusDetailSortHeader label="Расчёт за продажу" sortKey="sale" sort={sort} onToggle={toggle} />
                            <BonusDetailSortHeader label="Расчёт за оказание" sortKey="provision" sort={sort} onToggle={toggle} />
                        </>
                    ) : (
                        <BonusDetailSortHeader label="Расчёт за продажу" sortKey="sale" sort={sort} onToggle={toggle} />
                    )}
                    <BonusDetailSortHeader label="Сумма" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    <span />
                </div>
                {itemCount === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                ) : mode === "service" ? (
                    pageLines.map((line) => (
                        <ServiceCalcRow key={line.id} line={line} withProvision={withProvision} title={line.serviceTitle} />
                    ))
                ) : (
                    pageGroups.map((group) => (
                        <ServiceDocumentGroup
                            key={group.id}
                            group={group}
                            withProvision={withProvision}
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

function ServiceDocumentGroup({
    group,
    withProvision,
    open,
    onOpenChange,
}: {
    group: ServiceDetailGroup;
    withProvision: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const grid = withProvision ? detailGridDual : detailGridSingle;
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger className={cn(grid, detailRowClass, "text-left hover:bg-muted/50")}>
                <span className="min-w-0 truncate font-medium">{group.title}</span>
                {withProvision ? (
                    <>
                        <span className="tabular-nums text-muted-foreground">{formatMoney(group.saleAmount)}</span>
                        <span className="tabular-nums text-muted-foreground">{formatMoney(group.provisionAmount)}</span>
                    </>
                ) : (
                    <span className="truncate text-muted-foreground">
                        {open ? "Скрыть строки" : `${group.lines.length} ${linesWord(group.lines.length)}`}
                    </span>
                )}
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className={detailNestedClass}>
                    {group.lines.map((line) => (
                        <ServiceCalcRow key={line.id} line={line} withProvision={withProvision} title={line.serviceTitle} nested />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function ServiceCalcRow({
    line,
    withProvision,
    title,
    nested = false,
}: {
    line: ServiceDetailLine;
    withProvision: boolean;
    title: string;
    nested?: boolean;
}) {
    const rowClass = nested ? detailNestedRowClass : detailRowClass;
    if (!withProvision) {
        return (
            <div className={cn(detailGridSingle, rowClass)}>
                <span className="min-w-0 truncate font-medium">{title}</span>
                <span className="min-w-0 truncate text-muted-foreground">{line.saleCalculation}</span>
                <span className={detailAmountClass}>{formatMoney(line.amount)}</span>
                <span />
            </div>
        );
    }

    return (
        <div className={cn(detailGridDual, rowClass)}>
            <span className="min-w-0 truncate font-medium">{title}</span>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{line.saleCalculation}</p>
                <p className="tabular-nums">{formatMoney(line.saleAmount)}</p>
            </div>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{line.provisionCalculation}</p>
                <p className="tabular-nums">{formatMoney(line.provisionAmount)}</p>
            </div>
            <span className={detailAmountClass}>{formatMoney(line.amount)}</span>
            <span />
        </div>
    );
}

function linesWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "строка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "строки";
    return "строк";
}
