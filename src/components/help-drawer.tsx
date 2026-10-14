"use client";

import { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function HelpDrawer({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Sheet>
            <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <CircleHelp />
                Справка
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader className="pr-10">
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto px-4 pb-6 text-sm leading-relaxed">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
