import { navigate } from "@/lib/browser-navigation";
import { getLocale, getTranslations } from "@/i18n/client";
import { z } from "zod";

import { generateCareerGuidance, type CareerGuidanceOutput } from "@/lib/careerlens";
import {
  buildCareerGuidanceInput,
  createCareerLensFormSchema,
  createCareerLensStoredFormSchema,
  type CareerLensStoredFormValues,
} from "@/lib/careerlens/form";
import {
  jobSearchLinks,
  type RelatedJobResult,
} from "@/lib/careerlens/job-search";
import { createCareerLensMarketSeed } from "@/lib/careerlens/market-seed";
import { getPreferredCareerModel } from "@/lib/careerlens/preferences";
import {
  followCareerRoadmap,
  saveCareerRoadmap,
  selectCareerRoadmapRecommendation,
  setCareerRoadmapTaskDone,
  stopFollowingCareerRoadmap,
} from "@/lib/careerlens/roadmaps";
import { getCareerStartingPointSnapshot } from "@/lib/careerlens/starting-point";
import { getVietnamProvinceNames } from "@/lib/careerlens/vietnam-provinces";

export type CareerLensActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  output?: CareerGuidanceOutput;
  roadmapId?: string;
  selectedRecommendationIndex?: number;
  formValues?: CareerLensStoredFormValues;
};

const roadmapIdSchema = z.string().uuid().optional();

export type RelatedJobsActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  jobs: RelatedJobResult[];
};

const initialRelatedJobsState: RelatedJobsActionState = {
  status: "idle",
  jobs: [],
};

