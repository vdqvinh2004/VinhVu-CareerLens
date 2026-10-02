import { getTranslations } from "@/i18n/client";
import { updateWorkspace } from "@/lib/browser-storage";
import { profileSchema } from "@/lib/profile-validation";
export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function updateProfileAction(_previousState: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const t = getTranslations("Profile");
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
    updateWorkspace(state => { state.profile = parsed.data; });
    return { status: "success", message: t("actions.saved") };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : t("actions.failed") }; }
}
