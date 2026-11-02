"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BonusDistributionChart } from "./BonusDistributionChart";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import {
    basketGroups,
    branchMonth,
    brigadeName,
    employeeById,
    fixedPremium,
    formatMoney,
    inCalculation,
    lineSum,
    payFacts,
    periodLines,
    roleCaption,
    withBranchQuery,
} from "./mock";

const ROLE_MARK: Record<string, string> = {
    "УСМ": "bg-muted text-foreground",
    "СВМ": "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50",
    "Кладовщик": "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-50",
    "Мерчендайзер": "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50",
    "Без подписи": "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
};

export function EmployeeBonus() {
    const params = useParams<{ employeeId: string }>();
    const { branchId, period } = useBranchLocation();
    const employee = employeeById(params.employeeId);
    const store = useBranchStore();
    if (!employee || employee.branchId !== branchId) {
        return null;
    }
    const month = branchMonth(branchId, period);
    const slice = store.slice(branchId, period);
    const roleId = slice.savedRoles[employee.id] ?? null;
    const role = roleCaption(employee, roleId);
    const participating = inCalculation(employee, roleId);
    const lines = participating ? periodLines(employee.id, period, month.calculated) : [];
    const bonus = lineSum(lines);
    const pay = payFacts(employee, period, bonus);
    const fixed = fixedPremium(employee);
    const groups = basketGroups(lines);
    const brigadeOn = slice.savedBrigades.mode !== "off";
    const brigade = brigadeOn ? brigadeName(employee.id, slice.savedBrigades, participating) : null;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                            {employee.name}
                            <span className={cn("inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-sm font-medium", ROLE_MARK[role] ?? "bg-muted text-foreground")}>
                                {role}
                            </span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{employee.title}</p>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <Fact label="Прогноз ЗП" value={formatMoney(pay.forecastPay)} />
                            <Fact label="Текущая ЗП" value={formatMoney(pay.currentPay)} />
                            <Fact label="Фиксированная премия" value={formatMoney(fixed)} />
                            <Fact label="Оклад" value={formatMoney(pay.salary)} />
                            <Fact label="Часов табель / график" value={`${pay.timesheetHours} / ${pay.scheduleHours}`} />
                            {brigade ? <Fact label="Бригада" value={brigade} /> : null}
                        </dl>
                    </CardContent>
                </Card>
                <BonusDistributionChart groups={groups} />
            </div>
            {!participating ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Сотрудник в этом месяце вне расчёта.</p>
            ) : !month.calculated ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Расчёт за этот месяц ещё не готов.</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-2xl font-semibold tabular-nums">
                            <span className="mr-2 text-base font-normal text-muted-foreground">Текущая премия</span>
                            {formatMoney(bonus)}
                        </p>
                        <Link href={withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, groups[0]?.basketId ?? "sales")} className={buttonVariants({ size: "sm", variant: "outline" })}>
                            Вся детализация
                        </Link>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                        {groups.map((group) => (
                            <Link key={group.basketId} href={withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, group.basketId)} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                                <Card className="h-full transition-colors hover:bg-muted/40">
                                    <CardHeader>
                                        <CardTitle>{group.title}</CardTitle>
                                        <p className="text-lg font-medium tabular-nums">{formatMoney(group.amount)}</p>
                                        <CardAction className="self-center">
                                            <ArrowRight className="size-7 text-muted-foreground" aria-hidden="true" />
                                        </CardAction>
                                    </CardHeader>
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
                                </Card>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
        </div>
    );
}
