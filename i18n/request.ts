import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  defaultLocale,
  isLocale,
  localeCookieName,
  type Locale,
} from "./config";

const messageLoaders: Record<
  Locale,
  () => Promise<{ default: typeof import("../messages/en.json") }>
> = {
  en: () => import("../messages/en.json"),
  vi: () => import("../messages/vi.json"),
};

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  const cookieLocale = (await cookies()).get(localeCookieName)?.value;
  const locale = isLocale(explicitLocale)
    ? explicitLocale
    : isLocale(cookieLocale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
  };
});
