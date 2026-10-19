"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Шапка закреплена у верхнего края окна через position: sticky.
 * Горизонтальная прокрутка остаётся у тела таблицы и не делает шапку дёрганой.
 */
export function PinnedTable({
    minWidthClass,
    columns,
    head,
    children,
}: {
    minWidthClass: string;
    columns: () => ReactNode;
    head: ReactNode;
    children: ReactNode;
}) {
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const header = headerRef.current;
        const body = bodyRef.current;
        const headerTable = header?.querySelector("table");
        const bodyTable = body?.querySelector("table");
        if (!header || !body || !headerTable || !bodyTable) {
            return;
        }
        const align = () => {
            headerTable.style.width = `${bodyTable.offsetWidth}px`;
            header.scrollLeft = body.scrollLeft;
        };
        align();
        const observer = new ResizeObserver(align);
        observer.observe(bodyTable);
        return () => observer.disconnect();
    }, []);

    const tableClass = `w-full table-fixed border-collapse text-xs ${minWidthClass}`;
    return (
        <div>
            <div ref={headerRef} className="sticky top-0 z-30 isolate overflow-x-hidden overflow-y-clip rounded-t-lg border border-b-0 border-border bg-muted shadow-[0_1px_0_0_var(--color-muted)]">
                <table className={tableClass}>
                    {columns()}
                    <thead className="text-left text-xs text-muted-foreground">{head}</thead>
                </table>
            </div>
            <div
                ref={bodyRef}
                className="relative z-0 overflow-x-auto rounded-b-lg border border-t-0 border-border"
                onScroll={(event) => {
                    const header = headerRef.current;
                    if (header) {
                        header.scrollLeft = event.currentTarget.scrollLeft;
                    }
                }}
            >
                <table className={tableClass}>
                    {columns()}
                    <tbody>{children}</tbody>
                </table>
            </div>
        </div>
    );
}
