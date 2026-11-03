"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type PageHeadingMenuItem = {
    id: string;
    label: string;
};

export type PageHeadingCrumb = {
    label: string;
    compactLabel?: string;
    href?: string;
    menuKey?: string;
    menuValue?: string;
    menu?: PageHeadingMenuItem[];
    omitWhenTight?: boolean;
};

type Entry = {
    id: string;
    trail: PageHeadingCrumb[];
};

type PageHeadingActions = {
    setTrail: (id: string, trail: PageHeadingCrumb[]) => void;
    clearTrail: (id: string) => void;
};

const PageHeadingActionsContext = createContext<PageHeadingActions | null>(null);
const PageHeadingTrailContext = createContext<PageHeadingCrumb[] | null>(null);
const PageHeadingMenuContext = createContext<RefObject<((key: string, id: string) => void) | null> | null>(null);

function menuSignature(item: PageHeadingCrumb): string {
    return `${item.menuKey ?? ""}\0${item.menuValue ?? ""}\0${(item.menu ?? []).map((entry) => `${entry.id}:${entry.label}`).join(",")}`;
}

function sameTrail(left: PageHeadingCrumb[], right: PageHeadingCrumb[]): boolean {
    return left.length === right.length && left.every((item, index) => item.label === right[index]?.label && item.compactLabel === right[index]?.compactLabel && item.href === right[index]?.href && item.omitWhenTight === right[index]?.omitWhenTight && menuSignature(item) === menuSignature(right[index] ?? item));
}

export function PageHeadingProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const menuSelectRef = useRef<((key: string, id: string) => void) | null>(null);
    const [actions] = useState<PageHeadingActions>(() => ({
        setTrail(id, trail) {
            setEntries((current) => {
                const existing = current.find((item) => item.id === id);
                if (existing && sameTrail(existing.trail, trail)) {
                    return current;
                }
                return [...current.filter((item) => item.id !== id), { id, trail }];
            });
        },
        clearTrail(id) {
            setEntries((current) => {
                if (!current.some((item) => item.id === id)) {
                    return current;
                }
                return current.filter((item) => item.id !== id);
            });
        },
    }));
    const trail = entries.at(-1)?.trail ?? null;

    return (
        <PageHeadingActionsContext.Provider value={actions}>
            <PageHeadingMenuContext.Provider value={menuSelectRef}>
                <PageHeadingTrailContext.Provider value={trail}>
                    {children}
                </PageHeadingTrailContext.Provider>
            </PageHeadingMenuContext.Provider>
        </PageHeadingActionsContext.Provider>
    );
}

export function PageHeading({ trail }: { trail: PageHeadingCrumb[] }) {
    const actions = useContext(PageHeadingActionsContext);
    const id = useId();
    const signature = trail.map((item) => `${item.href ?? ""}\0${item.label}\0${item.compactLabel ?? ""}\0${item.omitWhenTight ? "1" : ""}\0${menuSignature(item)}`).join("\n");

    useEffect(() => {
        actions?.setTrail(id, trail);
    }, [actions, id, signature, trail]);

    useEffect(() => {
        return () => actions?.clearTrail(id);
    }, [actions, id]);

    return null;
}

function CrumbLabel({ item }: { item: PageHeadingCrumb }) {
    if (!item.compactLabel) {
        return item.label;
    }
    return (
        <>
            <span className="md:hidden">{item.compactLabel}</span>
            <span className="hidden md:inline">{item.label}</span>
        </>
    );
}

export function usePageHeadingTrail(): PageHeadingCrumb[] | null {
    return useContext(PageHeadingTrailContext);
}

export function usePageHeadingMenu(handler: (key: string, id: string) => void) {
    const menuSelectRef = useContext(PageHeadingMenuContext);
    const handlerRef = useRef(handler);

    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!menuSelectRef) {
            return;
        }
        menuSelectRef.current = (key, id) => handlerRef.current(key, id);
        return () => {
            menuSelectRef.current = null;
        };
    }, [menuSelectRef]);
}