export async function generateCareerPlanAction(
  _previousState: CareerLensActionState,
  formData: FormData,
): Promise<CareerLensActionState> {
  const [t, locale] = await Promise.all([getTranslations("Roadmap"), getLocale()]);

  if (formData.get("submitAction") !== "generate") {
    return { status: "idle" };
  }

  const provinces = await getVietnamProvinceNames();
  const parsed = createCareerLensFormSchema(provinces).safeParse({
    educationLevel: formData.get("educationLevel"),
    currentRegion: formData.get("currentRegion"),
    targetRegion: formData.get("targetRegion"),
    languages: formData.get("languages"),
    strongSubject: formData.get("strongSubject"),
    subjectScore: formData.get("subjectScore"),
    interests: formData.get("interests"),
    activity: formData.get("activity"),
    weeklyHours: formData.get("weeklyHours"),
    targetBudget: formData.get("targetBudget"),
    workEnvironment: formData.get("workEnvironment"),
    learningStyle: formData.get("learningStyle"),
    familyConstraints: formData.get("familyConstraints"),
    intent: formData.get("intent"),
    question: formData.get("question"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    const invalidFields = parsed.error.flatten().fieldErrors;
    const fieldMessages: Record<string, string> = {
      activity: t("actions.fields.activity"),
      consent: t("actions.fields.consent"),
      currentRegion: t("actions.fields.currentRegion"),
      educationLevel: t("actions.fields.educationLevel"),
      familyConstraints: t("actions.fields.familyConstraints"),
      interests: t("actions.fields.interests"),
      intent: t("actions.fields.intent"),
      languages: t("actions.fields.languages"),
      learningStyle: t("actions.fields.learningStyle"),
      question: t("actions.fields.question"),
      strongSubject: t("actions.fields.strongSubject"),
      subjectScore: t("actions.fields.subjectScore"),
      targetBudget: t("actions.fields.targetBudget"),
      targetRegion: t("actions.fields.targetRegion"),
      weeklyHours: t("actions.fields.weeklyHours"),
      workEnvironment: t("actions.fields.workEnvironment"),
    };

    return {
      status: "error",
      message: t("actions.checkFields"),
      fieldErrors: Object.fromEntries(
        Object.keys(invalidFields).map((field) => [
          field,
          [fieldMessages[field] ?? t("actions.invalidValue")],
        ]),
      ),
    };
  }

  const parsedRoadmapId = roadmapIdSchema.safeParse(
    formData.get("roadmapId") || undefined,
  );
  if (!parsedRoadmapId.success) {
    return {
      status: "error",
      message: t("actions.invalidValue"),
    };
  }

  const [startingPoint, savedModel] = await Promise.all([
    getCareerStartingPointSnapshot(),
    getPreferredCareerModel(),
  ]);
  const marketSeed = createCareerLensMarketSeed(provinces);
  const model = savedModel;

  const input = buildCareerGuidanceInput(
    parsed.data,
    "local",
    locale === "en" ? "en" : "vi",
    startingPoint,
    marketSeed,
  );

  try {
    const output = await generateCareerGuidance(input, {
      model,
    });
    const { consent: _consent, ...rawStoredValues } = parsed.data;
    void _consent;
    const formValues = createCareerLensStoredFormSchema(provinces).parse(rawStoredValues);
    const roadmapId = await saveCareerRoadmap({
      roadmapId: parsedRoadmapId.data,
      formValues,
      guidanceInput: input,
      guidanceOutput: output,
    });

    return {
      status: "success",
      message: t("actions.success"),
      output,
      roadmapId,
      selectedRecommendationIndex: 0,
      formValues,
    };
  } catch (error) {
    console.error("VinhVu CareerLen plan generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      status: "error",
      message: error instanceof Error ? error.message : t("actions.failed"),
    };
  }
}

export async function findRelatedJobsAction(
  previousState: RelatedJobsActionState = initialRelatedJobsState,
  formData: FormData,
): Promise<RelatedJobsActionState> {
  void previousState;

  const parsed = z
    .object({
      pathTitle: z.string().trim().min(1).max(300),
      location: z.string().trim().min(1).max(200),
      skills: z.string().trim().max(1_000).optional(),
    })
    .safeParse({
      pathTitle: formData.get("pathTitle"),
      location: formData.get("location") || "Vietnam",
      skills: formData.get("skills") || undefined,
    });
  if (!parsed.success) {
    return { status: "error", message: "Invalid search data.", jobs: [] };
  }

  const query = [parsed.data.pathTitle, parsed.data.skills].filter(Boolean).join(" ");
  return { status: "success", jobs: jobSearchLinks(query, parsed.data.location) };
}

export async function selectCareerRecommendationAction(formData: FormData) {

  const parsed = z
    .object({
      roadmapId: z.string().uuid(),
      recommendationIndex: z.coerce.number().int().min(0).max(9),
    })
    .safeParse({
      roadmapId: formData.get("roadmapId"),
      recommendationIndex: formData.get("recommendationIndex"),
    });
  if (!parsed.success) return;

  await selectCareerRoadmapRecommendation({
    roadmapId: parsed.data.roadmapId,
    recommendationIndex: parsed.data.recommendationIndex,
  });
  navigate("/dashboard/careerlens");
}

export async function followCareerRoadmapAction(formData: FormData) {

  const parsed = roadmapIdSchema.safeParse(formData.get("roadmapId") || undefined);
  if (!parsed.success || !parsed.data) return;

  await followCareerRoadmap({
    roadmapId: parsed.data,
  });

  navigate(`/dashboard/careerlens?roadmap=${parsed.data}`);
}

export async function stopFollowingCareerRoadmapAction() {

  await stopFollowingCareerRoadmap();
  navigate("/dashboard/careerlens");
}

export async function toggleCareerRoadmapTaskAction(formData: FormData) {

  const parsed = z
    .object({
      roadmapId: z.string().uuid(),
      taskId: z.string().trim().min(1).max(200),
      done: z.enum(["true", "false"]),
    })
    .safeParse({
      roadmapId: formData.get("roadmapId"),
      taskId: formData.get("taskId"),
      done: formData.get("done"),
    });
  if (!parsed.success) return;

  await setCareerRoadmapTaskDone({
    roadmapId: parsed.data.roadmapId,
    taskId: parsed.data.taskId,
    done: parsed.data.done === "true",
  });

}
