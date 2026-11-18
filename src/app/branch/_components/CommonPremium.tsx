"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StackSkeleton } from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { BonusDistributionChart } from "./BonusDistributionChart";
import { useBranchDirectory } from "./branch-directory";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { formatMoney, inCalculation, withBranchQuery, type BasketGroup } from "./mock";
import { formatHours, roleKey, segmentHref } from "./staff";
import { useSharedPremiumAuthors } from "./use-shared-premium-authors";

export function CommonPremium() {
    const { branchId, period } = useBranchLocation();
    const directory = useBranchDirectory();
    const store = useBranchStore();
    const settings = useMotivationRoles();
    const slice = store.slice(branchId, period, directory.employees, settings);
    const authorsState = useSharedPremiumAuthors(branchId, period);
    const authors = authorsState.authors;
    const sale = directory.indicators.find((indicator) => indicator.title === "Продажа товара");
    const release = directory.indicators.find((indicator) => indicator.title === "Выдача товара");
    const kassa = directory.indicators.find((indicator) => indicator.title === "Кассовые операции");
    const osnt = directory.indicators.find((indicator) => indicator.title === "ОСНТ");
    const warehouse = directory.indicators.find((indicator) => indicator.title === "Складские операции");
    const unloading = directory.indicators.find((indicator) => indicator.title === "Разгрузка ТС");
    const selection = directory.indicators.find((indicator) => indicator.title === "Набор товара");
    const saleAmount = authors.reduce((sum, author) => sum + author.sale, 0);
    const releaseAmount = authors.reduce((sum, author) => sum + author.release, 0);
    const kassaAmount = authors.reduce((sum, author) => sum + author.kassa, 0);
    const osntAmount = authors.reduce((sum, author) => sum + author.osnt, 0);
    const warehouseAmount = authors.reduce((sum, author) => sum + author.warehouse, 0);
    const unloadingAmount = authors.reduce((sum, author) => sum + author.unloading, 0);
    const selectionAmount = authors.reduce((sum, author) => sum + author.selection, 0);
    const pool = Math.round((saleAmount + releaseAmount + kassaAmount + osntAmount + warehouseAmount + unloadingAmount + selectionAmount) * 100) / 100;
    const hours = directory.employees.reduce((sum, employee) => {
        const roleId = slice.savedRoles[roleKey(employee)] ?? null;
        if (!inCalculation(employee, roleId)) {
            return sum;
        }
        return sum + (employee.timesheetHours ?? 0);
    }, 0);
    const groups: BasketGroup[] = [];
    if (sale && saleAmount > 0) {
        groups.push({ basketId: sale.id, title: sale.title, amount: saleAmount, facts: [] });
    }
    if (release && releaseAmount > 0) {
        groups.push({ basketId: release.id, title: release.title, amount: releaseAmount, facts: [] });
    }
    if (kassa && kassaAmount > 0) {
        groups.push({ basketId: kassa.id, title: kassa.title, amount: kassaAmount, facts: [] });
    }
    if (osnt && osntAmount > 0) {
        groups.push({ basketId: osnt.id, title: osnt.title, amount: osntAmount, facts: [] });
    }
    if (warehouse && warehouseAmount > 0) {
        groups.push({ basketId: warehouse.id, title: warehouse.title, amount: warehouseAmount, facts: [] });
    }
    if (unloading && unloadingAmount > 0) {
        groups.push({ basketId: unloading.id, title: unloading.title, amount: unloadingAmount, facts: [] });
    }
    if (selection && selectionAmount > 0) {
        groups.push({ basketId: selection.id, title: selection.title, amount: selectionAmount, facts: [] });
    }

    if ((directory.loading && directory.employees.length === 0) || authorsState.loading) {
        return <StackSkeleton />;
    }
    if (directory.error || authorsState.error) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{authorsState.error || directory.error}</p>;
    }
    if (!branchId) {
        return null;
    }

    return (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
            <Card className="h-full min-w-0">
                <CardHeader>
                    <CardTitle>Общая премия</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Учитывает продажи, выдачу, кассу, ОСНТ, склад и разгрузку сотрудников вне расчета сдельной оплаты, промоутеров, автокассы и терминала самообслуживания. Общая премия распределяется между всеми сотрудниками, участвующими в сдельной оплате труда, пропорционально отработанному времени.
                    </p>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-0.5 rounded-lg bg-fuchsia-100 px-3 py-2 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-50">
                            <dt className="text-xs opacity-80">Сумма</dt>
                            <dd className="text-base font-medium tabular-nums">{formatMoney(pool)}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs text-muted-foreground">Часов табеля</dt>
                            <dd className="tabular-nums">{formatHours(hours)}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs text-muted-foreground">Авторов</dt>
                            <dd className="tabular-nums">{authors.length}</dd>
                        </div>
                    </dl>
                </CardContent>
            </Card>
            <div className="h-full min-w-0 lg:col-span-2">
                <BonusDistributionChart
                    groups={groups}
                    authors={authors.map((author) => ({
                        id: `${author.id}:${author.activeFrom}`,
                        name: author.name,
                        amount: authorTotal(author),
                    }))}
                />
            </div>
            {authors.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground lg:col-span-3">
                    В этом месяце в общую премию нечего складывать.
                </p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
                    {authors.map((author) => (
                        <Card key={`${author.id}:${author.activeFrom ?? "month"}`} className="h-full min-w-0">
                            <CardHeader>
                                <CardTitle>{author.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{author.title}</p>
                                <p className="text-lg font-medium tabular-nums">{formatMoney(authorTotal(author))}</p>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">
                                {sale && author.sale > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, sale.id)}
                                        label={sale.title}
                                        amount={author.sale}
                                    />
                                ) : null}
                                {release && author.release > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, release.id)}
                                        label={release.title}
                                        amount={author.release}
                                    />
                                ) : null}
                                {kassa && author.kassa > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, kassa.id)}
                                        label={kassa.title}
                                        amount={author.kassa}
                                    />
                                ) : null}
                                {osnt && author.osnt > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, osnt.id)}
                                        label={osnt.title}
                                        amount={author.osnt}
                                    />
                                ) : null}
                                {warehouse && author.warehouse > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, warehouse.id)}
                                        label={warehouse.title}
                                        amount={author.warehouse}
                                    />
                                ) : null}
                                {unloading && author.unloading > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, unloading.id)}
                                        label={unloading.title}
                                        amount={author.unloading}
                                    />
                                ) : null}
                                {selection && author.selection > 0 ? (
                                    <AuthorLine
                                        href={authorHref(author.id, author.kind === "staff" ? author.activeFrom : null, branchId, period, selection.id)}
                                        label={selection.title}
                                        amount={author.selection}
                                    />
                                ) : null}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

function authorTotal(author: { sale: number; release: number; kassa: number; osnt: number; warehouse: number; unloading: number; selection: number }): number {
    return author.sale + author.release + author.kassa + author.osnt + author.warehouse + author.unloading + author.selection;
}

function authorHref(id: string, activeFrom: string | null, branchId: string, period: string, part: string): string {
    const href = withBranchQuery(`/branch/bonuses/${id}/lines`, branchId, period, part);
    return activeFrom ? segmentHref(href, activeFrom) : href;
}

function AuthorLine({ href, label, amount }: { href: string; label: string; amount: number }) {
    return (
        <Link href={href} className="flex items-center justify-between gap-3 rounded-md px-1 py-1 outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex items-center gap-2 tabular-nums">
                {formatMoney(amount)}
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </span>
        </Link>
    );
}
