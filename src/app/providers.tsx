'use client'

import {ReactNode} from "react";
import {SessionProvider} from "next-auth/react";
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
                </TooltipProvider>
            </ThemeProvider>
        </SessionProvider>
    )
}