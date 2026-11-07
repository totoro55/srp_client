"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useMotivationRoles } from "@/hooks/useMotivationRoles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBranchDirectory } from "./branch-directory";
import { findStaffSegment, roleKey, segmentHref } from "./staff";
import { useBranchStore } from "./branch-store";
import { useBranchLocation } from "./BranchFrame";
import { DisplayBonusDetail } from "./DisplayBonusDetail";
import { DocumentPremiumDetail } from "./DocumentPremiumDetail";
import { IssueBonusDetail, PickingBonusDetail } from "./IssueBonusDetail";
import { ReleaseBonusDetail } from "./ReleaseBonusDetail";
import { SalesBonusDetail } from "./SalesBonusDetail";
import { ServiceBonusDetail } from "./ServiceBonusDetail";
import { UnloadBonusDetail } from "./UnloadBonusDetail";
import { WarehouseBonusDetail } from "./WarehouseBonusDetail";
import {
    branchMonth,
    inCalculation,
    periodLines,
    withBranchQuery,
} from "./mock";

export function BonusLines() {
    const params = useParams<{ employeeId: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { branchId, period } = useBranchLocation();
    const store = useBranchStore();
    const listRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ left: false, right: false });
    const directory = useBranchDirectory();
    const settings = useMotivationRoles();
    const employee = findStaffSegment(directory.employees, params.employeeId, searchParams.get("from"));
    const part = searchParams.get("part");
    const month = employee && employee.branchId === branchId ? branchMonth(branchId, period) : null;
    const slice = store.slice(branchId, period, directory.employees, settings);
    const roleId = employee ? (slice.savedRoles[roleKey(employee)] ?? null) : null;
    const participating = employee ? inCalculation(employee, roleId) : false;
    const lines = employee && participating && month ? periodLines(employee.id, period, month.calculated) : [];
    const salesIndicator = directory.indicators.find((indicator) => indicator.title === "Продажа товара");
    const releaseIndicator = directory.indicators.find((indicator) => indicator.title === "Выдача товара");
    const mockBaskets = [...new Map(lines.map((item) => [item.basketId, item.basketTitle])).entries()];
    const liveBaskets = [salesIndicator, releaseIndicator].flatMap((indicator) => indicator ? [[indicator.id, indicator.title] as [string, string]] : []);
    const baskets = month?.calculated && mockBaskets.length > 0 ? mockBaskets : liveBaskets;
    const knownPart = part !== null && baskets.some(([basketId]) => basketId === part);
    const tab = knownPart && part ? part : (baskets[0]?.[0] ?? "");

    useEffect(() => {
        if (!employee || employee.branchId !== branchId || baskets.length === 0) {
            return;
        }
        if (!knownPart) {
            router.replace(segmentHref(withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, baskets[0][0]), employee.activeFrom));
        }
    }, [baskets, branchId, employee, knownPart, period, router]);

    useEffect(() => {
        const node = listRef.current;
        if (!node) return;
        function updateEdges() {
            const max = node!.scrollWidth - node!.clientWidth;
            setEdges({
                left: node!.scrollLeft > 2,
                right: max > 2 && node!.scrollLeft < max - 2,
            });
        }
        updateEdges();
        const observer = new ResizeObserver(updateEdges);
        observer.observe(node);
        if (node.firstElementChild) observer.observe(node.firstElementChild);
        node.addEventListener("scroll", updateEdges, { passive: true });
        window.addEventListener("resize", updateEdges);
        return () => {
            observer.disconnect();
            node.removeEventListener("scroll", updateEdges);
            window.removeEventListener("resize", updateEdges);
        };
    }, [baskets.length]);

    useEffect(() => {
        const root = listRef.current;
        if (!root) return;
        const active = root.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-active]');
        if (!active) return;
        const pad = 8;
        const left = active.offsetLeft;
        const right = left + active.offsetWidth;
        if (left < root.scrollLeft + pad) {
            root.scrollTo({ left: Math.max(0, left - pad), behavior: "smooth" });
        } else if (right > root.scrollLeft + root.clientWidth - pad) {
            root.scrollTo({ left: right - root.clientWidth + pad, behavior: "smooth" });
        }
    }, [tab]);

    function scrollByPage(direction: -1 | 1) {
        const node = listRef.current;
        if (!node) return;
        node.scrollBy({ left: direction * node.clientWidth, behavior: "smooth" });
    }

    if (!employee || employee.branchId !== branchId) {
        return null;
    }
    if (!participating) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Сотрудник в этом месяце вне расчёта.</p>;
    }
    if (baskets.length === 0) {
        return <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">Расчёт за этот месяц ещё не готов.</p>;
    }
    if (!tab) {
        return null;
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 max-sm:gap-2">
            <div className="relative min-w-0 shrink-0">
                <Tabs
                    value={tab}
                    onValueChange={(next) => {
                        router.replace(segmentHref(withBranchQuery(`/branch/bonuses/${employee.id}/lines`, branchId, period, next), employee.activeFrom));
                    }}
                    className="min-w-0 gap-0"
                >
                    <div
                        ref={listRef}
                        className="overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <TabsList className="h-10 w-max min-w-full justify-start gap-1 bg-muted">
                            {baskets.map(([basketId, title]) => (
                                <TabsTrigger key={basketId} value={basketId} className="flex-none px-3">
                                    {title}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </Tabs>
                {edges.left ? (
                    <>
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent"
                        />
                        <div className="absolute inset-y-0 left-0 z-30 flex items-center pl-1">
                            <button
                                type="button"
                                className={cn(
                                    buttonVariants({ variant: "outline", size: "icon-sm" }),
                                    "bg-background shadow-xs active:translate-y-0!",
                                )}
                                aria-label="Прокрутить вкладки влево"
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    scrollByPage(-1);
                                }}
                            >
                                <ChevronLeft />
                            </button>
                        </div>
                    </>
                ) : null}
                {edges.right ? (
                    <>
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent"
                        />
                        <div className="absolute inset-y-0 right-0 z-30 flex items-center pr-1">
                            <button
                                type="button"
                                className={cn(
                                    buttonVariants({ variant: "outline", size: "icon-sm" }),
                                    "bg-background shadow-xs active:translate-y-0!",
                                )}
                                aria-label="Прокрутить вкладки вправо"
                                onPointerDown={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    scrollByPage(1);
                                }}
                            >
                                <ChevronRight />
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {tab === "sales" || tab === salesIndicator?.id ? (
                    <SalesBonusDetail employeeId={employee.id} period={period} />
                ) : tab === releaseIndicator?.id ? (
                    <ReleaseBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "issue" ? (
                    <IssueBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "picking" ? (
                    <PickingBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "unload" ? (
                    <UnloadBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "warehouse" ? (
                    <WarehouseBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "display" ? (
                    <DisplayBonusDetail employeeId={employee.id} period={period} />
                ) : tab === "services" ? (
                    <ServiceBonusDetail employeeId={employee.id} period={period} kind="services" />
                ) : tab === "kbt" ? (
                    <ServiceBonusDetail employeeId={employee.id} period={period} kind="kbt" />
                ) : tab === "warranty" || tab === "delivery" || tab === "sim" || tab === "credits" ? (
                    <DocumentPremiumDetail employeeId={employee.id} period={period} kind={tab} />
                ) : null}
            </div>
        </div>
    );
}
