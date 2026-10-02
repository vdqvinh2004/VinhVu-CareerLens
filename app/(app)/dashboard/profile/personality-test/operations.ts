import { getTranslations } from "@/i18n/client";
import { updateWorkspace } from "@/lib/browser-storage";
import { personalityAnswersSchema, personalityQuestions, scorePersonalityTest, type PersonalityType } from "@/lib/personality-test";
export type PersonalityTestActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  result?: PersonalityType;
};

export async function submitPersonalityTestAction(_previousState: PersonalityTestActionState, formData: FormData): Promise<PersonalityTestActionState> {
  const t = getTranslations("PersonalityTest");
  const parsedAnswers = personalityAnswersSchema.safeParse(
    personalityQuestions.map((_, index) => formData.get(`answer-${index}`)),
  );

  if (!parsedAnswers.success) {
    return { status: "idle" };
  }

  const { result, scores } = scorePersonalityTest(parsedAnswers.data);
  try {
    updateWorkspace(state => { state.personality = { resultType: result, scores, completedAt: new Date().toISOString() }; });
    return { status: "success", message: t("actions.saved"), result };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : t("actions.failed") }; }
}
