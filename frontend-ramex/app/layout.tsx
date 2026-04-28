import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAMEX Sequential Analysis Framework",
  description: "Artefacto digital para análise sequêncial inspirado no RAMEX",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
