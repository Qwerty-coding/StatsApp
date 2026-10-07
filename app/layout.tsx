import type { Metadata, Viewport } from "next";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stats-app-ecru.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "VibeCheck | Group Chat Analytics",
  description:
    "Privacy-first WhatsApp chat analyzer. Generate shareable Wrapped cards locally in your browser without uploading your data.",
  keywords: [
    "WhatsApp analytics",
    "chat analyzer",
    "WhatsApp Wrapped",
    "Telegram stats",
    "group chat insights",
    "word cloud",
    "chat export analysis",
  ],
  applicationName: "VibeCheck",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VibeCheck",
    title: "VibeCheck — Your group chat, turned into a story",
    description:
      "Drop a WhatsApp or Telegram export and get a Wrapped-style dashboard: stats, Time Machine, Connection Web, Emoji Galaxy, Vibe Score. 100% in-browser, zero uploads.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "VibeCheck — your group chat, turned into a story" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeCheck — Your group chat, turned into a story",
    description:
      "Privacy-first chat analytics. Wrapped-style dashboard, entirely in your browser. No uploads, no accounts, no tracking.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
