"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    detailGridSales,
    detailHeaderClass,
    detailModeToggleClass,
    detailModeToggleItemClass,
    detailNestedClass,
    detailNestedRowClass,
    detailRowClass,
} from "./bonus-detail-ui";
import {
    formatMoney,
    salesOperationDetail,
    type SalesDetailGroup,
    type SalesDetailLine,
} from "./mock";

type GroupMode = "category" | "document";

const CHANNEL_BADGE: Record<string, string> = {
    "СТМ": "border-sky-700/20 bg-sky-600/15 text-sky-800 dark:border-sky-300/25 dark:bg-sky-400/15 dark:text-sky-200",
    "не СТМ": "border-violet-700/20 bg-violet-600/15 text-violet-800 dark:border-violet-300/25 dark:bg-violet-400/15 dark:text-violet-200",
    "ИМ": "border-amber-700/20 bg-amber-600/15 text-amber-900 dark:border-amber-300/25 dark:bg-amber-400/15 dark:text-amber-200",
    "Безнал": "border-emerald-700/20 bg-emerald-600/15 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/15 dark:text-emerald-200",
};

export function SalesBonusDetail({ employeeId, period }: { employeeId: string; period: string }) {
    const detail = salesOperationDetail(employeeId, period);
    const [mode, setMode] = useState<GroupMode>("category");
    const [openIds, setOpenIds] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const { sort, setSort, toggle } = useBonusDetailSort("amount", "desc");

    useResetWhenChanged(mode, () => {
        setSort({ key: mode === "document" ? "date" : "amount", dir: "desc" });
        setOpenIds([]);
        setQuery("");
    });

    const groups = useMemo(() => {
        if (!detail) return [];
        const source = mode === "category" ? detail.byCategory : detail.byDocument;
        const filtered = filterDetailItems(
            source,
            query,
            (group) => `${group.title} ${group.lines.map((line) => `${line.categoryTitle} ${line.channel} ${line.calculation}`).join(" ")}`,
        );
        return sortDetailItems(filtered, sort, {
            title: (group) => group.title,
            date: (group) => parseDetailDate(group.title),
            amount: (group) => group.amount,
            channel: (group) => group.lines[0]?.channel ?? "",
            calculation: (group) => group.lines.map((line) => line.calculation).join(" "),
        });
    }, [detail, mode, query, sort]);

    const pager = useBonusDetailPagination(groups.length, `${mode}-${sort.key}-${sort.dir}-${query}`);
    const pageGroups = groups.slice(pager.start, pager.end);

    if (!detail) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Нет данных по продажам.</p>;
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
                            aria-label="Группировка продаж"
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
                                { key: "channel", label: "Вид" },
                                { key: "calculation", label: "Расчёт" },
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
                    total={groups.length}
                    onPageChange={pager.setPage}
                />
            ) : null}
        >
            <BonusDetailTableFrame minWidthClass="min-w-[34rem] sm:min-w-[48rem]">
                <div className={cn(detailGridSales, detailHeaderClass)}>
                    <BonusDetailSortHeader
                        label={mode === "category" ? detail.rowLabel : "Документ"}
                        sortKey={mode === "document" ? "date" : "title"}
                        sort={sort}
                        onToggle={toggle}
                    />
                    <BonusDetailSortHeader label="Вид" sortKey="channel" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Расчёт" sortKey="calculation" sort={sort} onToggle={toggle} />
                    <BonusDetailSortHeader label="Сумма" sortKey="amount" sort={sort} onToggle={toggle} align="end" className={detailAmountClass} />
                    <span />
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
    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="border-b last:border-b-0">
            <CollapsibleTrigger className={cn(detailGridSales, detailRowClass, "text-left hover:bg-muted/50")}>
                <span className="min-w-0 truncate font-medium">{group.title}</span>
                <span className="text-muted-foreground">—</span>
                <span className="min-w-0 truncate text-muted-foreground">
                    {open ? "Скрыть строки" : `${group.lines.length} ${linesWord(group.lines.length)}`}
                </span>
                <span className={detailAmountClass}>{formatMoney(group.amount)}</span>
                <ChevronDown className={cn(detailChevronClass, open && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul className={detailNestedClass}>
                    {group.lines.map((line) => (
                        <SalesLineRow key={line.id} line={line} />
                    ))}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
}

function SalesLineRow({ line }: { line: SalesDetailLine }) {
    return (
        <li className={cn(detailGridSales, detailNestedRowClass)}>
            <span className="min-w-0 truncate font-medium">{line.categoryTitle}</span>
            <SalesChannelBadge channel={line.channel} />
            <span className="min-w-0 truncate text-muted-foreground">{line.calculation}</span>
            <span className={detailAmountClass}>{formatMoney(line.amount)}</span>
            <span />
        </li>
    );
}

function SalesChannelBadge({ channel }: { channel: string }) {
    return (
        <Badge
            variant="outline"
            className={cn("h-5 rounded-md px-1.5 font-medium", CHANNEL_BADGE[channel] ?? "bg-muted text-foreground")}
        >
            {channel}
        </Badge>
    );
}

function linesWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "строка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "строки";
    return "строк";
}
