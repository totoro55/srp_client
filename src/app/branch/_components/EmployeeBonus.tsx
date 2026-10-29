"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { KtuMark } from "./ktu-mark";
import {
    basketGroups,
    branchMonth,
    brigadeName,
    employeeById,
    fixedPremium,
    formatMoney,
    inCalculation,
    lineSum,
    periodLines,
    roleCaption,
    withBranchQuery,
} from "./mock";

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
    const participating = inCalculation(employee, roleId);
    const lines = participating ? periodLines(employee.id, period, month.calculated) : [];
    const groups = basketGroups(lines);
    const brigade = brigadeName(employee.id, slice.savedBrigades, participating);

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                        {employee.name}
                        <KtuMark ktu={employee.ktu} />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{employee.title}</p>
                </CardHeader>
                <CardContent>
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Fact label="Роль" value={roleCaption(employee, roleId)} />
                        <Fact label="Бригада" value={brigade ?? "Вне расчёта"} />
                        <Fact label="Уровень" value={String(employee.level)} />
                        <Fact label="Уровень оплаты труда" value={formatMoney(employee.payLevel)} />
                        <Fact label="Часовая ставка" value={formatMoney(employee.hourly)} />
                        <Fact label="Фиксированная премия" value={formatMoney(fixedPremium(employee))} />
                    </dl>
                </CardContent>
            </Card>
            {!participating ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Сотрудник в этом месяце вне расчёта.</p>
            ) : !month.calculated ? (
                <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Расчёт за этот месяц ещё не готов.</p>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-2xl font-semibold tabular-nums">{formatMoney(lineSum(lines))}</p>
                        <Link href={withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period)} className={buttonVariants({ size: "sm", variant: "outline" })}>
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
                                    </CardHeader>
                                    <CardContent className="text-muted-foreground">{group.summary}</CardContent>
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
            <dd>{value}</dd>
        </div>
    );
}
