"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { recordAuditEvent } from "@/lib/auth/audit";
import { requireViewer } from "@/lib/auth/dal";
import { profileSchema } from "@/lib/auth/validation";
import { getDb } from "@/lib/db";
import { isUniqueEmailError } from "@/lib/db/errors";
import { users } from "@/lib/db/schema";

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

async function auditBestEffort(
  event: Parameters<typeof recordAuditEvent>[0],
) {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    console.error("Could not write profile audit event", {
      action: event.action,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const [viewer, t] = await Promise.all([
    requireViewer(),
    getTranslations("Profile"),
  ]);

  if (viewer.actor.kind !== "user") {
    return { status: "error", message: t("actions.unavailable") };
  }

  const parsed = profileSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    birthDay: formData.get("birthDay"),
    birthMonth: formData.get("birthMonth"),
    birthYear: formData.get("birthYear"),
  });

  if (!parsed.success) {
    const invalidFields = parsed.error.flatten().fieldErrors;
    const messages: Record<string, string> = {
      email: t("validation.email"),
      fullName: t("validation.fullName"),
      birthDate: t("validation.birthDate"),
      birthDay: t("validation.birthDay"),
      birthMonth: t("validation.birthMonth"),
      birthYear: t("validation.birthYear"),
    };

    return {
      status: "error",
      message: t("actions.checkFields"),
      fieldErrors: Object.fromEntries(
        Object.keys(invalidFields).map((field) => [
          field,
          [messages[field] ?? t("actions.checkFields")],
        ]),
      ),
    };
  }

  try {
    const [updatedUser] = await getDb()
      .update(users)
      .set({
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        birthDate: parsed.data.birthDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, viewer.actor.userId))
      .returning({ id: users.id });

    if (!updatedUser) {
      return { status: "error", message: t("actions.failed") };
    }

    await auditBestEffort({
      actor: viewer.actor,
      action: "profile.updated",
      targetType: "user",
      targetId: updatedUser.id,
      metadata: {
        fields: ["fullName", "email", "birthDate"],
      },
    });
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return {
        status: "error",
        message: t("actions.emailInUse"),
        fieldErrors: { email: [t("actions.emailInUse")] },
      };
    }

    console.error("Profile update failed", error);
    return { status: "error", message: t("actions.failed") };
  }

  revalidatePath("/dashboard", "layout");

  return { status: "success", message: t("actions.saved") };
}
