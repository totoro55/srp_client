"use client";

import type { MouseEvent } from "react";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface PageControlsProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function PageControls({ page, pageSize, total, onPageChange }: PageControlsProps) {
    if (total <= 0) {
        return null;
    }

    const pages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, pages);
    const from = (current - 1) * pageSize + 1;
    const to = Math.min(current * pageSize, total);

    function openPage(event: MouseEvent<HTMLAnchorElement>, next: number) {
        event.preventDefault();
        if (next !== current && next >= 1 && next <= pages) {
            onPageChange(next);
        }
    }

    return (
        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
                {from}–{to} из {total}
            </p>
            <Pagination className="mx-0 w-full justify-center md:w-auto md:justify-end">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        text="Назад"
                        aria-label="Предыдущая страница"
                        aria-disabled={current <= 1}
                        tabIndex={current <= 1 ? -1 : undefined}
                        className={current <= 1 ? "pointer-events-none opacity-50" : undefined}
                        onClick={(event) => openPage(event, current - 1)}
                    />
                </PaginationItem>
                {pageTokens(current, pages).map((token, index) => (
                    token === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={token}>
                            <PaginationLink
                                href="#"
                                isActive={token === current}
                                onClick={(event) => openPage(event, token)}
                            >
                                {token}
                            </PaginationLink>
                        </PaginationItem>
                    )
                ))}
                <PaginationItem>
                    <PaginationNext
                        href="#"
                        text="Дальше"
                        aria-label="Следующая страница"
                        aria-disabled={current >= pages}
                        tabIndex={current >= pages ? -1 : undefined}
                        className={current >= pages ? "pointer-events-none opacity-50" : undefined}
                        onClick={(event) => openPage(event, current + 1)}
                    />
                </PaginationItem>
            </PaginationContent>
            </Pagination>
        </div>
    );
}

function pageTokens(current: number, pages: number): Array<number | "ellipsis"> {
    if (pages <= 3) {
        return Array.from({ length: pages }, (_, index) => index + 1);
    }

    const start = Math.max(1, Math.min(current - 1, pages - 2));
    const tokens: Array<number | "ellipsis"> = [];
    if (start > 1) {
        tokens.push("ellipsis");
    }
    for (let number = start; number < start + 3; number += 1) {
        tokens.push(number);
    }
    if (start + 2 < pages) {
        tokens.push("ellipsis");
    }
    return tokens;
}
