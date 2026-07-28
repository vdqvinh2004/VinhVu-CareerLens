"use client";

import type { ComponentType, SVGProps } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  isThemePreference,
  themePreferences,
  type ThemePreference,
} from "@/lib/theme";

type ThemeOption = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const themeOptions: Record<ThemePreference, ThemeOption> = {
  system: { icon: Monitor },
  light: { icon: Sun },
  dark: { icon: Moon },
};

type ThemeSelectorProps = {
  className?: string;
};

function ThemeIcon({
  theme,
}: {
  theme: ThemePreference;
}) {
  const Icon = themeOptions[theme].icon;

  return (
    <span
      aria-hidden="true"
      className="relative flex size-4 shrink-0 items-center justify-center"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -8 }}
          animate={{ opacity: 1, rotate: 0 }}
          exit={{ opacity: 0, rotate: 8 }}
          transition={{ duration: 0.12 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.8}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function useThemeCycle() {
  const t = useTranslations("Theme");
  const { theme, setTheme } = useTheme();
  const currentIndex = themePreferences.indexOf(theme);
  const nextTheme = themePreferences[(currentIndex + 1) % themePreferences.length];
  const currentThemeLabel = t(theme);
  const nextThemeLabel = t(nextTheme);

  return {
    currentThemeLabel,
    nextTheme,
    nextThemeLabel,
    setTheme,
    t,
    theme,
  };
}

function ThemeSelector({ className }: ThemeSelectorProps) {
  const {
    currentThemeLabel,
    nextTheme,
    nextThemeLabel,
    setTheme,
    t,
    theme,
  } = useThemeCycle();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={t("currentSwitch", {
        theme: currentThemeLabel,
        nextTheme: nextThemeLabel,
      })}
      aria-label={t("currentSwitch", {
        theme: currentThemeLabel,
        nextTheme: nextThemeLabel,
      })}
      onClick={() => setTheme(nextTheme)}
      className={className}
    >
      <ThemeIcon theme={theme} />
    </Button>
  );
}

function ThemeMenuToggleGroup() {
  const t = useTranslations("Theme");
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-2 py-1.5">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t("menuLabel")}
      </p>
      <ToggleGroup
        value={[theme]}
        onValueChange={(value) => {
          const nextTheme = value[0];

          if (isThemePreference(nextTheme)) {
            setTheme(nextTheme);
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={t("menuLabel")}
        className="w-full"
      >
        {themePreferences.map((preference) => {
          const Icon = themeOptions[preference].icon;

          return (
            <ToggleGroupItem
              key={preference}
              value={preference}
              aria-label={t(preference)}
              title={t(preference)}
              className={
                preference === "system"
                  ? "flex-[1.35] px-2 text-xs"
                  : "flex-1 px-2 text-xs"
              }
            >
              <Icon data-icon="inline-start" aria-hidden="true" strokeWidth={1.8} />
              {t(preference)}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

export { ThemeMenuToggleGroup, ThemeSelector };
