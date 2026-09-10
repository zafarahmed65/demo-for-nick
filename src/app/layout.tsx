import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Moteur de leads — bac à sable technique",
  description:
    "Démonstration d'architecture : acheminement de leads immobiliers par juridiction, capacité et langue, avec escalade automatique et attribution du clic à la transaction.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* French is the default render, not a toggle. Quebec is the launch market
       and the Charter of the French Language makes FR the default obligation. */
    <html
      lang="fr-CA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
