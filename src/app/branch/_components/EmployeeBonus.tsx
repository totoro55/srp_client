"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { cn } from "@/lib/utils";
import { BonusDistributionChart } from "./BonusDistributionChart";
import { useBranchDirectory } from "./branch-directory";
import { currentPay, findStaffSegment, fixedPremium, forecastPay, formatHours, roleKey, salaryFromTimesheet, segmentHref } from "./staff";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { EmployeeNameLine, StaffSegmentNote } from "./EmployeeMovementMark";
import {
    basketGroups,
    branchMonth,
    employeeById,
    formatMoney,
    inCalculation,
    periodLines,
    roleCaption,
    withBranchQuery,
    type BasketGroup,
} from "./mock";

const ROLE_MARK: Record<string, string> = {
    "УСМ": "bg-muted text-foreground",
    "СВМ": "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    "Кладовщик": "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    "Мерчендайзер": "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    "Без подписи": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};

export function EmployeeBonus() {
    const router = useRouter();
    const params = useParams<{ employeeId: string }>();
    const searchParams = useSearchParams();
    const { branchId, period } = useBranchLocation();
    const directory = useBranchDirectory();
    const employee = findStaffSegment(directory.employees, params.employeeId, searchParams.get("from"));
    const store = useBranchStore();
    const settings = useMotivationRoles();
    const slice = store.slice(branchId, period, directory.employees, settings);
    const roleId = employee ? slice.savedRoles[roleKey(employee)] ?? null : null;
    const listed = employee !== null && employee.branchId === branchId && roleId !== null;

    useEffect(() => {
        if (directory.loading || !branchId || employee === null || employee.branchId !== branchId) {
            return;
        }
        if (roleId !== null) {
            return;
        }
        router.replace(withBranchQuery("/branch/bonuses", branchId, period));
    }, [branchId, directory.loading, employee, period, roleId, router]);

    if (directory.loading || !listed || employee === null) {
        return null;
    }
    const role = roleCaption(employee, roleId, settings);
    const participating = inCalculation(employee, roleId);
    const salary = salaryFromTimesheet(employee.hourly, employee.timesheetHours);
    const premium = fixedPremium(employee.payLevel, employee.hourly, directory.baseBonus, directory.priceGrowth, employee.timesheetHours);
    const salePremium = directory.salePremiums[roleKey(employee)] ?? 0;
    const releasePremium = directory.releasePremiums[roleKey(employee)] ?? 0;
    const current = currentPay(salary, premium, salePremium + releasePremium);
    const forecast = forecastPay(employee.hourly, employee.payLevel, directory.baseBonus, directory.priceGrowth, employee.scheduleHours, employee.timesheetHours, salePremium + releasePremium);
    const groups = employeeBaskets(employee.id, branchId, period, directory.indicators, directory.salePremiums[roleKey(employee)], directory.releasePremiums[roleKey(employee)]);

    return (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
                <Card className="h-full min-w-0">
                    <CardHeader>
                        <CardTitle>
                            <EmployeeNameLine name={employee.name} movement={employee.movement} movementOn={employee.movementOn} markClassName="px-1.5 py-0.5 text-xs" />
                        </CardTitle>
                        <StaffSegmentNote partial={employee.partial} from={employee.activeFrom} until={employee.activeUntil} />
                        <p className="text-sm text-muted-foreground">
                            {employee.title || "Должность не указана"}
                            {employee.probation ? " · испытательный срок" : ""}
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <dl className="grid grid-cols-2 gap-3">
                            <Fact
                                label="Прогноз ЗП"
                                value={forecast === null ? "—" : formatMoney(forecast)}
                                prominent
                                className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
                            />
                            <Fact
                                label="Текущая ЗП"
                                value={current === null ? "—" : formatMoney(current)}
                                prominent
                                className="rounded-lg bg-teal-100 px-3 py-2 text-teal-950 dark:bg-teal-950 dark:text-teal-50"
                            />
                        </dl>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4">
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs text-muted-foreground">Роль</dt>
                                <dd>
                                    <span className={cn("inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-sm font-medium", ROLE_MARK[role] ?? "bg-muted text-foreground")}>
                                        {role}
                                    </span>
                                </dd>
                            </div>
                            <Fact label="В расчёте" value={participating ? "Да" : "Нет"} />
                            <Fact label="По графику" value={formatHours(employee.scheduleHours)} />
                            <Fact label="По табелю" value={formatHours(employee.timesheetHours)} />
                            <Fact label="Оклад" value={salary === null ? "—" : formatMoney(salary)} />
                            <Fact label="Фиксированная премия" value={premium === null ? "—" : formatMoney(premium)} />
                        </dl>
                    </CardContent>
                </Card>
                <div className="h-full min-w-0 lg:col-span-2">
                    <BonusDistributionChart groups={groups} />
                </div>
            {groups.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
                    {groups.map((group) => (
                        <Link
                            key={group.basketId}
                            href={segmentHref(withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, group.basketId), employee.activeFrom)}
                            className="block h-full min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Card className="h-full transition-colors hover:bg-muted/40">
                                <CardHeader>
                                    <CardTitle>{group.title}</CardTitle>
                                    <p className="text-lg font-medium tabular-nums">{formatMoney(group.amount)}</p>
                                    <CardAction className="self-center">
                                        <ArrowRight className="size-7 text-muted-foreground" aria-hidden />
                                    </CardAction>
                                </CardHeader>
                                {group.facts.length > 0 ? (
                                    <CardContent>
                                        <dl className="grid gap-x-4 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(6.5rem,1fr))]">
                                            {group.facts.map((fact) => (
                                                <div key={fact.label} className="min-w-0">
                                                    <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                                                    <dd className="tabular-nums">{fact.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </CardContent>
                                ) : null}
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function employeeBaskets(
    employeeId: string,
    branchId: string,
    period: string,
    indicators: { id: string; title: string }[],
    salePremium: number | undefined,
    releasePremium: number | undefined,
): BasketGroup[] {
    if (employeeById(employeeId)) {
        return basketGroups(periodLines(employeeId, period, branchMonth(branchId, period).calculated));
    }
    const groups: BasketGroup[] = [];
    const sale = indicators.find((indicator) => indicator.title === "Продажа товара");
    if (sale && salePremium !== undefined) {
        groups.push({ basketId: sale.id, title: sale.title, amount: salePremium, facts: [] });
    }
    const release = indicators.find((indicator) => indicator.title === "Выдача товара");
    if (release && releasePremium !== undefined) {
        groups.push({ basketId: release.id, title: release.title, amount: releasePremium, facts: [] });
    }
    return groups;
}

function Fact({ label, value, prominent = false, className }: { label: string; value: string; prominent?: boolean; className?: string }) {
    return (
        <div className={cn("flex flex-col gap-0.5", className)}>
            <dt className={cn("text-xs", className ? "opacity-80" : "text-muted-foreground")}>{label}</dt>
            <dd className={cn("tabular-nums", prominent && "text-base font-medium")}>{value}</dd>
        </div>
    );
}
