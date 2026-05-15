import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { FAVICON_PATH } from "@/lib/branding";
import { getThemeBootstrapScript } from "@/lib/theme-storage";
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
  title: "LeadGenor – Guest Posting CRM & Cold Email Outreach Platform.",
  description:
    "Manage guest post vendors, clients and orders in one place. Automate cold email outreach, find emails, and run drip campaigns 10x faster than Google Sheets.",
  icons: {
    /** Matches `next.config` rewrite: `/favicon.ico` → `LeadGenor-site-icon.png` */
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: FAVICON_PATH, type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: FAVICON_PATH, type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background antialiased dark:bg-black`}
      >
        {/*
          Do not set className on <html> from React — hydration would overwrite `dark` from this script.
          Tailwind `dark:` variants use an ancestor `.dark` (we set it on document.documentElement).
        */}
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
