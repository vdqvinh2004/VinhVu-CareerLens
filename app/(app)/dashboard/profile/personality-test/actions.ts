"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { recordAuditEvent } from "@/lib/auth/audit";
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { personalityTestResults } from "@/lib/db/schema";
import {
  PERSONALITY_TEST_VERSION,
  personalityAnswersSchema,
  personalityQuestions,
  scorePersonalityTest,
  type PersonalityType,
} from "@/lib/personality-test";

export type PersonalityTestActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  result?: PersonalityType;
};

export async function submitPersonalityTestAction(
  _previousState: PersonalityTestActionState,
  formData: FormData,
): Promise<PersonalityTestActionState> {
  const [viewer, t] = await Promise.all([
    requireViewer(),
    getTranslations("PersonalityTest"),
  ]);

  if (viewer.actor.kind !== "user") {
    return { status: "error", message: t("actions.unavailable") };
  }

  const parsedAnswers = personalityAnswersSchema.safeParse(
    personalityQuestions.map((_, index) => formData.get(`answer-${index}`)),
  );

  if (!parsedAnswers.success) {
    return { status: "idle" };
  }

  const { result, scores } = scorePersonalityTest(parsedAnswers.data);
  const now = new Date();

  try {
    await getDb()
      .insert(personalityTestResults)
      .values({
        answers: parsedAnswers.data,
        completedAt: now,
        resultType: result,
        scores,
        testVersion: PERSONALITY_TEST_VERSION,
        updatedAt: now,
        userId: viewer.actor.userId,
      })
      .onConflictDoUpdate({
        target: personalityTestResults.userId,
        set: {
          answers: parsedAnswers.data,
          completedAt: now,
          resultType: result,
          scores,
          testVersion: PERSONALITY_TEST_VERSION,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.error("Personality test save failed", error);
    return { status: "error", message: t("actions.failed") };
  }

  try {
    await recordAuditEvent({
      actor: viewer.actor,
      action: "personality_test.completed",
      targetType: "user",
      targetId: viewer.actor.userId,
      metadata: { testVersion: PERSONALITY_TEST_VERSION },
    });
  } catch (error) {
    console.error("Could not write personality test audit event", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  revalidatePath("/dashboard/starting-point");
  revalidatePath("/dashboard/profile/personality-test");

  return { status: "success", message: t("actions.saved"), result };
}
