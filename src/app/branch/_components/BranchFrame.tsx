"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading, usePageHeadingMenu, type PageHeadingCrumb } from "@/app/_components/header/page-heading";
import { cn } from "@/lib/utils";
import { technicalAccount } from "@/lib/technical-accounts";
import { useBranchDirectory } from "./branch-directory";
import { useSharedPremiumAuthors } from "./use-shared-premium-authors";
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
    const onLines = pathname.endsWith("/lines");
    const technical = technicalAccount(employeeId);
    const employee = employeeId ? directory.employees.find((item) => item.id === employeeId) ?? null : null;
    const staffReady = !directory.loading
        && directory.loadedBranchId !== ""
        && directory.loadedBranchId.toLowerCase() === branchId.toLowerCase();
    const needsAuthor = onLines && Boolean(employeeId) && !technical && staffReady && !employee;
    const authorState = useSharedPremiumAuthors(needsAuthor ? branchId : "", needsAuthor ? period : "");
    const storedAuthor = employeeId
        ? authorState.authors.find((item) => item.id === employeeId.toLowerCase()) ?? null
        : null;
    const person = employee
        ? { id: employee.id, name: employee.name }
        : technical
            ? { id: technical.id, name: technical.name }
            : storedAuthor
                ? { id: storedAuthor.id, name: storedAuthor.name }
                : null;
    const bonusList = pathname === "/branch/bonuses";
    const fillViewport = bonusList || onLines;
    const query = searchParams.toString();
    const appliedHref = useRef("");
    const placedPeriod = useRef("");
    const narrowScrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (directory.loading && directory.branches.length === 0) {
            return;
        }
        const params = new URLSearchParams(query);
        const requestedBranch = params.get("branch");
        const requestedPeriod = params.get("period");
        const listed = isBranchId(requestedBranch)
            ? directory.branches.find((item) => sameBranch(item.id, requestedBranch))
            : undefined;
        const stored = readStoredBranchLocation();
        const storedKnown = stored ? directory.branches.find((item) => sameBranch(item.id, stored.branchId)) : undefined;
        const nextPeriod = isBranchPeriod(requestedPeriod) ? requestedPeriod : stored?.period ?? currentBranchPeriod();
        let nextBranch = listed?.id ?? storedKnown?.id ?? directory.branches.find((item) => item.own)?.id ?? directory.branches[0]?.id ?? "";
        if (directory.branchChoice === "assignment" && directory.loadedPeriod === nextPeriod && directory.loadedPeriod !== "") {
            const periodChanged = placedPeriod.current !== "" && placedPeriod.current !== nextPeriod;
            const chosen = resolveAssignmentBranch(
                directory.branches,
                directory.workedBranchIds,
                directory.preferredBranchId,
                listed?.id,
                periodChanged,
            );
            if (chosen) {
                nextBranch = chosen;
                const requestedId = isBranchId(requestedBranch) ? requestedBranch : "";
                if (!periodChanged || sameBranch(chosen, requestedId)) {
                    placedPeriod.current = nextPeriod;
                }
            }
        }
        if (!nextBranch) {
            return;
        }
        const part = params.get("part");
        let href = withBranchQuery(pathname, nextBranch, nextPeriod, onLines ? part : null);
        if (onLines) {
            const kept = new URLSearchParams(href.slice(href.indexOf("?") + 1));
            const from = params.get("from");
            const page = params.get("page");
            if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
                kept.set("from", from);
            }
            if (page && /^[1-9]\d*$/.test(page) && page !== "1") {
                kept.set("page", page);
            }
            href = `${pathname}?${kept.toString()}`;
        }
        const current = query ? `${pathname}?${query}` : pathname;
        if (href === current || appliedHref.current === href) {
            appliedHref.current = href;
            writeStoredBranchLocation(nextBranch, nextPeriod);
            return;
        }
        appliedHref.current = href;
        writeStoredBranchLocation(nextBranch, nextPeriod);
        router.replace(href);
    }, [directory.branchChoice, directory.branches, directory.loadedPeriod, directory.loading, directory.preferredBranchId, directory.workedBranchIds, onLines, pathname, query, router]);

    useEffect(() => {
        if (!employeeId || directory.loading || !branchId) {
            return;
        }
        const listMatchesBranch = directory.employees.every((item) => item.branchId === branchId);
        if (needsAuthor && !authorState.loading && !storedAuthor && listMatchesBranch) {
            router.replace(withBranchQuery("/branch/bonuses", branchId, period));
        }
    }, [authorState.loading, branchId, directory.employees, directory.loading, employeeId, needsAuthor, period, router, storedAuthor]);

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

    const placementReady = directory.branchChoice !== "assignment" || directory.loadedPeriod === period;
    const workedBranchIds = new Set(directory.workedBranchIds.map((id) => id.toLowerCase()));
    const choiceBranches = !placementReady
        ? []
        : directory.branchChoice === "assignment"
            ? directory.branches.filter((item) => workedBranchIds.has(item.id.toLowerCase()))
            : directory.branches;
    const branchCrumb: PageHeadingCrumb = {
        label: branch?.name ?? (directory.loading ? "Филиал" : "Филиал не выбран"),
        menuKey: "branch",
        menuValue: branchId,
        menu: choiceBranches.length > 1
            ? choiceBranches.map((item) => ({
                id: item.id,
                label: directory.branchChoice === "assignment" ? item.name : item.own ? `${item.name} · свой` : item.name,
                group: item.territoryName,
            }))
            : undefined,
    };
    const trail: PageHeadingCrumb[] = person
        ? [
            { href: withBranchQuery("/branch/bonuses", branchId, period), label: "Кабинет филиала", compactLabel: "Кабинет" },
            branchCrumb,
            onLines
                ? {
                    href: technical || (storedAuthor !== null && storedAuthor.kind !== "staff")
                        ? withBranchQuery("/branch/bonuses/common", branchId, period)
                        : withBranchQuery(`/branch/bonuses/${person.id}`, branchId, period),
                    label: person.name,
                }
                : { label: person.name },
            ...(onLines ? [{ label: "Детализация" }] : []),
        ]
        : pathname === "/branch/bonuses/common"
            ? [
                { href: withBranchQuery("/branch/bonuses", branchId, period), label: "Кабинет филиала", compactLabel: "Кабинет" },
                branchCrumb,
                { label: "Общая премия" },
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

    const backHref = [...trail].reverse().find((item) => item.href)?.href;

    return (
        <div className={cn("flex w-full min-w-0 flex-col gap-4 [@media(max-height:500px)]:gap-2!", fillViewport && "-mb-4 h-[calc(100dvh-5rem)] min-h-0 md:-mb-6 md:h-[calc(100dvh-5.5rem)] [@media(max-height:500px)]:-mb-2! [@media(max-height:500px)]:h-[calc(100dvh-4.5rem)]!")}>
            <PageHeading trail={trail} />
            {fillViewport ? (
                <div ref={narrowScrollRef} data-narrow-scroll="" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 max-sm:gap-2 max-sm:overflow-y-auto max-sm:overscroll-contain">
                    {bonusList ? null : (
                        <div className="shrink-0">
                            <BranchPeriodField backHref={backHref} />
                        </div>
                    )}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col max-sm:h-auto max-sm:flex-none">{children}</div>
                    <NarrowScrollTail rootRef={narrowScrollRef} />
                </div>
            ) : (
                <>
                    <BranchPeriodField backHref={backHref} />
                    {children}
                </>
            )}
        </div>
    );
}

