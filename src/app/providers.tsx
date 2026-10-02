'use client'

import {ReactNode} from "react";
import {SessionProvider} from "next-auth/react";
import {Toaster} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import { ThemeProvider } from "./providers/theme-provider";

export default function Providers({children}: { children: ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <TooltipProvider>
                    {children}
                    <Toaster position="top-right" closeButton />
                </TooltipProvider>
            </ThemeProvider>
        </SessionProvider>
    )
}