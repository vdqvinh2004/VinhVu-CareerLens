import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { oauthAccounts, userRoles, roles, users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  verified_email: boolean;
}

async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) throw new Error("Failed to exchange code");
  return res.json();
}

async function getGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to fetch user info");
  return res.json();
}

async function handleCallback(code: string): Promise<string> {
  const { access_token, refresh_token, expires_in } = await exchangeCode(code);
  const googleUser = await getGoogleUser(access_token);
  const tokenExpiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

  if (!googleUser.verified_email) return "/login?error=email_not_verified";

  const db = getDb();

  const [existingOauth] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, "google"),
        eq(oauthAccounts.providerAccountId, googleUser.id),
      ),
    );

  let userId: string;

  const tokenValues = {
    accessToken: access_token,
    refreshToken: refresh_token ?? null,
    tokenExpiresAt,
    updatedAt: new Date(),
  };

  if (existingOauth) {
    userId = existingOauth.userId;
    await db
      .update(oauthAccounts)
      .set(tokenValues)
      .where(
        and(
          eq(oauthAccounts.provider, "google"),
          eq(oauthAccounts.providerAccountId, googleUser.id),
        ),
      );
  } else {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, googleUser.email.toLowerCase()));

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const [userRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, "USER"));

      const [newUser] = await db
        .insert(users)
        .values({
          fullName: googleUser.name,
          email: googleUser.email.toLowerCase(),
          passwordHash: "oauth:google",
          birthDate: "1970-01-01",
        })
        .returning({ id: users.id });

      userId = newUser.id;

      if (userRole) {
        await db.insert(userRoles).values({ userId, roleId: userRole.id });
      }
    }

    await db.insert(oauthAccounts).values({
      userId,
      provider: "google",
      providerAccountId: googleUser.id,
      ...tokenValues,
    });
  }

  const [user] = await db
    .select({ id: users.id, sessionVersion: users.sessionVersion, status: users.status })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || user.status !== "ACTIVE") return "/login?error=account_disabled";

  await createSession({ kind: "user", userId: user.id, authVersion: user.sessionVersion });

  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  cookieStore.delete("oauth_state");

  if (!code || !state || state !== savedState) {
    redirect("/login?error=oauth_failed");
  }

  let destination = "/login?error=oauth_failed";

  try {
    destination = await handleCallback(code);
  } catch (err) {
    console.error("[google/callback]", err);
  }

  redirect(destination);
}
