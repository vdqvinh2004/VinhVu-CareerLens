import { getTranslations } from "@/i18n/client";

import {
  resetRoadmapPrefillData,
  saveRoadmapDataPreference,
} from "@/lib/careerlens/preferences";

export type CareerSettingsActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveRoadmapDataSettingsAction(
  _previousState: CareerSettingsActionState,
  formData: FormData,
): Promise<CareerSettingsActionState> {
  const t = await getTranslations("Settings");

  const reuseLatestRoadmapData =
    formData.get("reuseLatestRoadmapData") === "on";
  await saveRoadmapDataPreference(
    reuseLatestRoadmapData,
  );

  return {
    status: "success",
    message: t("actions.roadmapDataSaved"),
  };
}

export async function resetRoadmapPrefillDataAction(
  _previousState: CareerSettingsActionState,
  _formData: FormData,
): Promise<CareerSettingsActionState> {
  void _previousState;
  void _formData;
  const t = await getTranslations("Settings");

  await resetRoadmapPrefillData();

  return {
    status: "success",
    message: t("actions.roadmapDataReset"),
  };
}
