"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import {
    branchMonth,
    employeeById,
    formatMoney,
    inCalculation,
    lineSum,
    periodLines,
    withBranchQuery,
} from "./mock";

export function BonusLines() {
    const params = useParams<{ employeeId: string }>();
    const searchParams = useSearchParams();
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
    const part = searchParams.get("part");
    const baskets = [...new Map(lines.map((item) => [item.basketId, item.basketTitle])).entries()];
    const knownPart = part !== null && baskets.some(([basketId]) => basketId === part);
    const visible = knownPart ? lines.filter((item) => item.basketId === part) : lines;

    if (!participating) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Сотрудник в этом месяце вне расчёта.</p>;
    }
    if (!month.calculated || lines.length === 0) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Расчёт за этот месяц ещё не готов.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap gap-1">
                <Link href={withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period)} className={cn(buttonVariants({ size: "sm", variant: !knownPart ? "secondary" : "ghost" }))}>
                    Все корзины
                </Link>
                {baskets.map(([basketId, title]) => (
                    <Link
                        key={basketId}
                        href={withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, basketId)}
                        className={cn(buttonVariants({ size: "sm", variant: part === basketId ? "secondary" : "ghost" }))}
                    >
                        {title}
                    </Link>
                ))}
            </div>
            <Table containerClassName="max-w-full">
                <TableHeader>
                    <TableRow>
                        <TableHead>Корзина</TableHead>
                        <TableHead>Основание</TableHead>
                        <TableHead>Расчёт</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visible.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>{item.basketTitle}</TableCell>
                            <TableCell>{item.basis}</TableCell>
                            <TableCell className="whitespace-normal text-muted-foreground">{item.formula}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(item.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3}>Сумма</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(lineSum(visible))}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
