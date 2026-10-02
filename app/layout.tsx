import type { Metadata, Viewport } from "next";
import { Hind, Kalam, Yatra_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LangProvider } from "@/components/Lang";
import { serverLang, siteUrl } from "@/lib/http";
import "./globals.css";

const yatra = Yatra_One({ weight: "400", subsets: ["latin", "devanagari"], variable: "--font-yatra", display: "swap" });
const hind = Hind({ weight: ["400", "500", "600"], subsets: ["latin", "devanagari"], variable: "--font-hind", display: "swap" });
const kalam = Kalam({ weight: ["400"], subsets: ["latin", "devanagari"], variable: "--font-kalam", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Yaadon Ki Rasoi — Shazam for the taste of your childhood", template: "%s · Yaadon Ki Rasoi" },
  description: "Describe a festive dish you remember but can't name. We find it with live search, map its names across India, and let your family light a diya for it.",
  applicationName: "Yaadon Ki Rasoi",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Yaadon Ki Rasoi", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#120a06",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await serverLang();
  return (
    <html lang="en-IN" className={`${yatra.variable} ${hind.variable} ${kalam.variable}`}>
      <body>
        <LangProvider initial={lang}>{children}</LangProvider>
        <Analytics />
      </body>
    </html>
  );
}
