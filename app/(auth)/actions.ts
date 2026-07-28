"use server";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { getDb } from "@/lib/db";
import { isUniqueEmailError } from "@/lib/db/errors";
import { roles, userRoles, users } from "@/lib/db/schema";
import { RedisUnavailableError } from "@/lib/redis";
import { recordAuditEvent } from "@/lib/auth/audit";
import { getSuperadminConfig } from "@/lib/auth/config";
import { sha256 } from "@/lib/auth/crypto";
import {
  hashPassword,
  passwordNeedsRehash,
  performDummyPasswordVerification,
  verifyPassword,
} from "@/lib/auth/password";
import { DEFAULT_USER_ROLE } from "@/lib/auth/permissions";
import { checkRateLimit, type RateLimitPolicy } from "@/lib/auth/rate-limit";
import { consumePasswordReset, issuePasswordReset } from "@/lib/auth/recovery";
import { digestClientIp, getClientIp } from "@/lib/auth/request";
import {
  createSession,
  revokeAllSessions,
  revokeCurrentSession,
} from "@/lib/auth/session";
import {
  createSuperadminChallenge,
  verifySuperadminPassword,
  verifySuperadminTotp,
} from "@/lib/auth/superadmin";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  superadminCredentialsSchema,
  superadminTotpSchema,
} from "@/lib/auth/validation";

export type AuthActionState = {
  status: "idle" | "error" | "success" | "mfa";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  challengeToken?: string;
};

const LOGIN_IP_POLICY: RateLimitPolicy = {
  capacity: 20,
  refillTokens: 20,
  refillIntervalMs: 10 * 60 * 1_000,
};
const LOGIN_ACCOUNT_POLICY: RateLimitPolicy = {
  capacity: 10,
  refillTokens: 10,
  refillIntervalMs: 15 * 60 * 1_000,
};
const SIGNUP_POLICY: RateLimitPolicy = {
  capacity: 5,
  refillTokens: 5,
  refillIntervalMs: 60 * 60 * 1_000,
};
const RECOVERY_POLICY: RateLimitPolicy = {
  capacity: 5,
  refillTokens: 5,
  refillIntervalMs: 60 * 60 * 1_000,
};
const SUPERADMIN_POLICY: RateLimitPolicy = {
  capacity: 5,
  refillTokens: 5,
  refillIntervalMs: 30 * 60 * 1_000,
};

function valuesFrom(formData: FormData, names: string[]) {
  return Object.fromEntries(names.map((name) => [name, formData.get(name)]));
}

async function invalidFields(
  fieldErrors: Record<string, string[] | undefined>,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth");
  const localizedMessages: Record<string, string> = {
    "Password must be at least 8 characters.": t("validation.passwordMin"),
    "Password must be at most 128 characters.": t("validation.passwordMax"),
    "Password is too long.": t("validation.passwordLong"),
    "Consent is required.": t("validation.dataConsent"),
    "Enter a valid email address.": t("validation.emailInvalid"),
    "Enter your full name.": t("validation.fullNameInvalid"),
    "Enter a valid day of birth.": t("validation.birthDayInvalid"),
    "Enter a valid birth month.": t("validation.birthMonthInvalid"),
    "Enter a valid birth year.": t("validation.birthYearInvalid"),
    "Enter a valid date of birth.": t("validation.birthDateInvalid"),
    "Date of birth cannot be in the future.": t("validation.birthDateFuture"),
    "Passwords do not match.": t("validation.passwordMismatch"),
    "Enter the six-digit authentication code.": t("validation.totpInvalid"),
  };

  return {
    status: "error",
    message: t("actions.checkFields"),
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).filter(
        (entry): entry is [string, string[]] => Boolean(entry[1]?.length),
      ).map(([field, messages]) => [
        field,
        messages.map((message) => localizedMessages[message] ?? message),
      ]),
    ),
  };
}

async function serviceUnavailable(): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  return {
    status: "error",
    message: t("serviceUnavailable"),
  };
}

async function invalidCredentials(): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  return {
    status: "error",
    message: t("invalidCredentials"),
  };
}

