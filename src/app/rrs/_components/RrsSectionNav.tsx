"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChartColumn, ChevronDown, Key, LayoutDashboard, ListChecks, Percent, Receipt, Share2, ShoppingBasket, UserCheck, WandSparkles, type LucideIcon } from "lucide-react";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/app/_components/header/page-heading";

export type RrsSection = "overview" | "baskets" | "tariffs" | "exceptions" | "premium" | "motivation" | "coefficients" | "access" | "delegation";

type MenuPage = {
    id: RrsSection | "basket-wizard";
    label: string;
    hint: string;
    path: string;
    icon: LucideIcon;
    timed: boolean;
    savedCard: boolean;
    planned?: boolean;
};

const BLOCKS: { id: string; label: string; pages: MenuPage[] }[] = [
    {
        id: "overview",
        label: "Обзор",
        pages: [{
            id: "overview",
            label: "Обзор",
            hint: "Сводные сведения по выбранной территории.",
            path: "",
            icon: LayoutDashboard,
            timed: false,
            savedCard: false,
        }],
    },
    {
        id: "baskets",
        label: "Корзины",
        pages: [
            {
                id: "baskets",
                label: "Корзины",
                hint: "Подключённые корзины и значения параметров за выбранный месяц.",
                path: "/baskets",
                icon: ShoppingBasket,
                timed: true,
                savedCard: true,
            },
            {
                id: "basket-wizard",
                label: "Запустить мастер настройки корзин",
                hint: "Изменение состава корзин и параметров на выбранный месяц.",
                path: "/edit",
                icon: WandSparkles,
                timed: true,
                savedCard: false,
            },
        ],
    },
    {
        id: "branches",
        label: "Настройки филиалов",
        pages: [
            {
                id: "motivation",
                label: "Участие",
                hint: "Включение филиалов в мотивацию на выбранный месяц.",
                path: "/motivation",
                icon: UserCheck,
                timed: true,
                savedCard: false,
            },
            {
                id: "coefficients",
                label: "Коэффициенты",
                hint: "Коэффициенты филиалов за выбранный месяц.",
                path: "/coefficients",
                icon: Percent,
                timed: true,
                savedCard: false,
            },
        ],
    },
    {
        id: "tariffs",
        label: "Тарифы за продажу",
        pages: [
            {
                id: "tariffs",
                label: "Тарифы",
                hint: "Тарифы за продажу товара на выбранный месяц.",
                path: "/tariffs",
                icon: Receipt,
                timed: true,
                savedCard: true,
            },
            {
                id: "exceptions",
                label: "Исключения",
                hint: "Включённые исключения на выбранный месяц.",
                path: "/exceptions",
                icon: ListChecks,
                timed: true,
                savedCard: false,
            },
            {
                id: "premium",
                label: "Аналитика премии",
                hint: "Премия по сохранённым тарифам: среднее за месяц из статистики за три месяца.",
                path: "/premium",
                icon: ChartColumn,
                timed: true,
                savedCard: true,
            },
        ],
    },
    {
        id: "access",
        label: "Доступы",
        pages: [
            {
                id: "access",
                label: "Выдача доступа",
                hint: "Выдача отдельных доступов сотрудникам территории.",
                path: "/access",
                icon: Key,
                timed: false,
                savedCard: false,
                planned: true,
            },
            {
                id: "delegation",
                label: "Делегирование прав",
                hint: "Разрешение управляющим делегировать доступ, в том числе на период отпуска.",
                path: "/delegation",
                icon: Share2,
                timed: false,
                savedCard: false,
                planned: true,
            },
        ],
    },
];

export function connectionCardPeriod(period: string, savedPeriods: string[]): string {
    return savedPeriods.filter((item) => item <= period).sort().at(-1)
        ?? [...savedPeriods].sort().at(-1)
        ?? period;
}

