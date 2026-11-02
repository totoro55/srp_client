"use client";

import { useEffect, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeading, usePageHeadingMenu, type PageHeadingCrumb } from "@/app/_components/header/page-heading";
import { cn } from "@/lib/utils";
import { BRANCHES, branchById, dataLoadedAt, employeeById, withBranchQuery } from "./mock";

export function BranchFrame({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useParams<{ employeeId?: string }>();
    const { branchId, period } = useBranchLocation();
    const branch = branchById(branchId);
    const employeeId = typeof params.employeeId === "string" ? params.employeeId : null;
    const employee = employeeId ? employeeById(employeeId) : null;
    const onLines = pathname.endsWith("/lines");
    const bonusList = pathname === "/branch/bonuses";
    const fillViewport = bonusList || onLines;
    const showLoadStatus = pathname.startsWith("/branch/bonuses");

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

    usePageHeadingMenu((key, id) => {
        if (key === "branch") {
            replaceQuery(id, period);
        }
    });

    const branchCrumb: PageHeadingCrumb = {
        label: branch?.name ?? "Филиал",
        menuKey: "branch",
        menuValue: branchId,
        menu: BRANCHES.length > 1
            ? BRANCHES.map((item) => ({ id: item.id, label: `${item.name} · ${item.own ? "свой" : "выдан"}` }))
            : undefined,
    };
    const trail: PageHeadingCrumb[] = employee
        ? [
            { href: withBranchQuery("/branch/bonuses", branchId, period), label: "Кабинет филиала", compactLabel: "Кабинет" },
            branchCrumb,
            onLines
                ? { href: withBranchQuery(`/branch/bonuses/${employee.id}`, branchId, period), label: employee.name }
                : { label: employee.name },
            ...(onLines ? [{ label: "Детализация" }] : []),
        ]
        : pathname.startsWith("/branch/tariffs/sales")
            ? [
                { href: withBranchQuery("/branch/tariffs", branchId, period), label: "Тарифы" },
                branchCrumb,
                { label: "Продажа товара" },
            ]
            : pathname.startsWith("/branch/tariffs/services")
                ? [
                    { href: withBranchQuery("/branch/tariffs", branchId, period, null, "extras"), label: "Тарифы" },
                    branchCrumb,
                    { label: "Услуги" },
                ]
                : pathname.startsWith("/branch/tariffs/kbt")
                    ? [
                        { href: withBranchQuery("/branch/tariffs", branchId, period, null, "extras"), label: "Тарифы" },
                        branchCrumb,
                        { label: "Услуги КБТ" },
                    ]
            : [
                pathname.startsWith("/branch/bonuses")
                    ? { label: "Кабинет филиала", compactLabel: "Кабинет", omitWhenTight: true }
                    : pathname.startsWith("/branch/tariffs")
                        ? { label: "Тарифы" }
                        : { label: "Настройки филиала", compactLabel: "Настройки" },
                branchCrumb,
            ];

    return (
        <div className={cn("flex w-full min-w-0 flex-col gap-4 [@media(max-height:500px)]:gap-2!", fillViewport && "-mb-4 h-[calc(100dvh-5rem)] min-h-0 md:-mb-6 md:h-[calc(100dvh-5.5rem)] [@media(max-height:500px)]:-mb-2! [@media(max-height:500px)]:h-[calc(100dvh-4.5rem)]!")}>
            <PageHeading trail={trail} />
            {bonusList ? null : <BranchPeriodField showLoadStatus={showLoadStatus} />}
            {fillViewport ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
        </div>
    );
}

export function BranchPeriodField({ showLoadStatus = true }: { showLoadStatus?: boolean } = {}) {
    const { branchId, period } = useBranchLocation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <div className="flex w-full min-w-0 shrink-0 items-center gap-1.5 sm:w-auto sm:gap-2">
            <Input
                type="month"
                aria-label="Период"
                value={period.slice(0, 7)}
                className="h-9 min-w-0 flex-1 basis-0 px-2 text-xs sm:w-[9.25rem] sm:flex-none sm:basis-auto md:w-40 md:text-sm [@media(max-height:500px)]:w-[9.25rem]! [@media(max-height:500px)]:flex-none! [@media(max-height:500px)]:basis-auto! [@media(max-height:500px)]:text-xs!"
                onChange={(event) => {
                    const month = event.target.value;
                    if (!month) {
                        return;
                    }
                    const part = searchParams.get("part");
                    router.replace(withBranchQuery(pathname, branchId, `${month}-01`, pathname.endsWith("/lines") ? part : null));
                }}
            />
            {showLoadStatus ? <DataLoadStatus branchId={branchId} period={period} /> : null}
        </div>
    );
}

function formatLoadedAt(value: string): string {
    const [date, time = ""] = value.split("T");
    const [year, month, day] = date.split("-");
    const clock = time.slice(0, 5);
    return clock ? `${day}.${month}.${year} ${clock}` : `${day}.${month}.${year}`;
}

const loadStatusClass = "h-9 min-w-0 flex-1 basis-0 justify-center px-2 text-xs font-medium whitespace-nowrap sm:w-fit sm:flex-none sm:shrink-0 sm:basis-auto";

function DataLoadStatus({ branchId, period }: { branchId: string; period: string }) {
    const loadedAt = dataLoadedAt(branchId, period);
    if (!loadedAt) {
        return (
            <Badge
                variant="outline"
                title="Данные не загружены"
                className={cn(loadStatusClass, "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200")}
            >
                Нет данных
            </Badge>
        );
    }
    const full = formatLoadedAt(loadedAt);
    const closed = period < "2026-10-01";
    return (
        <Badge
            variant="outline"
            title={`Данные загружены ${full}`}
            className={cn(
                loadStatusClass,
                closed
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
            )}
        >
            {full}
        </Badge>
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
