"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { PageHeading } from "@/app/_components/header/page-heading";
import { cn } from "@/lib/utils";
import { BRANCHES, branchById, employeeById, withBranchQuery } from "./mock";

export function BranchFrame({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useParams<{ employeeId?: string }>();
    const requestedBranch = searchParams.get("branch");
    const branchId = BRANCHES.some((item) => item.id === requestedBranch) ? requestedBranch ?? "lenina" : "lenina";
    const requestedPeriod = searchParams.get("period");
    const period = /^\d{4}-\d{2}-01$/.test(requestedPeriod ?? "") ? requestedPeriod ?? "2026-10-01" : "2026-10-01";
    const branch = branchById(branchId);
    const employeeId = typeof params.employeeId === "string" ? params.employeeId : null;
    const employee = employeeId ? employeeById(employeeId) : null;
    const onLines = pathname.endsWith("/lines");
    const settingsActive = pathname === "/branch";
    const bonusesActive = pathname.startsWith("/branch/bonuses");

    useEffect(() => {
        if (!employeeId) {
            return;
        }
        if (!employee || employee.branchId !== branchId) {
            router.replace(withBranchQuery("/branch/bonuses", branchId, period));
        }
    }, [branchId, employee, employeeId, period, router]);

    function replaceQuery(nextBranch: string, nextPeriod: string) {
        const part = searchParams.get("part");
        const path = pathname.startsWith("/branch/bonuses/") && employee && employee.branchId !== nextBranch
            ? "/branch/bonuses"
            : pathname;
        router.replace(withBranchQuery(path, nextBranch, nextPeriod, path.endsWith("/lines") ? part : null));
    }

    const trail = employee
        ? [
            { href: withBranchQuery("/branch", branchId, period), label: "Настройки филиала", compactLabel: "Настройки" },
            { href: withBranchQuery("/branch/bonuses", branchId, period), label: "Премии" },
            onLines
                ? { href: withBranchQuery(`/branch/bonuses/${employee.id}`, branchId, period), label: employee.name }
                : { label: employee.name },
            ...(onLines ? [{ label: "Детализация" }] : []),
        ]
        : null;

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            {trail ? <PageHeading trail={trail} /> : null}
            <div className="flex max-w-full flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    <Link href={withBranchQuery("/branch", branchId, period)} className={cn(buttonVariants({ size: "sm", variant: settingsActive ? "secondary" : "ghost" }))}>
                        Настройки
                    </Link>
                    <Link href={withBranchQuery("/branch/bonuses", branchId, period)} className={cn(buttonVariants({ size: "sm", variant: bonusesActive ? "secondary" : "ghost" }))}>
                        Премии
                    </Link>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Период</span>
                    <Input
                        type="month"
                        aria-label="Период"
                        value={period.slice(0, 7)}
                        className="h-8 w-40 px-2"
                        onChange={(event) => {
                            const month = event.target.value;
                            if (!month) {
                                return;
                            }
                            replaceQuery(branchId, `${month}-01`);
                        }}
                    />
                </label>
                <Badge variant="outline">{period < "2026-10-01" ? "Закрыт" : "Открыт"}</Badge>
                <Select value={branchId} onValueChange={(value) => { if (value) replaceQuery(value, period); }}>
                    <SelectTrigger className="h-8 w-56" aria-label="Филиал">
                        <SelectValue>
                            {(value) => branchById(typeof value === "string" ? value : branchId)?.name ?? branch?.name}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {BRANCHES.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                                {item.name} · {item.own ? "свой" : "выдан"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {branch ? <span className="text-sm text-muted-foreground">{branch.territory}</span> : null}
                <Badge variant="secondary">Пример</Badge>
            </div>
            {children}
        </div>
    );
}

export function useBranchLocation(): { branchId: string; period: string } {
    const searchParams = useSearchParams();
    const requestedBranch = searchParams.get("branch");
    const branchId = BRANCHES.some((item) => item.id === requestedBranch) ? requestedBranch ?? "lenina" : "lenina";
    const requestedPeriod = searchParams.get("period");
    const period = /^\d{4}-\d{2}-01$/.test(requestedPeriod ?? "") ? requestedPeriod ?? "2026-10-01" : "2026-10-01";
    return { branchId, period };
}
