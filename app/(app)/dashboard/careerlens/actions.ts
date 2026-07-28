"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { AVAILABLE_MODELS, DEFAULT_MODEL, generateAIJson } from "@/lib/ai";
import { generateCareerGuidance, type CareerGuidanceOutput } from "@/lib/careerlens";
import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  buildCareerGuidanceInput,
  createCareerLensFormSchema,
  createCareerLensStoredFormSchema,
  type CareerLensStoredFormValues,
} from "@/lib/careerlens/form";
import {
  fetchLinkedInJobs,
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

const rankedJobsSchema = z.object({
  jobs: z
    .array(
      z.object({
        url: z.url(),
        reason: z.string().trim().min(1).max(300),
      }),
    )
    .max(8),
});

export async function generateCareerPlanAction(
  _previousState: CareerLensActionState,
  formData: FormData,
): Promise<CareerLensActionState> {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  const [t, locale] = await Promise.all([getTranslations("Roadmap"), getLocale()]);

  if (viewer.actor.kind !== "user") {
    return {
      status: "error",
      message: t("actions.userOnly"),
    };
  }

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
    getCareerStartingPointSnapshot(viewer.actor.userId),
    getPreferredCareerModel(viewer.actor.userId),
  ]);
  const marketSeed = createCareerLensMarketSeed(provinces);
  const model = AVAILABLE_MODELS.includes(savedModel)
    ? savedModel
    : DEFAULT_MODEL;

  const input = buildCareerGuidanceInput(
    parsed.data,
    viewer.actor.userId,
    locale === "en" ? "en" : "vi",
    startingPoint,
    marketSeed,
  );

  try {
    const output = await generateCareerGuidance(input, {
      model,
      userId: viewer.actor.userId,
    });
    const { consent: _consent, ...rawStoredValues } = parsed.data;
    void _consent;
    const formValues = createCareerLensStoredFormSchema(provinces).parse(rawStoredValues);
    const roadmapId = await saveCareerRoadmap({
      roadmapId: parsedRoadmapId.data,
      userId: viewer.actor.userId,
      formValues,
      guidanceInput: input,
      guidanceOutput: output,
    });

    revalidatePath("/dashboard/careerlens");

    return {
      status: "success",
      message: t("actions.success"),
      output,
      roadmapId,
      selectedRecommendationIndex: 0,
      formValues,
    };
  } catch (error) {
    console.error("CareerLens plan generation failed", {
      userId: viewer.actor.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      status: "error",
      message: t("actions.failed"),
    };
  }
}

export async function findRelatedJobsAction(
  previousState: RelatedJobsActionState = initialRelatedJobsState,
  formData: FormData,
): Promise<RelatedJobsActionState> {
  void previousState;
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") {
    return { status: "error", message: "User account required.", jobs: [] };
  }

  const parsed = z
    .object({
      pathTitle: z.string().trim().min(1).max(300),
      location: z.string().trim().min(1).max(200),
      skills: z.string().trim().max(1_000).optional(),
    })
    .safeParse({
      pathTitle: formData.get("pathTitle"),
      location: formData.get("location"),
      skills: formData.get("skills") || undefined,
    });
  if (!parsed.success) {
    return { status: "error", message: "Invalid search data.", jobs: [] };
  }

  const [savedModel, t] = await Promise.all([
    getPreferredCareerModel(viewer.actor.userId),
    getTranslations("Roadmap.results"),
  ]);
  const query = [parsed.data.pathTitle.replace(/^Lộ trình [^:]+:\s*/i, ""), parsed.data.skills]
    .filter(Boolean)
    .join(" ");
  const fetchedJobs = await fetchLinkedInJobs(query, parsed.data.location);

  if (fetchedJobs.length === 0) {
    return { status: "error", message: t("jobSearchEmpty"), jobs: [] };
  }

  try {
    const ranked = await generateAIJson<unknown>({
      model: AVAILABLE_MODELS.includes(savedModel) ? savedModel : DEFAULT_MODEL,
      traceName: "careerlens-related-jobs",
      userId: viewer.actor.userId,
      logResponse: false,
      systemPrompt:
        "Rank only supplied real job postings for career relevance. Return valid JSON only. Never invent jobs, companies, URLs, salary, or platforms.",
      userPrompt: [
        "Pick up to 6 best jobs for this roadmap.",
        "Use only URLs present in fetched_jobs.",
        "Return shape: {\"jobs\":[{\"url\":\"https://...\",\"reason\":\"short relevance reason\"}]}",
        "",
        `<roadmap>${parsed.data.pathTitle}</roadmap>`,
        `<location>${parsed.data.location}</location>`,
        `<skills>${parsed.data.skills ?? ""}</skills>`,
        "<fetched_jobs>",
        JSON.stringify(fetchedJobs, null, 2),
        "</fetched_jobs>",
      ].join("\n"),
    });
    const rankedJobs = rankedJobsSchema.parse(ranked.data).jobs;
    const byUrl = new Map(fetchedJobs.map((job) => [job.url, job]));
    const jobs = rankedJobs
      .map((job) => {
        const source = byUrl.get(job.url);
        return source ? { ...source, reason: job.reason } : null;
      })
      .filter((job): job is RelatedJobResult => Boolean(job));

    if (jobs.length > 0) return { status: "success", jobs };
  } catch (error) {
    console.warn("CareerLens related job ranking failed", {
      userId: viewer.actor.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return {
    status: "success",
    jobs: fetchedJobs.slice(0, 6).map((job) => ({
      ...job,
      reason: t("jobSearchFallbackReason"),
    })),
  };
}

export async function selectCareerRecommendationAction(formData: FormData) {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") return;

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
    userId: viewer.actor.userId,
    recommendationIndex: parsed.data.recommendationIndex,
  });
  revalidatePath("/dashboard/careerlens");
  redirect("/dashboard/careerlens");
}

export async function followCareerRoadmapAction(formData: FormData) {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") return;

  const parsed = roadmapIdSchema.safeParse(formData.get("roadmapId") || undefined);
  if (!parsed.success || !parsed.data) return;

  await followCareerRoadmap({
    roadmapId: parsed.data,
    userId: viewer.actor.userId,
  });

  revalidatePath("/dashboard/careerlens");
  redirect(`/dashboard/careerlens?roadmap=${parsed.data}`);
}

export async function stopFollowingCareerRoadmapAction() {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") return;

  await stopFollowingCareerRoadmap(viewer.actor.userId);
  revalidatePath("/dashboard/careerlens");
  redirect("/dashboard/careerlens");
}

export async function toggleCareerRoadmapTaskAction(formData: FormData) {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") return;

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
    userId: viewer.actor.userId,
    taskId: parsed.data.taskId,
    done: parsed.data.done === "true",
  });

  revalidatePath("/dashboard/careerlens");
}
