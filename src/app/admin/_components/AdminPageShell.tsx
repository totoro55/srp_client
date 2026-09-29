import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminPageShell({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
            {children}
        </div>
    );
}
