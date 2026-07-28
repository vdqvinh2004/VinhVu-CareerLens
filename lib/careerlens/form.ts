import "server-only";

import { z } from "zod";

import { selectCareerLensMarketSignals } from "./market-seed";
import type {
  CareerGuidanceInput,
  CareerStartingPointSnapshot,
  LaborMarketSignals,
} from "./schemas";
import { VIETNAM_PROVINCES } from "./vietnam-provinces";

function provinceSchema(provinces: readonly string[]) {
  return z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(200).refine((value) => value === "" || provinces.includes(value)),
  );
}

export function createCareerLensFormSchema(provinces: readonly string[] = VIETNAM_PROVINCES) {
  return z.object({
  educationLevel: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.enum(["THPT", "college", "university", "graduate", "other"]).nullable(),
  ),
  currentRegion: provinceSchema(provinces),
  targetRegion: provinceSchema(provinces),
  languages: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(300),
  ),
  strongSubject: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(120),
  ),
  subjectScore: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.number().min(0).max(10).nullable(),
  ),
  interests: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(500),
  ),
  activity: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(2_000),
  ),
  weeklyHours: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.number().int().min(0).max(80).nullable(),
  ),
  targetBudget: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(300),
  ),
  workEnvironment: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z
      .enum([
        "remote",
        "office",
        "fieldwork",
        "hybrid",
        "hands_on",
        "team_based",
        "independent",
      ])
      .nullable(),
  ),
  learningStyle: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z
      .enum([
        "project_based",
        "mentor_guided",
        "self_paced",
        "classroom",
        "apprenticeship",
      ])
      .nullable(),
  ),
  familyConstraints: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(1_000),
  ),
  intent: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z
      .enum([
        "initial_guidance",
        "switch_major",
        "find_jobs",
        "compare_paths",
        "roadmap_detail",
      ])
      .nullable(),
  ),
  question: z.preprocess(
    (value) => (value == null ? "" : value),
    z.string().trim().max(2_000),
  ),
  consent: z.string().refine((value) => value === "on" || value === "true"),
});
}

export const careerLensFormSchema = createCareerLensFormSchema();
export type CareerLensFormValues = z.infer<typeof careerLensFormSchema>;
export function createCareerLensStoredFormSchema(provinces: readonly string[] = VIETNAM_PROVINCES) {
  return createCareerLensFormSchema(provinces).omit({ consent: true });
}
export const careerLensStoredFormSchema = createCareerLensStoredFormSchema();
export type CareerLensStoredFormValues = z.infer<
  typeof careerLensStoredFormSchema
>;

function splitList(value: string, limit: number): string[] {
  return [...new Set(value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))].slice(
    0,
    limit,
  );
}

function interestCategory(interest: string): "sport" | "technology" | "business" | "other" {
  const normalized = interest.toLocaleLowerCase("vi");
  if (/thể thao|bóng|chạy|bơi|cầu lông/.test(normalized)) return "sport";
  if (/công nghệ|lập trình|dữ liệu|máy tính|robot/.test(normalized)) return "technology";
  if (/kinh doanh|marketing|bán hàng|tài chính/.test(normalized)) return "business";
  return "other";
}

function periodLabel(
  startMonth: number,
  startYear: number,
  endMonth: number | null,
  endYear: number | null,
) {
  const start = `${String(startMonth).padStart(2, "0")}/${startYear}`;
  const end =
    endMonth && endYear
      ? `${String(endMonth).padStart(2, "0")}/${endYear}`
      : "Hiện tại";
  return `${start} - ${end}`;
}

function startingPointActivities(snapshot: CareerStartingPointSnapshot | null) {
  if (!snapshot) return [];

  return [
    ...snapshot.education.flatMap((record) =>
      record.researchTitle
        ? [
            {
              type: "project" as const,
              name: record.researchTitle,
              description: record.researchDescription ?? "",
              duration: periodLabel(
                record.startMonth,
                record.startYear,
                record.endMonth,
                record.endYear,
              ),
              evidence: record.institutionName,
            },
          ]
        : [],
    ),
    ...snapshot.certificates.map((certificate) => ({
      type: "certificate" as const,
      name: certificate.name,
      description: `Cấp năm ${certificate.issuedYear}`,
      duration: periodLabel(
        certificate.startMonth,
        certificate.startYear,
        certificate.endMonth,
        certificate.endYear,
      ),
      evidence: certificate.hasAttachment ? "Có tệp minh chứng" : null,
    })),
    ...snapshot.competitions.map((competition) => ({
      type: "competition" as const,
      name: competition.name,
      description: competition.awardName ?? "",
      duration: periodLabel(
        competition.startMonth,
        competition.startYear,
        competition.endMonth,
        competition.endYear,
      ),
      evidence: competition.awardName,
    })),
    ...snapshot.activities.map((activity) => ({
      type: "other" as const,
      name: activity.name,
      description: "",
      duration: periodLabel(
        activity.startMonth,
        activity.startYear,
        activity.endMonth,
        activity.endYear,
      ),
      evidence: null,
    })),
    ...snapshot.workExperiences.map((experience) => ({
      type: "part_time" as const,
      name: experience.position
        ? `${experience.position} tại ${experience.workplaceName}`
        : experience.workplaceName,
      description: [experience.learnings, experience.skills]
        .filter(Boolean)
        .join(". "),
      duration: periodLabel(
        experience.startMonth,
        experience.startYear,
        experience.endMonth,
        experience.endYear,
      ),
      evidence: null,
    })),
  ];
}

