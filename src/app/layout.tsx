import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { ConfigBanner } from "@/components/shell/ConfigBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Who Is My Ancestor · Market lineage for crypto assets",
    template: "%s · Who Is My Ancestor",
  },
  description:
    "Explore the hidden market relationships between cryptocurrencies. Every asset has a story — discover yours using CoinMarketCap data.",
  metadataBase: new URL("https://whoismyancestor.app"),
  openGraph: {
    title: "Who Is My Ancestor",
    description:
      "A new way to explore relationships inside the cryptocurrency universe.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-canvas text-ink-primary antialiased">
        <SiteHeader />
        <ConfigBanner />
        <main className="mx-auto max-w-[1240px] px-5 sm:px-7">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}