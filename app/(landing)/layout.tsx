import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SkipLink } from "@/components/skip-link";

import { LandingHeader } from "./_components/landing-header";

export default async function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("Common");

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink href="#landing-content" />
      <LandingHeader />
      <main id="landing-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border/80 bg-background">
        <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold tracking-tight">
              {t("brandName")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("developedBy")}
            </span>
          </div>
          <nav
            aria-label={t("legalNavigation")}
            className="flex items-center gap-3 text-xs font-medium text-muted-foreground"
          >
            <Link className="transition-colors hover:text-foreground" href="/terms">
              {t("termsOfService")}
            </Link>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <Link
              className="transition-colors hover:text-foreground"
              href="/privacy"
            >
              {t("privacyPolicy")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
