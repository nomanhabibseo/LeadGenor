import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { LOGO_PATH } from "@/lib/branding";
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
  title: "LeadGenor",
  description: "Guest post management SaaS",
  icons: [{ rel: "icon", url: LOGO_PATH }],
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
