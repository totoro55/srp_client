'use client';

import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface AdminToolbarProps {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    children?: ReactNode;
}

export function AdminToolbar({
    search,
    onSearchChange,
    searchPlaceholder,
    children,
}: AdminToolbarProps) {
    return (
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-9 pl-9 text-xs"
                />
            </div>
            {children ? (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    {children}
                </div>
            ) : null}
        </div>
    );
}
