"use client";
import { createTranslator, NextIntlClientProvider, type AbstractIntlMessages, type TranslationValues } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";
import { isLocale, type Locale } from "./config";
const key = "careerlens.locale.v1";
const messages = { en, vi };
export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const locale = localStorage.getItem(key) ?? undefined;
  return isLocale(locale) ? locale : "en";
}
export function getTranslations(namespace?: string): (key: string, values?: TranslationValues) => string {
  const locale = getLocale();
  const translate = createTranslator({ locale, messages: messages[locale] as AbstractIntlMessages }) as (key: string, values?: TranslationValues) => string;
  return (key, values) => translate(namespace ? `${namespace}.${key}` : key, values);
}
export function setUserLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  localStorage.setItem(key, locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event("careerlens-locale"));
}
function subscribe(listener: () => void) {
  window.addEventListener("careerlens-locale", listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener("careerlens-locale", listener); window.removeEventListener("storage", listener); };
}
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getLocale, () => "en" as const);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Ho_Chi_Minh">{children}</NextIntlClientProvider>;
}
