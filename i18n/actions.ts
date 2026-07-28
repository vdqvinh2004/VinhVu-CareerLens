"use server";

import { cookies } from "next/headers";

import { isLocale, localeCookieName, type Locale } from "./config";

async function setUserLocale(locale: Locale) {
  if (!isLocale(locale)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export { setUserLocale };
