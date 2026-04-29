import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActivoBank — Sorteio Fan Zone",
  description: "Sistema de sorteio para o stand ActivoBank no Mundial 2026",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="pt" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full bg-white text-[#0A0A0A]" nonce={nonce}>{children}</body>
    </html>
  );
}
