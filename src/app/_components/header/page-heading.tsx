"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type PageHeadingCrumb = {
    label: string;
    href?: string;
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

function sameTrail(left: PageHeadingCrumb[], right: PageHeadingCrumb[]): boolean {
    return left.length === right.length && left.every((item, index) => item.label === right[index]?.label && item.href === right[index]?.href);
}

export function PageHeadingProvider({ children }: { children: ReactNode }) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const actions = useRef<PageHeadingActions | null>(null);
    if (!actions.current) {
        actions.current = {
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
        };
    }
    const trail = entries.at(-1)?.trail ?? null;

    return (
        <PageHeadingActionsContext.Provider value={actions.current}>
            <PageHeadingTrailContext.Provider value={trail}>
                {children}
            </PageHeadingTrailContext.Provider>
        </PageHeadingActionsContext.Provider>
    );
}

export function PageHeading({ trail }: { trail: PageHeadingCrumb[] }) {
    const actions = useContext(PageHeadingActionsContext);
    const id = useId();
    const signature = trail.map((item) => `${item.href ?? ""}\0${item.label}`).join("\n");
    const trailRef = useRef(trail);
    trailRef.current = trail;

    useEffect(() => {
        actions?.setTrail(id, trailRef.current);
    }, [actions, id, signature]);

    useEffect(() => {
        return () => actions?.clearTrail(id);
    }, [actions, id]);

    return null;
}

export function usePageHeadingTrail(): PageHeadingCrumb[] | null {
    return useContext(PageHeadingTrailContext);
}

export function PageHeadingTrail({ trail }: { trail: PageHeadingCrumb[] }) {
    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="w-full min-w-0 flex-nowrap gap-1.5 overflow-hidden text-base font-semibold sm:gap-2.5 xl:text-lg">
                {trail.map((item, index) => {
                    const last = index === trail.length - 1;
                    return (
                        <span key={`${item.href ?? ""}-${item.label}`} className="contents">
                            {index > 0 ? <BreadcrumbSeparator className="shrink-0" /> : null}
                            <BreadcrumbItem className={last ? "min-w-0 shrink" : "shrink-0 whitespace-nowrap"}>
                                {!last && item.href ? (
                                    <BreadcrumbLink className="whitespace-nowrap font-semibold" render={<Link href={item.href} />}>
                                        {item.label}
                                    </BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage className="block truncate font-semibold">{item.label}</BreadcrumbPage>
                                )}
                            </BreadcrumbItem>
                        </span>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