function NarrowScrollTail({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
    const [height, setHeight] = useState(0);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return;
        }
        const query = window.matchMedia("(max-width: 639px)");
        let frame = 0;

        function measure() {
            if (!query.matches) {
                setHeight((current) => current === 0 ? current : 0);
                return;
            }
            const rows = root!.querySelectorAll<HTMLElement>("[data-scroll-row]");
            let last: HTMLElement | null = null;
            for (let index = rows.length - 1; index >= 0; index -= 1) {
                if (rows[index].getBoundingClientRect().height > 0) {
                    last = rows[index];
                    break;
                }
            }
            if (!last) {
                setHeight((current) => current === 0 ? current : 0);
                return;
            }
            const spacer = root!.querySelector<HTMLElement>("[data-scroll-tail]");
            const rootTop = root!.getBoundingClientRect().top;
            const rowTop = last.getBoundingClientRect().top - rootTop + root!.scrollTop;
            const contentEnd = spacer
                ? spacer.getBoundingClientRect().top - rootTop + root!.scrollTop
                : root!.scrollHeight;
            const next = Math.max(0, Math.round(root!.clientHeight - (contentEnd - rowTop)));
            setHeight((current) => current === next ? current : next);
        }

        function schedule() {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(measure);
        }

        const observer = new ResizeObserver(schedule);
        observer.observe(root);
        for (const child of root.children) {
            if (!child.hasAttribute("data-scroll-tail")) {
                observer.observe(child);
            }
        }
        const mutations = new MutationObserver(schedule);
        mutations.observe(root, { childList: true, subtree: true });
        query.addEventListener("change", schedule);
        schedule();
        return () => {
            window.cancelAnimationFrame(frame);
            observer.disconnect();
            mutations.disconnect();
            query.removeEventListener("change", schedule);
        };
    }, [rootRef]);

    return <div data-scroll-tail="" aria-hidden className="shrink-0 sm:hidden" style={{ height }} />;
}

export function BranchPeriodField({ backHref }: { backHref?: string }) {
    const { branchId, period } = useBranchLocation();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <div className="flex w-full min-w-0 shrink-0 items-center gap-1.5 sm:w-auto sm:gap-2">
            {backHref ? (
                <Link href={backHref} aria-label="Назад" className={cn(buttonVariants({ variant: "outline", size: "icon" }), "sm:hidden")}>
                    <ArrowLeft />
                </Link>
            ) : null}
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

function sameBranch(left: string, right: string): boolean {
    return left.toLowerCase() === right.toLowerCase();
}

function resolveAssignmentBranch(
    branches: { id: string }[],
    workedBranchIds: string[],
    preferredBranchId: string | null,
    requestedBranchId: string | undefined,
    periodChanged: boolean,
): string | null {
    const worked = new Set(workedBranchIds.map((id) => id.toLowerCase()));
    const preferred = preferredBranchId
        ? branches.find((item) => sameBranch(item.id, preferredBranchId))
        : undefined;
    const requested = requestedBranchId && worked.has(requestedBranchId.toLowerCase())
        ? branches.find((item) => sameBranch(item.id, requestedBranchId))
        : undefined;
    if (periodChanged) {
        return preferred?.id ?? requested?.id ?? null;
    }
    return requested?.id ?? preferred?.id ?? null;
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
