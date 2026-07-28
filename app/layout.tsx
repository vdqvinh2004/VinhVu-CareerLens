import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { AppPreloader } from "@/components/app-preloader";
import { MotionProvider } from "@/components/motion-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { preloaderInitializationScript } from "@/lib/preloader";
import { themeInitializationScript } from "@/lib/theme";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "CareerLens",
  authors: [{ name: "MeshMind-AI" }],
  creator: "MeshMind-AI",
  title: {
    default: "CareerLens",
    template: "%s | CareerLens",
  },
  description: "CareerLens",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const daySeed = new Date().toISOString().slice(0, 10);

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        inter.variable,
        geistMono.variable,
      )}
    >
      <head>
        {/* Inline init scripts run before React hydration — dev warning is expected and harmless */}
        {/* biome-ignore lint: required for FOUC prevention */}
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        {/* biome-ignore lint: required for preloader */}
        <script dangerouslySetInnerHTML={{ __html: preloaderInitializationScript }} />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <NextIntlClientProvider>
          <ThemeProvider>
            <MotionProvider>
              <AppPreloader daySeed={daySeed}>{children}</AppPreloader>
            </MotionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
