"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { PageHeading, usePageHeadingMenu, type PageHeadingCrumb } from "@/app/_components/header/page-heading";
import { cn } from "@/lib/utils";
import { useBranchDirectory } from "./branch-directory";
import {
    currentBranchPeriod,
    isBranchId,
    isBranchPeriod,
    readStoredBranchLocation,
    withBranchQuery,
    writeStoredBranchLocation,
} from "./mock";

export function BranchFrame({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const params = useParams<{ employeeId?: string }>();
    const directory = useBranchDirectory();
    const { branchId, period } = useBranchLocation();
    const branch = directory.branches.find((item) => item.id === branchId) ?? null;
    const employeeId = typeof params.employeeId === "string" ? params.employeeId : null;
    const employee = employeeId ? directory.employees.find((item) => item.id === employeeId) ?? null : null;
    const onLines = pathname.endsWith("/lines");
    const bonusList = pathname === "/branch/bonuses";
    const fillViewport = bonusList || onLines;
    const query = searchParams.toString();
    const appliedHref = useRef("");

    useEffect(() => {
        if (directory.loading && directory.branches.length === 0) {
            return;
        }
        const params = new URLSearchParams(query);
        const requestedBranch = params.get("branch");
        const requestedPeriod = params.get("period");
        const sameBranch = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
        const listed = isBranchId(requestedBranch)
            ? directory.branches.find((item) => sameBranch(item.id, requestedBranch))
            : undefined;
        const stored = readStoredBranchLocation();
        const storedKnown = stored ? directory.branches.find((item) => sameBranch(item.id, stored.branchId)) : undefined;
        const nextBranch = listed?.id ?? storedKnown?.id ?? directory.branches.find((item) => item.own)?.id ?? directory.branches[0]?.id ?? "";
        const nextPeriod = isBranchPeriod(requestedPeriod) ? requestedPeriod : stored?.period ?? currentBranchPeriod();
        if (!nextBranch) {
            return;
        }
        const part = params.get("part");
        const href = withBranchQuery(pathname, nextBranch, nextPeriod, pathname.endsWith("/lines") ? part : null);
        const current = query ? `${pathname}?${query}` : pathname;
        if (href === current || appliedHref.current === href) {
            appliedHref.current = href;
            writeStoredBranchLocation(nextBranch, nextPeriod);
            return;
        }
        appliedHref.current = href;
        writeStoredBranchLocation(nextBranch, nextPeriod);
        router.replace(href);
    }, [directory.branches, directory.loading, pathname, query, router]);

    useEffect(() => {
        if (!employeeId || directory.loading || !branchId) {
            return;
        }
        const listMatchesBranch = directory.employees.every((item) => item.branchId === branchId);
        if (!employee && listMatchesBranch) {
            router.replace(withBranchQuery("/branch/bonuses", branchId, period));
        }
    }, [branchId, directory.employees, directory.loading, employee, employeeId, period, router]);

    function replaceQuery(nextBranch: string, nextPeriod: string) {
        const part = searchParams.get("part");
        const path = pathname.startsWith("/branch/bonuses/") && employee && employee.branchId !== nextBranch
            ? "/branch/bonuses"
            : pathname;
        writeStoredBranchLocation(nextBranch, nextPeriod);
        router.replace(withBranchQuery(path, nextBranch, nextPeriod, path.endsWith("/lines") ? part : null));
    }

    usePageHeadingMenu((key, id) => {
        if (key === "branch") {
            replaceQuery(id, period);
        }
    });

    const branchCrumb: PageHeadingCrumb = {
        label: branch?.name ?? (directory.loading ? "Филиал" : "Филиал не выбран"),
        menuKey: "branch",
        menuValue: branchId,
        menu: directory.branches.length > 1
            ? directory.branches.map((item) => ({ id: item.id, label: item.own ? `${item.name} · свой` : item.name }))
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
            {bonusList ? null : <BranchPeriodField />}
            {fillViewport ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
        </div>
    );
}

export function BranchPeriodField() {
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
                    if (!month || !branchId) {
                        return;
                    }
                    const nextPeriod = `${month}-01`;
                    const part = searchParams.get("part");
                    writeStoredBranchLocation(branchId, nextPeriod);
                    router.replace(withBranchQuery(pathname, branchId, nextPeriod, pathname.endsWith("/lines") ? part : null));
                }}
            />
        </div>
    );
}

export function useBranchLocation(): { branchId: string; period: string } {
    const searchParams = useSearchParams();
    const requestedBranch = searchParams.get("branch");
    const requestedPeriod = searchParams.get("period");
    return {
        branchId: isBranchId(requestedBranch) ? requestedBranch : "",
        period: isBranchPeriod(requestedPeriod) ? requestedPeriod : currentBranchPeriod(),
    };
}
