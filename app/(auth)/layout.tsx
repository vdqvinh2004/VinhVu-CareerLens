import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandLink } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/dal";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();

  if (viewer) {
    redirect("/dashboard");
  }

  const t = await getTranslations("Common");

  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-muted/25 px-4 pb-16 pt-20 sm:px-6">
      <div aria-hidden="true" className="auth-grid-background" />
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 sm:right-6 sm:top-6">
        <LanguageSwitcher compact />
        <ThemeSelector />
      </div>
      <div className="relative z-10 w-full max-w-108">
        <BrandLink className="mb-6 ml-1" />
        <main>{children}</main>
      </div>
      <nav
        aria-label={t("legalNavigation")}
        className="fixed bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-border/80 bg-background/85 px-4 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur-md"
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
  );
}
