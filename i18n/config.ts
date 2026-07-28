const locales = ["en", "vi"] as const;

type Locale = (typeof locales)[number];

const defaultLocale: Locale = "en";
const localeCookieName = "NEXT_LOCALE";

function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export {
  defaultLocale,
  isLocale,
  localeCookieName,
  locales,
  type Locale,
};
