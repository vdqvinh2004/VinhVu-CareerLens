"use client";

import { useTransition, type SVGProps } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setUserLocale } from "@/i18n/actions";
import { isLocale, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  align?: "start" | "center" | "end";
  className?: string;
  compact?: boolean;
};

function LanguageFlag({ locale }: { locale: Locale }) {
  const svgProps: SVGProps<SVGSVGElement> = {
    "aria-hidden": true,
    className: "h-4 w-6 shrink-0 rounded-[2px]",
    viewBox: "0 0 24 16",
  };

  if (locale === "vi") {
    return (
      <svg {...svgProps}>
        <rect width="24" height="16" fill="#da251d" />
        <path
          d="m12 2.4 1.6 4.2 4.5.3-3.5 2.8 1.1 4.3-3.7-2.4-3.7 2.4 1.1-4.3-3.5-2.8 4.5-.3z"
          fill="#ff0"
        />
      </svg>
    );
  }

  return (
    <svg {...svgProps}>
      <rect width="24" height="16" fill="#012169" />
      <path d="m0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" />
      <path d="m0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.5" />
      <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.5" />
    </svg>
  );
}

function LanguageSwitcher({
  align = "end",
  className,
  compact = false,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Common.language");
  const [pending, startTransition] = useTransition();
  const currentLocale: Locale = locale === "vi" ? "vi" : "en";
  const languages = [
    { label: t("english"), locale: "en" },
    { label: t("vietnamese"), locale: "vi" },
  ] satisfies Array<{ label: string; locale: Locale }>;
  const currentLanguage =
    currentLocale === "vi" ? languages[1] : languages[0];

  function switchLanguage(nextLocale: string) {
    if (!isLocale(nextLocale) || nextLocale === currentLocale) {
      return;
    }

    startTransition(async () => {
      await setUserLocale(nextLocale);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size={compact ? "icon" : "sm"}
            title={
              compact
                ? t("current", { language: currentLanguage.label })
                : undefined
            }
            aria-label={t("current", { language: currentLanguage.label })}
            disabled={pending}
            className={cn(!compact && "w-full justify-start", className)}
          />
        }
      >
        <LanguageFlag locale={currentLanguage.locale} />
        {!compact && (
          <>
            <span className="truncate">{currentLanguage.label}</span>
            <ChevronDown
              data-icon="inline-end"
              aria-hidden="true"
              className="ml-auto"
            />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={8} className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("select")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentLocale}
            onValueChange={switchLanguage}
          >
            {languages.map((language) => (
              <DropdownMenuRadioItem
                key={language.locale}
                value={language.locale}
                disabled={pending}
              >
                <LanguageFlag locale={language.locale} />
                <span>{language.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { LanguageSwitcher };
