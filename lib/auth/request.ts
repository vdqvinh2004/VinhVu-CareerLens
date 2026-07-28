import "server-only";

import { headers } from "next/headers";

import { getRateLimitSecret, trustProxyHeaders } from "./config";
import { hmacSha256 } from "./crypto";

export async function getClientIp() {
  if (!trustProxyHeaders()) {
    return null;
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headerStore.get("x-real-ip")?.trim() || null;
}

export function digestClientIp(ip: string) {
  return hmacSha256(`ip:${ip}`, getRateLimitSecret());
}
