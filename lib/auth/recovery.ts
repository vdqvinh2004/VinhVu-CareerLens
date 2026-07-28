import "server-only";

import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";

import { getAppUrl, getResetTokenSecret } from "./config";
import { createOpaqueToken, hmacSha256 } from "./crypto";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1_000;

function hashResetToken(token: string) {
  return hmacSha256(`password-reset:${token}`, getResetTokenSecret());
}

export async function issuePasswordReset(userId: string, email: string) {
  const db = getDb();
  const token = createOpaqueToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    await tx.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  });

  const resetUrl = new URL("/reset-password", getAppUrl());
  resetUrl.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "Reset your CareerLens password",
    text: `Reset your password: ${resetUrl.toString()}\n\nThis link expires in 30 minutes.`,
    html: `<p>Reset your CareerLens password using the link below.</p><p><a href="${resetUrl.toString()}">Reset password</a></p><p>This link expires in 30 minutes.</p>`,
  });
}

export async function consumePasswordReset(
  token: string,
  newPasswordHash: string,
) {
  const db = getDb();
  const tokenHash = hashResetToken(token);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    if (!claimed) {
      return null;
    }

    const [user] = await tx
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(users.id, claimed.userId))
      .returning({ id: users.id, sessionVersion: users.sessionVersion });

    if (!user) {
      throw new Error("Password reset user no longer exists");
    }

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          ne(passwordResetTokens.tokenHash, tokenHash),
        ),
      );

    return user;
  });
}
