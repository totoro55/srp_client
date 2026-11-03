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
    detailHeaderClass,
    detailModeToggleClass,
    detailModeToggleItemClass,
    detailNestedClass,
    detailNestedRowClass,
    detailRowClass,
} from "./bonus-detail-ui";
import {
    formatMoney,
    warehouseOperationDetail,
    type WarehouseDayGroup,
    type WarehouseDetailRow,
} from "./mock";

type GroupMode = "document" | "day";

export function WarehouseBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const detail = warehouseOperationDetail(employeeId, period);
    const [mode, setMode] = useState<GroupMode>("document");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const { sort, setSort, toggle } = useBonusDetailSort("date", "desc");

    useResetWhenChanged(mode, () => {
        setSort({ key: "date", dir: "desc" });
        setOpenIds([]);
        setQuery("");
    });

    const documentRows = useMemo(() => {
        if (!detail || mode !== "document") return [];
        const filtered = filterDetailItems(
            detail.byDocument,
            query,
            (row) => `${row.title} ${row.day} ${row.quantityCalculation} ${row.volumeCalculation}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (row) => row.title,
            date: (row) => parseDetailDate(`${row.day} ${row.title}`),
            quantity: (row) => row.quantityAmount,
            volume: (row) => row.volumeAmount,
            amount: (row) => row.amount,
        });
    }, [detail, mode, query, sort]);

    const dayGroups = useMemo(() => {
        if (!detail || mode !== "day") return [];
        const filtered = filterDetailItems(
            detail.byDay,
            query,
            (group) => `${group.day} ${group.quantityCalculation} ${group.volumeCalculation} ${group.documents.map((row) => row.title).join(" ")}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (group) => group.day,
            date: (group) => parseDetailDate(group.day),
            quantity: (group) => group.quantityAmount,
            volume: (group) => group.volumeAmount,
            amount: (group) => group.amount,
        });
    }, [detail, mode, query, sort]);

    const itemCount = mode === "document" ? documentRows.length : dayGroups.length;
    const pager = useBonusDetailPagination(itemCount, `${mode}-${sort.key}-${sort.dir}-${query}`);
    const pageDocuments = documentRows.slice(pager.start, pager.end);
    const pageDays = dayGroups.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по складским операциям.</p>;
    }

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
                                if (next === "document" || next === "day") {
                                    setMode(next);
                                }
                            }}
                            aria-label="Группировка складских операций"
                            className={detailModeToggleClass}
                        >
                            <ToggleGroupItem value="document" className={detailModeToggleItemClass}>По документам</ToggleGroupItem>
                            <ToggleGroupItem value="day" className={detailModeToggleItemClass}>По дням</ToggleGroupItem>
                        </ToggleGroup>
                    )}
                    search={<BonusDetailSearch value={query} onChange={setQuery} placeholder="Поиск" />}
                    sort={(
                        <BonusDetailSortButton
                            sort={sort}
                            onToggle={toggle}
                            options={[
                                { key: "date", label: mode === "document" ? "Документ" : "День" },
                                { key: "quantity", label: "Количество" },
                                { key: "volume", label: "Объём" },
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
                        label={mode === "document" ? "Документ" : "День"}
                        sortKey="date"
                        sort={sort}
                        onToggle={toggle}
                    />
                    <BonusDetailSortHeader label="Расчёт за количество" sortKey="quantity" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Расчёт за объём" sortKey="volume" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Сумма" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    <span />
                </div>
                {itemCount === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">Ничего не найдено.</p>
                ) : mode === "document" ? (
                    pageDocuments.map((row) => <WarehouseCalcRow key={row.id} row={row} />)
                ) : (
                    pageDays.map((group) => (
                        <WarehouseDayRow
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

function WarehouseDayRow({
    group,
    open,
    onOpenChange,
}: {
    group: WarehouseDayGroup;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger className={cn(detailGridDual, detailRowClass, "text-left hover:bg-muted/50")}>
                <span className="min-w-0 font-medium tabular-nums">{group.day}</span>
                <div className="min-w-0">
                    <p className="truncate text-muted-foreground">{group.quantityCalculation}</p>
                    <p className="tabular-nums">{formatMoney(group.quantityAmount)}</p>
                </div>
                <div className="min-w-0">
                    <p className="truncate text-muted-foreground">{group.volumeCalculation}</p>
                    <p className="tabular-nums">{formatMoney(group.volumeAmount)}</p>
                </div>
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className={detailNestedClass}>
                    {group.documents.map((row) => (
                        <WarehouseCalcRow key={row.id} row={row} nested hideDay />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function WarehouseCalcRow({
    row,
    nested = false,
    hideDay = false,
}: {
    row: WarehouseDetailRow;
    nested?: boolean;
    hideDay?: boolean;
}) {
    return (
        <div className={cn(detailGridDual, nested ? detailNestedRowClass : detailRowClass)}>
            <div className="min-w-0">
                <p className="truncate font-medium">{row.title}</p>
                {!hideDay ? <p className="text-xs text-muted-foreground">{row.day}</p> : null}
            </div>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{row.quantityCalculation}</p>
                <p className="tabular-nums">{formatMoney(row.quantityAmount)}</p>
            </div>
            <div className="min-w-0">
                <p className="truncate text-muted-foreground">{row.volumeCalculation}</p>
                <p className="tabular-nums">{formatMoney(row.volumeAmount)}</p>
            </div>
            <span className={detailAmountClass}>{formatMoney(row.amount)}</span>
            <span />
        </div>
    );
}
