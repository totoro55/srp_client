"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, KeyRound, LayoutDashboard, Percent, Receipt, Share2, ShoppingBasket, UserCheck, Key, type LucideIcon } from "lucide-react";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/app/_components/header/page-heading";

export type RrsSection = "overview" | "baskets" | "tariffs" | "motivation" | "coefficients" | "access" | "delegation";

type MenuPage = {
    id: RrsSection;
    label: string;
    hint: string;
    path: string;
    icon: LucideIcon;
    timed: boolean;
    savedCard: boolean;
};

const BLOCKS: { id: string; label: string; icon: LucideIcon; pages: MenuPage[] }[] = [
    {
        id: "overview",
        label: "Обзор",
        icon: LayoutDashboard,
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
        icon: ShoppingBasket,
        pages: [{
            id: "baskets",
            label: "Корзины",
            hint: "Подключённые корзины и значения параметров за выбранный месяц.",
            path: "/baskets",
            icon: ShoppingBasket,
            timed: true,
            savedCard: true,
        }],
    },
    {
        id: "branches",
        label: "Настройки филиалов",
        icon: Building2,
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
        icon: Receipt,
        pages: [{
            id: "tariffs",
            label: "Тарифы",
            hint: "Тарифы за продажу товара на выбранный месяц.",
            path: "/tariffs",
            icon: Receipt,
            timed: true,
            savedCard: true,
        }],
    },
    {
        id: "access",
        label: "Доступы",
        icon: KeyRound,
        pages: [
            {
                id: "access",
                label: "Выдача доступа",
                hint: "Выдача отдельных доступов сотрудникам территории.",
                path: "/access",
                icon: Key,
                timed: false,
                savedCard: false,
            },
            {
                id: "delegation",
                label: "Делегирование прав",
                hint: "Разрешение управляющим делегировать доступ, в том числе на период отпуска.",
                path: "/delegation",
                icon: Share2,
                timed: false,
                savedCard: false,
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

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {territoryName ? (
                    <PageHeading trail={[
                        { href: "/rrs", label: "Настройки РРС" },
                        { label: territoryName },
                    ]} />
                ) : null}
                <NavigationMenu align="start" aria-label="Разделы настроек" className="max-w-full flex-none justify-start">
                    <NavigationMenuList className="justify-start">
                        {BLOCKS.map((block) => {
                            const Icon = block.icon;
                            const current = block.pages.some((page) => page.id === active);
                            return (
                                <NavigationMenuItem key={block.id} value={block.id}>
                                    <NavigationMenuTrigger className={cn("gap-1.5", current && "bg-muted text-foreground")}>
                                        <Icon className="size-4" />
                                        {block.label}
                                    </NavigationMenuTrigger>
                                    <NavigationMenuContent>
                                        <ul className="grid w-72 gap-1">
                                            {block.pages.map((page) => {
                                                const PageIcon = page.icon;
                                                return (
                                                    <li key={page.id}>
                                                        <NavigationMenuLink
                                                            active={page.id === active}
                                                            closeOnClick
                                                            render={<Link href={href(page)} />}
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
                                    </NavigationMenuContent>
                                </NavigationMenuItem>
                            );
                        })}
                    </NavigationMenuList>
                </NavigationMenu>
            </div>
            {subnav ? <div className="flex min-h-9 flex-wrap items-center">{subnav}</div> : null}
            {controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}
        </div>
    );
}
