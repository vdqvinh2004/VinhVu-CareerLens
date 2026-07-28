// Helper for calling Google APIs on behalf of a user.
// Use getValidGoogleToken(userId) before any Google API call — it automatically refresh accessToken
import "server-only";

import { eq, and } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { oauthAccounts } from "@/lib/db/schema";

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000; // refresh 1 minute before expiry

interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
}

async function refreshGoogleToken(refreshToken: string): Promise<GoogleRefreshResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed: ${body}`);
  }

  return res.json();
}

export class GoogleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleTokenError";
  }
}

export async function getValidGoogleToken(userId: string): Promise<string> {
  const db = getDb();

  const [account] = await db
    .select({
      accessToken: oauthAccounts.accessToken,
      refreshToken: oauthAccounts.refreshToken,
      tokenExpiresAt: oauthAccounts.tokenExpiresAt,
    })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, "google"),
      ),
    );

  if (!account) {
    throw new GoogleTokenError("No Google account linked to this user.");
  }

  if (!account.accessToken) {
    throw new GoogleTokenError("No Google access token found.");
  }

  const isExpired =
    account.tokenExpiresAt &&
    account.tokenExpiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS < Date.now();

  if (!isExpired) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new GoogleTokenError(
      "Google access token expired and no refresh token available. User must re-authenticate.",
    );
  }

  const refreshed = await refreshGoogleToken(account.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await db
    .update(oauthAccounts)
    .set({
      accessToken: refreshed.access_token,
      tokenExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(oauthAccounts.userId, userId),
        eq(oauthAccounts.provider, "google"),
      ),
    );

  return refreshed.access_token;
}
