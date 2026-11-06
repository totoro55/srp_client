"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { cn } from "@/lib/utils";
import { useBranchDirectory } from "./branch-directory";
import { findStaffSegment, fixedPremium, formatHourlyRate, formatHours, roleKey, salaryFromTimesheet } from "./staff";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { EmployeeNameLine, StaffSegmentNote } from "./EmployeeMovementMark";
import { KtuMark } from "./ktu-mark";
import { formatMoney, inCalculation, roleCaption, withBranchQuery } from "./mock";

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
    const salePremium = directory.salePremiums[roleKey(employee)];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                        <EmployeeNameLine name={employee.name} movement={employee.movement} movementOn={employee.movementOn} markClassName="px-1.5 py-0.5 text-xs" />
                        <span className={cn("inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-sm font-medium", ROLE_MARK[role] ?? "bg-muted text-foreground")}>
                            {role}
                        </span>
                    </CardTitle>
                    <StaffSegmentNote partial={employee.partial} from={employee.activeFrom} until={employee.activeUntil} />
                    <p className="text-sm text-muted-foreground">
                        {employee.title || "Должность не указана"}
                        {employee.probation ? " · испытательный срок" : ""}
                    </p>
                </CardHeader>
                <CardContent>
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs text-muted-foreground">КТУ</dt>
                            <dd><KtuMark ktu={employee.ktu} /></dd>
                        </div>
                        <Fact label="Уровень оплаты труда" value={employee.payLevel === null ? "—" : formatMoney(employee.payLevel)} />
                        <Fact label="Часовая ставка" value={formatHourlyRate(employee.hourly)} />
                        <Fact label="График, ч" value={formatHours(employee.scheduleHours)} />
                        <Fact label="Табель, ч" value={formatHours(employee.timesheetHours)} />
                        <Fact label="Оклад" value={salary === null ? "—" : formatMoney(salary)} />
                        <Fact label="Фиксированная премия" value={premium === null ? "—" : formatMoney(premium)} />
                        <Fact label="Продажа товара" value={salePremium === undefined ? "—" : formatMoney(salePremium)} />
                        <Fact label="В расчёте" value={participating ? "Да" : "Нет"} />
                    </dl>
                </CardContent>
            </Card>
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
