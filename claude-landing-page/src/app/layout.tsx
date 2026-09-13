import type { Metadata, Viewport } from "next";
import { inter, jetbrains, nunito } from "./fonts";
import { site } from "@/lib/site";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const title = "Telegate — More life. Less screen.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: title, template: "%s · Telegate" },
  description: site.description,
  applicationName: "Telegate",
  keywords: ["Telegate", "voice delegation", "Claude Code", "Codex", "OpenClaw", "Hermes Agent", "open source iOS app", "self-hosted"],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Telegate",
    title,
    description: site.description,
    locale: "en_CA",
  },
  twitter: { card: "summary_large_image", title, description: site.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#14212a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-ground="paper" className={`${nunito.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full bg-ground font-body text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
