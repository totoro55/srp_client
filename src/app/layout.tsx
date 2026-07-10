import type { Metadata } from "next";
import "./globals.css";
import Head from "next/head";
import Nav from "@/app/_components/nav";


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
      className={`h-full antialiased`}
    >
    <Head>
      {/* <link rel="shortcut icon" href={favicon} /> */}
      <link rel="shortcut icon" href="icon.ico" />
    </Head>
      <body className="min-h-full">
      <Nav/>
      {children}
      </body>
    </html>
  );
}
