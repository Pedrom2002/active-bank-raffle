import type { Metadata } from "next";
import { Inter } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={`h-full ${inter.variable}`}>
      <body className="min-h-full bg-white text-[#0A0A0A]">{children}</body>
    </html>
  );
}
