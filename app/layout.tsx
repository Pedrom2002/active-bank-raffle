import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Active Bank — Sorteio Fan Zone",
  description: "Sistema de sorteio para o stand Active Bank no Mundial 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