function trailKey(item: PageHeadingCrumb): string {
    return `${item.menuKey ?? item.href ?? ""}-${item.label}`;
}

export function PageHeadingTrail({ trail }: { trail: PageHeadingCrumb[] }) {
    const menuSelectRef = useContext(PageHeadingMenuContext);
    const rootRef = useRef<HTMLElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const canOmit = trail.some((item) => item.omitWhenTight);
    const [tight, setTight] = useState(false);
    const measureKey = trail.map((item) => `${item.label}\0${item.compactLabel ?? ""}\0${item.menu && item.menu.length > 1 ? "1" : ""}`).join("\n");

    useLayoutEffect(() => {
        if (!canOmit) {
            return;
        }
        const root = rootRef.current;
        const measure = measureRef.current;
        if (!root || !measure) {
            return;
        }
        let cancel = false;
        const mobile = window.matchMedia("(max-width: 767px)");
        const update = () => {
            if (cancel) {
                return;
            }
            const next = mobile.matches && measure.scrollWidth > root.clientWidth + 1;
            setTight((current) => current === next ? current : next);
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(root);
        mobile.addEventListener("change", update);
        void document.fonts?.ready.then(update);
        return () => {
            cancel = true;
            observer.disconnect();
            mobile.removeEventListener("change", update);
        };
    }, [canOmit, measureKey]);

    const visible = tight ? trail.filter((item) => !item.omitWhenTight) : trail;

    return (
        <Breadcrumb ref={rootRef} className="relative min-w-0 overflow-hidden">
            {canOmit ? (
                <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex w-max flex-nowrap items-center gap-1.5 text-base font-semibold whitespace-nowrap sm:gap-2.5 xl:text-lg">
                    {trail.map((item, index) => {
                        const choices = item.menu ?? [];
                        return (
                            <span key={trailKey(item)} className="contents">
                                {index > 0 ? <span className="size-3.5 shrink-0" /> : null}
                                <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
                                    <CrumbLabel item={item} />
                                    {choices.length > 1 ? <span className="size-7 shrink-0" /> : null}
                                </span>
                            </span>
                        );
                    })}
                </div>
            ) : null}
            <BreadcrumbList className="w-full min-w-0 flex-nowrap gap-1.5 overflow-hidden text-base font-semibold sm:gap-2.5 xl:text-lg">
                {visible.map((item, index) => {
                    const last = index === visible.length - 1;
                    const choices = item.menu ?? [];
                    return (
                        <span key={`${item.menuKey ?? item.href ?? ""}-${item.label}`} className="contents">
                            {index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
                            <BreadcrumbItem className="min-w-0 shrink gap-0.5">
                                {!last && item.href ? (
                                    <BreadcrumbLink className="min-w-0 truncate font-semibold" render={<Link href={item.href} />}>
                                        <CrumbLabel item={item} />
                                    </BreadcrumbLink>
                                ) : last ? (
                                    <BreadcrumbPage className="block truncate font-semibold"><CrumbLabel item={item} /></BreadcrumbPage>
                                ) : (
                                    <span className="truncate font-semibold text-foreground"><CrumbLabel item={item} /></span>
                                )}
                                {choices.length > 1 ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            type="button"
                                            aria-label="Выбрать филиал"
                                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:text-foreground [&_svg]:transition-transform data-popup-open:[&_svg]:rotate-180"
                                        >
                                            <ChevronDown className="size-3.5" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-auto min-w-56">
                                            {choices.map((choice) => (
                                                <DropdownMenuItem
                                                    key={choice.id}
                                                    onClick={() => {
                                                        if (choice.id !== item.menuValue && item.menuKey) {
                                                            menuSelectRef?.current?.(item.menuKey, choice.id);
                                                        }
                                                    }}
                                                >
                                                    <Check className={choice.id === item.menuValue ? undefined : "invisible"} />
                                                    {choice.label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : null}
                            </BreadcrumbItem>
                        </span>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
