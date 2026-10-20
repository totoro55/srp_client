import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import "./globals.css";
import Providers from "@/app/providers";
import { Inter } from "next/font/google";
import { authOptions } from "@/auth";
import { cn } from "@/lib/utils";
import { AppFrame } from "@/app/_components/AppFrame";
import { NoticeBanner } from "@/app/_components/NoticeBanner";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "СРП",
  description: "Система рассчета премии дивизиона Юг",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans", inter.variable)}
    >
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
        <AppFrame initialSignedIn={Boolean(session)} notice={<NoticeBanner />}>
          {children}
        </AppFrame>
      </Providers>
      </body>
    </html>
  );
}