function startingPointAcademicRecords(
  snapshot: CareerStartingPointSnapshot | null,
) {
  if (!snapshot) return [];

  return snapshot.education.flatMap((record) =>
    record.transcriptEntries.map((entry) => ({
      subject: `${entry.subjectName} (${record.institutionName})`,
      score:
        record.scoreScale === 4
          ? Math.round(entry.score * 2.5 * 100) / 100
          : entry.score,
      evidence: "school_record" as const,
    })),
  );
}

export function buildCareerGuidanceInput(
  values: CareerLensFormValues,
  profileId: string,
  preferredOutputLanguage: "vi" | "en" = "vi",
  startingPoint: CareerStartingPointSnapshot | null = null,
  marketSeed?: LaborMarketSignals,
): CareerGuidanceInput {
  const interests = splitList(values.interests, 12);
  const profileSkills = startingPoint
    ? startingPoint.workExperiences.flatMap((experience) =>
        splitList(experience.skills ?? "", 20),
      )
    : [];

  return {
    student_profile: {
      profile_id: profileId,
      consent_data_usage: true,
      bias_exclusion_flag: true,
      education_level: values.educationLevel ?? "other",
      current_region: values.currentRegion,
      target_regions: values.targetRegion ? [values.targetRegion] : [],
      languages: splitList(values.languages, 8),
      academic_records: [
        ...startingPointAcademicRecords(startingPoint).slice(
          0,
          values.strongSubject ? 499 : 500,
        ),
        ...(values.strongSubject
          ? [
              {
                subject: values.strongSubject,
                score: values.subjectScore,
                evidence: "self_reported" as const,
              },
            ]
          : []),
      ],
      self_reported_activities: [
        ...startingPointActivities(startingPoint).slice(
          0,
          values.activity ? 99 : 100,
        ),
        ...(values.activity
          ? [
              {
                type: "project" as const,
                name: "Trải nghiệm người học tự chia sẻ",
                description: values.activity,
                duration: "Chưa xác định",
                evidence: null,
              },
            ]
          : []),
      ],
      personal_interests: interests.map((interest) => ({
        name: interest,
        category: interestCategory(interest),
        intensity: 4,
        why_it_matters: "Người học chủ động đưa vào hồ sơ hướng nghiệp.",
      })),
      preferences: {
        target_budget: values.targetBudget || null,
        time_commitment_hours_per_week: values.weeklyHours,
        work_env_pref: values.workEnvironment ? [values.workEnvironment] : [],
        learning_style: values.learningStyle ? [values.learningStyle] : [],
        health_constraints_opt_in: null,
        family_constraints: values.familyConstraints || null,
      },
      simulated_experiences: [],
      conversation_memory: {
        stable_interests: interests,
        stable_abilities: [
          ...new Set([values.strongSubject, ...profileSkills].filter(Boolean)),
        ],
        avoid_paths: [],
        previous_recommendations: [],
        student_decisions: [],
      },
      starting_point: startingPoint,
    },
    labor_market_signals: selectCareerLensMarketSignals({
      currentRegion: values.currentRegion,
      targetRegions: values.targetRegion ? [values.targetRegion] : [],
      keywords: [
        values.strongSubject,
        values.interests,
        values.question,
        ...(startingPoint?.education.flatMap((record) => [
          record.fieldOfStudy ?? "",
          record.researchTitle ?? "",
        ]) ?? []),
        ...profileSkills,
      ],
      marketSeed,
    }),
    user_request: {
      intent: values.intent ?? "initial_guidance",
      question: values.question,
      target_career_or_major: null,
      preferred_output_language: preferredOutputLanguage,
    },
  };
}
