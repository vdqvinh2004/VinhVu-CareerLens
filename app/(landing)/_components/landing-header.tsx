import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandLink } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSelector } from "@/components/theme-selector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/auth/dal";

import { LandingMobileNavigation } from "./landing-mobile-navigation";

async function LandingHeader() {
  const [viewer, t] = await Promise.all([
    getViewer().catch(() => null),
    getTranslations("Landing"),
  ]);
  const navigation = [
    { href: "#features", label: t("navigation.features") },
    { href: "#journey", label: t("navigation.journey") },
    { href: "#market", label: t("navigation.market") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <nav
        aria-label={t("primaryNavigation")}
        className="mx-auto flex h-16 w-full max-w-360 items-center gap-4 px-4 sm:px-6 lg:px-8"
      >
        <BrandLink compact className="sm:hidden" />
        <BrandLink className="hidden sm:inline-flex" />

        <div className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LandingMobileNavigation items={navigation} label={t("navigation.menu")} />

          <LanguageSwitcher compact />
          <ThemeSelector />

          <Link
            href={viewer ? "/dashboard" : "/login"}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            {t("account")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export { LandingHeader };