export function RrsSectionNav({
    territoryUuid,
    territoryName,
    active,
    period,
    cardPeriod,
    subnav,
    controls,
}: {
    territoryUuid: string;
    territoryName?: string | null;
    active: RrsSection;
    period?: string | null;
    cardPeriod?: string | null;
    subnav?: ReactNode;
    controls?: ReactNode;
}) {
    function href(page: MenuPage) {
        if (!page.timed) {
            return `/rrs/${territoryUuid}${page.path}`;
        }
        const chosen = page.savedCard ? (cardPeriod ?? period) : period;
        const query = chosen ? `?period=${encodeURIComponent(chosen)}` : "";
        return `/rrs/${territoryUuid}${page.path}${query}`;
    }

    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLSpanElement | null>>([]);
    const moreRef = useRef<HTMLSpanElement>(null);
    const [visibleCount, setVisibleCount] = useState(BLOCKS.length);
    const triggerClass = cn(navigationMenuTriggerStyle(), "h-8 px-2.5 sm:h-9 sm:px-4");

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        function measure() {
            const available = container?.clientWidth ?? 0;
            const widths = BLOCKS.map((_, index) => itemRefs.current[index]?.offsetWidth ?? 0);
            const moreWidth = moreRef.current?.offsetWidth ?? 0;
            const gap = 4;
            let used = 0;
            let count = 0;
            for (let index = 0; index < widths.length; index++) {
                const width = widths[index];
                const next = used + (count > 0 ? gap : 0) + width;
                const hiddenAfter = widths.length - index - 1;
                const needed = hiddenAfter > 0 ? next + gap + moreWidth : next;
                if (needed > available) {
                    break;
                }
                used = next;
                count += 1;
            }
            setVisibleCount((current) => (current === count ? current : count));
        }
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        if (measureRef.current) {
            observer.observe(measureRef.current);
        }
        void document.fonts?.ready.then(measure);
        return () => observer.disconnect();
    }, []);

    const visibleBlocks = BLOCKS.slice(0, visibleCount);
    const overflowBlocks = BLOCKS.slice(visibleCount);
    const overflowCurrent = overflowBlocks.some((block) => block.pages.some((page) => page.id === active));

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {territoryName ? (
                    <PageHeading trail={[
                        { href: "/rrs", label: "Настройки РРС" },
                        { label: territoryName },
                    ]} />
                ) : null}
                <div ref={containerRef} className="relative w-full min-w-0">
                    <div className="pointer-events-none absolute top-0 left-0 h-0 overflow-hidden" aria-hidden>
                        <div ref={measureRef} className="flex w-max gap-1">
                            {BLOCKS.map((block, index) => (
                                <span
                                    key={block.id}
                                    ref={(node) => {
                                        itemRefs.current[index] = node;
                                    }}
                                    className={triggerClass}
                                >
                                    {block.label}
                                    {block.pages.length > 1 ? <ChevronDown className="relative top-px ml-1 size-3" /> : null}
                                </span>
                            ))}
                            <span ref={moreRef} className={triggerClass}>
                                Ещё
                                <ChevronDown className="relative top-px ml-1 size-3" />
                            </span>
                        </div>
                    </div>
                    <NavigationMenu align="start" aria-label="Разделы настроек" className="w-full max-w-full flex-none justify-start">
                        <NavigationMenuList className="w-full flex-nowrap justify-start gap-1">
                            {visibleBlocks.map((block) => {
                                const current = block.pages.some((page) => page.id === active);
                                const onlyPage = block.pages.length === 1 ? block.pages[0] : null;
                                if (onlyPage) {
                                    return (
                                        <NavigationMenuItem key={block.id} value={block.id}>
                                            <NavigationMenuLink
                                                active={current}
                                                closeOnClick
                                                render={<Link href={href(onlyPage)} />}
                                                className={cn(triggerClass, current && "bg-muted text-foreground")}
                                            >
                                                {block.label}
                                            </NavigationMenuLink>
                                        </NavigationMenuItem>
                                    );
                                }
                                return (
                                    <NavigationMenuItem key={block.id} value={block.id}>
                                        <NavigationMenuTrigger className={cn(triggerClass, current && "bg-muted text-foreground")}>
                                            {block.label}
                                        </NavigationMenuTrigger>
                                        <NavigationMenuContent>
                                            <MenuPages pages={block.pages} active={active} hrefFor={href} />
                                        </NavigationMenuContent>
                                    </NavigationMenuItem>
                                );
                            })}
                            {overflowBlocks.length > 0 ? (
                                <NavigationMenuItem value="more">
                                    <NavigationMenuTrigger className={cn(triggerClass, overflowCurrent && "bg-muted text-foreground")}>
                                        Ещё
                                    </NavigationMenuTrigger>
                                    <NavigationMenuContent>
                                        <ul className="grid w-[min(18rem,calc(100vw-2rem))] gap-2">
                                            {overflowBlocks.map((block) => {
                                                const onlyPage = block.pages.length === 1 ? block.pages[0] : null;
                                                if (onlyPage) {
                                                    return (
                                                        <li key={block.id}>
                                                            <NavigationMenuLink
                                                                active={onlyPage.id === active}
                                                                closeOnClick
                                                                render={<Link href={href(onlyPage)} />}
                                                            >
                                                                {block.label}
                                                            </NavigationMenuLink>
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li key={block.id} className="flex flex-col gap-1">
                                                        <p className="px-2 pt-1 text-xs font-medium text-muted-foreground">{block.label}</p>
                                                        <MenuPages pages={block.pages} active={active} hrefFor={href} />
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </NavigationMenuContent>
                                </NavigationMenuItem>
                            ) : null}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>
            </div>
            {subnav ? <div className="flex min-h-9 flex-wrap items-center">{subnav}</div> : null}
            {controls ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{controls}</div> : null}
        </div>
    );
}

function MenuPages({
    pages,
    active,
    hrefFor,
}: {
    pages: MenuPage[];
    active: RrsSection;
    hrefFor: (page: MenuPage) => string;
}) {
    return (
        <ul className="grid w-[min(18rem,calc(100vw-2rem))] gap-1">
            {pages.map((page) => {
                const PageIcon = page.icon;
                if (page.planned) {
                    return (
                        <li key={page.id} className="cursor-not-allowed">
                            <div aria-disabled="true" className="pointer-events-none flex items-start gap-2 rounded-md bg-muted/50 p-2 text-sm select-none">
                                <PageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                <span className="flex min-w-0 flex-col gap-1">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium leading-none text-muted-foreground">{page.label}</span>
                                        <Badge className="h-5 px-1.5 text-xs">В разработке</Badge>
                                    </span>
                                    <span className="text-xs leading-snug font-normal text-muted-foreground">{page.hint}</span>
                                </span>
                            </div>
                        </li>
                    );
                }
                return (
                    <li key={page.id}>
                        <NavigationMenuLink
                            active={page.id === active}
                            closeOnClick
                            render={<Link href={hrefFor(page)} />}
                            className="items-start gap-2"
                        >
                            <PageIcon className="mt-0.5" />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="font-medium leading-none">{page.label}</span>
                                <span className="text-xs leading-snug font-normal text-muted-foreground">{page.hint}</span>
                            </span>
                        </NavigationMenuLink>
                    </li>
                );
            })}
        </ul>
    );
}
