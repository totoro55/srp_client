import type { Metadata } from "next";
import "./globals.css";
import Head from "next/head";
import Providers from "@/app/providers";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import {SidebarProvider} from "@/components/ui/sidebar";
import Header from "@/app/_components/header/header";
import {AppSideBar} from "@/app/_components/appSideBar/AppSideBar";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "СРП",
  description: "Система рассчета премии дивизиона Юг",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans", inter.variable)}
    >
    <Head>
      {/* <link rel="shortcut icon" href={favicon} /> */}
      <link rel="shortcut icon" href="/icon.ico" />
    </Head>
    <body
        className={cn(
            inter.className,
            // ГЛАВНОЕ ИСПРАВЛЕНИЕ:
            // h-full и w-full задают четкие границы 100% экрана.
            // overflow-x-hidden полностью запрещает всему сайту улетать вправо.
            // min-h-screen гарантирует, что фон не оборвется.
            "h-full w-full min-h-screen bg-background text-foreground overflow-x-hidden"
        )}>
      <Providers>
        <SidebarProvider defaultOpen={false}>
          <AppSideBar />
          <main className="w-full">
            <Header />
            {children}
          </main>
        </SidebarProvider>
      </Providers>
      </body>
    </html>
  );
}
