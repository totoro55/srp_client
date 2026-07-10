import type { Metadata } from "next";
import "./globals.css";
import Head from "next/head";
import Providers from "@/app/providers";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import {SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import AppSideBar from "@/app/_components/appSideBar/appSideBar";
import Header from "@/app/_components/header/header";

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
      <body className="min-h-full w-full">
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