async function waitForMinimumDuration(startedAt: number, durationMs: number) {
  const remaining = durationMs - (Date.now() - startedAt);

  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

async function limit(scope: string, identity: string, policy: RateLimitPolicy) {
  const result = await checkRateLimit(scope, identity, policy);
  return result.allowed;
}

async function auditBestEffort(
  event: Parameters<typeof recordAuditEvent>[0],
) {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    console.error("Could not write authentication audit event", {
      action: event.action,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  let accountCreated = false;
  const parsed = signupSchema.safeParse(
    valuesFrom(formData, [
      "email",
      "fullName",
      "birthDay",
      "birthMonth",
      "birthYear",
      "password",
      "passwordConfirmation",
      "dataConsent",
    ]),
  );

  if (!parsed.success) {
    return invalidFields(parsed.error.flatten().fieldErrors);
  }

  try {
    const ip = await getClientIp();

    if (ip && !(await limit("signup:ip", ip, SIGNUP_POLICY))) {
      return {
        status: "error",
        message: t("signupRateLimit"),
      };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const db = getDb();
    const user = await db.transaction(async (tx) => {
      const [defaultRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.key, DEFAULT_USER_ROLE))
        .limit(1);

      if (!defaultRole) {
        throw new Error("Default USER role is not configured");
      }

      const [createdUser] = await tx
        .insert(users)
        .values({
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          passwordHash,
          birthDate: parsed.data.birthDate,
        })
        .returning({ id: users.id, sessionVersion: users.sessionVersion });

      await tx.insert(userRoles).values({
        userId: createdUser.id,
        roleId: defaultRole.id,
      });

      return createdUser;
    });

    const actor = {
      kind: "user" as const,
      userId: user.id,
      authVersion: user.sessionVersion,
    };
    accountCreated = true;
    await createSession(actor);
    await auditBestEffort({
      actor,
      action: "account.created",
      targetType: "user",
      targetId: user.id,
      metadata: { dataConsent: true },
    });
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return {
        status: "error",
        message: t("checkFields"),
        fieldErrors: { email: [t("emailInUse")] },
      };
    }

    if (error instanceof RedisUnavailableError) {
      if (accountCreated) {
        return {
          status: "success",
          message: t("accountCreatedLoginUnavailable"),
        };
      }

      return serviceUnavailable();
    }

    console.error("Signup failed", error);
    return serviceUnavailable();
  }

  redirect("/dashboard");
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  const parsed = loginSchema.safeParse(valuesFrom(formData, ["email", "password"]));

  if (!parsed.success) {
    return invalidCredentials();
  }

  try {
    const ip = await getClientIp();
    const [ipAllowed, accountAllowed] = await Promise.all([
      ip ? limit("login:ip", ip, LOGIN_IP_POLICY) : true,
      limit("login:account", parsed.data.email, LOGIN_ACCOUNT_POLICY),
    ]);

    if (!ipAllowed || !accountAllowed) {
      return {
        status: "error",
        message: t("loginRateLimit"),
      };
    }

    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    if (!user) {
      await performDummyPasswordVerification(parsed.data.password);
      return invalidCredentials();
    }

    const passwordValid = await verifyPassword(user.passwordHash, parsed.data.password);

    if (!passwordValid || user.status !== "ACTIVE") {
      return invalidCredentials();
    }

    if (passwordNeedsRehash(user.passwordHash)) {
      await db
        .update(users)
        .set({
          passwordHash: await hashPassword(parsed.data.password),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    const actor = {
      kind: "user" as const,
      userId: user.id,
      authVersion: user.sessionVersion,
    };
    await createSession(actor);
    await auditBestEffort({ actor, action: "auth.login_succeeded" });
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return serviceUnavailable();
    }

    console.error("Login failed", error);
    return serviceUnavailable();
  }

  redirect("/dashboard");
}

export async function superadminLoginAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  const isMfaStep =
    previousState.status === "mfa" || Boolean(formData.get("challengeToken"));

  if (isMfaStep) {
    try {
      const ip = await getClientIp();
      const ipDigest = digestClientIp(ip ?? "unavailable");
      const parsed = superadminTotpSchema.safeParse(
        valuesFrom(formData, ["challengeToken", "token"]),
      );

      if (!parsed.success) {
        return {
          ...(await invalidFields(parsed.error.flatten().fieldErrors)),
          challengeToken: String(formData.get("challengeToken") ?? ""),
          status: "mfa",
        };
      }

      if (
        !(await limit(
          "superadmin:mfa",
          sha256(parsed.data.challengeToken),
          SUPERADMIN_POLICY,
        ))
      ) {
        return {
          status: "mfa",
          challengeToken: parsed.data.challengeToken,
          message: t("tooManyAttemptsRestart"),
        };
      }

      const valid = await verifySuperadminTotp(
        parsed.data.challengeToken,
        parsed.data.token,
        ipDigest,
      );

      if (!valid) {
        return {
          status: "mfa",
          challengeToken: parsed.data.challengeToken,
          message: t("invalidAuthenticationCode"),
        };
      }

      const config = getSuperadminConfig();
      const actor = {
        kind: "builtin-superadmin" as const,
        subject: "builtin:superadmin" as const,
        credentialVersion: config.credentialVersion,
      };
      await createSession(actor, 2);
      await auditBestEffort({ actor, action: "auth.superadmin_login_succeeded" });
    } catch (error) {
      if (error instanceof RedisUnavailableError) {
        return serviceUnavailable();
      }

      console.error("Superadmin MFA failed", error);
      return serviceUnavailable();
    }

    redirect("/dashboard");
  }

  try {
    const ip = await getClientIp();
    const ipDigest = digestClientIp(ip ?? "unavailable");

    const parsed = superadminCredentialsSchema.safeParse(
      valuesFrom(formData, ["identifier", "password"]),
    );

    if (!parsed.success) {
      return { status: "error", message: t("invalidSuperadminCredentials") };
    }

    const [ipAllowed, identifierAllowed] = await Promise.all([
      ip ? limit("superadmin:ip", ip, SUPERADMIN_POLICY) : true,
      limit("superadmin:identifier", parsed.data.identifier, SUPERADMIN_POLICY),
    ]);

    if (!ipAllowed || !identifierAllowed) {
      return {
        status: "error",
        message: t("tooManyAttempts"),
      };
    }

    if (
      !(await verifySuperadminPassword(
        parsed.data.identifier,
        parsed.data.password,
      ))
    ) {
      await auditBestEffort({ action: "auth.superadmin_login_failed" });
      return { status: "error", message: t("invalidSuperadminCredentials") };
    }

    return {
      status: "mfa",
      challengeToken: await createSuperadminChallenge(ipDigest),
    };
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return serviceUnavailable();
    }

    console.error("Superadmin login failed", error);
    return serviceUnavailable();
  }
}

export async function initiateGoogleOAuthAction() {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function logoutAction() {
  try {
    await revokeCurrentSession();
  } catch (error) {
    console.error("Could not confirm server-side logout", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
  redirect("/login");
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  const genericSuccess: AuthActionState = {
    status: "success",
    message: t("recoverySent"),
  };
  const parsed = forgotPasswordSchema.safeParse(valuesFrom(formData, ["email"]));

  if (!parsed.success) {
    return genericSuccess;
  }

  const startedAt = Date.now();

  try {
    const ip = await getClientIp();
    const [ipAllowed, accountAllowed] = await Promise.all([
      ip ? limit("recovery:ip", ip, RECOVERY_POLICY) : true,
      limit("recovery:account", parsed.data.email, RECOVERY_POLICY),
    ]);

    if (!ipAllowed || !accountAllowed) {
      await waitForMinimumDuration(startedAt, 500);
      return genericSuccess;
    }

    const db = getDb();
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.email, parsed.data.email), eq(users.status, "ACTIVE")))
      .limit(1);

    if (user) {
      await issuePasswordReset(user.id, user.email);
    }
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return serviceUnavailable();
    }

    console.error("Password recovery request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  await waitForMinimumDuration(startedAt, 500);
  return genericSuccess;
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations("Auth.actions");
  const parsed = resetPasswordSchema.safeParse(
    valuesFrom(formData, ["token", "password", "passwordConfirmation"]),
  );

  if (!parsed.success) {
    return invalidFields(parsed.error.flatten().fieldErrors);
  }

  try {
    const ip = await getClientIp();
    const [ipAllowed, tokenAllowed] = await Promise.all([
      ip ? limit("reset:ip", ip, RECOVERY_POLICY) : true,
      limit("reset:token", sha256(parsed.data.token), RECOVERY_POLICY),
    ]);

    if (!ipAllowed || !tokenAllowed) {
      return {
        status: "error",
        message: t("resetRateLimit"),
      };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await consumePasswordReset(parsed.data.token, passwordHash);

    if (!user) {
      return {
        status: "error",
        message: t("invalidResetLink"),
      };
    }

    const actor = {
      kind: "user" as const,
      userId: user.id,
      authVersion: user.sessionVersion,
    };
    await revokeAllSessions(actor).catch(() => undefined);
    await auditBestEffort({
      actor,
      action: "account.password_reset",
      targetType: "user",
      targetId: user.id,
    });

    return {
      status: "success",
      message: t("resetSuccess"),
    };
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      return serviceUnavailable();
    }

    console.error("Password reset failed", error);
    return serviceUnavailable();
  }
}
