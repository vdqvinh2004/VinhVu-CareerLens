import { z } from "zod";

const nonEmptyText = z.string().trim().min(1).max(2_000);
const optionalText = z.string().trim().max(2_000).nullable();
const confidenceSchema = z.enum(["low", "medium", "high"]);
const referenceDocumentSchema = z.object({
  title: nonEmptyText,
  url: z.url().max(2_000),
});

const roadmapActivityTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("research")) return "research";
  if (normalized.includes("competition") || normalized.includes("contest") || normalized.includes("hackathon")) return "competition";
  if (normalized === "club_project" || normalized.includes("club") || normalized.includes("project")) return "club_project";

  return value;
}, z.enum(["research", "competition", "club_project"]));

export const careerStartingPointSnapshotSchema = z.object({
  personality: z
    .object({
      resultType: z.string().trim().min(1).max(10),
      scores: z.record(z.string(), z.number()),
      completedAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  education: z
    .array(
      z.object({
        id: z.uuid(),
        level: z.enum(["HIGH_SCHOOL", "UNDERGRADUATE", "GRADUATE"]),
        institutionName: nonEmptyText,
        fieldOfStudy: optionalText,
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(1900),
        endMonth: z.number().int().min(1).max(12),
        endYear: z.number().int().min(1900),
        scoreScale: z.union([z.literal(4), z.literal(10)]),
        researchTitle: optionalText,
        researchDescription: optionalText,
        transcriptEntries: z
          .array(
            z.object({
              stage: z.enum(["GRADE_10", "GRADE_11", "GRADE_12", "CUMULATIVE"]),
              subjectName: nonEmptyText,
              credits: z.number().positive().nullable(),
              score: z.number().nonnegative(),
            }),
          )
          .max(500),
      }),
    )
    .max(20),
  certificates: z
    .array(
      z.object({
        name: nonEmptyText,
        issuedYear: z.number().int().min(1900),
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(1900),
        endMonth: z.number().int().min(1).max(12),
        endYear: z.number().int().min(1900),
        hasAttachment: z.boolean(),
      }),
    )
    .max(100),
  competitions: z
    .array(
      z.object({
        name: nonEmptyText,
        awardName: optionalText,
        year: z.number().int().min(1900),
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(1900),
        endMonth: z.number().int().min(1).max(12),
        endYear: z.number().int().min(1900),
      }),
    )
    .max(100),
  activities: z
    .array(
      z.object({
        name: nonEmptyText,
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(1900),
        endMonth: z.number().int().min(1).max(12),
        endYear: z.number().int().min(1900),
      }),
    )
    .max(100),
  workExperiences: z
    .array(
      z.object({
        workplaceName: nonEmptyText,
        position: optionalText,
        startMonth: z.number().int().min(1).max(12),
        startYear: z.number().int().min(1900),
        endMonth: z.number().int().min(1).max(12).nullable(),
        endYear: z.number().int().min(1900).nullable(),
        isCurrent: z.boolean(),
        learnings: optionalText,
        skills: optionalText,
      }),
    )
    .max(100),
});

const academicRecordSchema = z.object({
  subject: nonEmptyText,
  score: z.number().min(0).max(10).nullable(),
  evidence: z.enum(["school_record", "self_reported", "counselor_verified"]),
});

const activitySchema = z.object({
  type: z.enum([
    "club",
    "sport",
    "art",
    "volunteer",
    "part_time",
    "project",
    "certificate",
    "competition",
    "other",
  ]),
  name: nonEmptyText,
  description: z.string().trim().max(4_000),
  duration: z.string().trim().max(200),
  evidence: optionalText,
});

const interestSchema = z.object({
  name: nonEmptyText,
  category: z.enum([
    "sport",
    "hobby",
    "media",
    "subject",
    "social_cause",
    "technology",
    "business",
    "craft",
    "other",
  ]),
  intensity: z.number().int().min(1).max(5),
  why_it_matters: z.string().trim().max(2_000),
});

const preferencesSchema = z.object({
  target_budget: optionalText,
  time_commitment_hours_per_week: z.number().min(0).max(168).nullable(),
  work_env_pref: z
    .array(
      z.enum([
        "remote",
        "office",
        "fieldwork",
        "hybrid",
        "hands_on",
        "team_based",
        "independent",
      ]),
    )
    .max(7),
  learning_style: z
    .array(
      z.enum([
        "project_based",
        "mentor_guided",
        "self_paced",
        "classroom",
        "apprenticeship",
      ]),
    )
    .max(5),
  health_constraints_opt_in: optionalText,
  family_constraints: optionalText,
});

const simulatedExperienceSchema = z.object({
  scenario_name: nonEmptyText,
  behavioral_choice: nonEmptyText,
  response_time_sec: z.number().min(0).max(86_400),
  observed_signal: z
    .array(
      z.enum([
        "problem_solving",
        "empathy",
        "persistence",
        "risk_awareness",
        "communication",
        "manual_skill",
        "creativity",
      ]),
    )
    .max(7),
});

const studentDecisionSchema = z.object({
  career_path: nonEmptyText,
  decision: z.enum(["accept", "reject", "revisit", "switch_major"]),
  reason: z.string().trim().max(2_000),
  decided_at: z.iso.datetime({ offset: true }),
});

const conversationMemorySchema = z.object({
  stable_interests: z.array(nonEmptyText).max(50),
  stable_abilities: z.array(nonEmptyText).max(50),
  avoid_paths: z.array(nonEmptyText).max(50),
  previous_recommendations: z.array(nonEmptyText).max(50),
  student_decisions: z.array(studentDecisionSchema).max(100),
});

export const studentProfileSchema = z.object({
  profile_id: z.string().trim().min(1).max(200),
  consent_data_usage: z.boolean(),
  bias_exclusion_flag: z.boolean(),
  education_level: z.enum(["THPT", "college", "university", "graduate", "other"]),
  current_region: z.string().trim().max(200),
  target_regions: z.array(nonEmptyText).max(20),
  languages: z.array(nonEmptyText).max(20),
  academic_records: z.array(academicRecordSchema).max(500),
  self_reported_activities: z.array(activitySchema).max(100),
  personal_interests: z.array(interestSchema).max(100),
  preferences: preferencesSchema,
  simulated_experiences: z.array(simulatedExperienceSchema).max(100),
  conversation_memory: conversationMemorySchema,
  starting_point: careerStartingPointSnapshotSchema.nullable().default(null),
});

const requiredSkillSchema = z.object({
  skill_name: nonEmptyText,
  importance: z.number().int().min(1).max(5),
  is_short_supply: z.boolean(),
  is_proprietary: z.boolean(),
});

const laborPostingSchema = z.object({
  job_id: z.string().trim().min(1).max(200),
  job_title: nonEmptyText,
  industry: nonEmptyText,
  region: nonEmptyText,
  avg_salary: z.object({
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    currency: z.literal("VND"),
    period: z.literal("month"),
  }),
  required_skills: z.array(requiredSkillSchema).max(100),
  experience_level: z.enum(["intern", "fresher", "junior", "mid", "senior"]),
  education_requirement: z.enum([
    "none",
    "certificate",
    "vocational",
    "college",
    "university",
    "flexible",
  ]),
  culture_fit_indicators: z.array(nonEmptyText).max(50),
  posted_at: z.iso.datetime({ offset: true }),
});

const trendSummarySchema = z.object({
  career_family: nonEmptyText,
  region: nonEmptyText,
  posting_growth_rate: z.number(),
  salary_growth_rate: z.number(),
  short_supply_skills: z.array(nonEmptyText).max(100),
  confidence: z.number().min(0).max(1),
});

export const laborMarketSignalsSchema = z.object({
  source_timestamp: z.iso.datetime({ offset: true }),
  postings: z.array(laborPostingSchema).max(1_000),
  trend_summary: z.array(trendSummarySchema).max(200),
});

export const careerGuidanceRequestSchema = z.object({
  intent: z.enum([
    "initial_guidance",
    "switch_major",
    "find_jobs",
    "update_profile",
    "compare_paths",
    "roadmap_detail",
  ]),
  question: z.string().trim().max(4_000),
  target_career_or_major: optionalText,
  preferred_output_language: z.enum(["vi", "en"]).default("vi"),
});

export const careerGuidanceInputSchema = z.object({
  student_profile: studentProfileSchema,
  labor_market_signals: laborMarketSignalsSchema,
  user_request: careerGuidanceRequestSchema,
});

const skillGapSchema = z.object({
  skill: nonEmptyText,
  current_level: z.enum(["unknown", "beginner", "basic", "intermediate", "advanced"]),
  target_level: z.enum(["basic", "intermediate", "advanced"]),
  why_needed: nonEmptyText,
});

const learningStageSchema = z.object({
  stage_order: z.literal(1),
  stage_type: z.literal("learning"),
  stage_name: nonEmptyText,
  time_limit: nonEmptyText,
  major_or_track: nonEmptyText,
  subjects: z
    .array(
      z.object({
        subject_name: nonEmptyText,
        focus: nonEmptyText,
        evidence_of_completion: nonEmptyText,
      }),
    )
    .min(2)
    .max(12),
  certificates: z
    .array(
      z.object({
        certificate_name: nonEmptyText,
        purpose: nonEmptyText,
        target_time: nonEmptyText,
      }),
    )
    .max(8),
  research_and_competitions: z
    .array(
      z.object({
        activity_type: roadmapActivityTypeSchema,
        activity_name: nonEmptyText,
        goal: nonEmptyText,
        evidence_of_completion: nonEmptyText,
      }),
    )
    .min(1)
    .max(8),
  milestones: z.array(nonEmptyText).min(1).max(12),
});

const internshipStageSchema = z.object({
  stage_order: z.literal(2),
  stage_type: z.literal("internship"),
  stage_name: nonEmptyText,
  time_limit: nonEmptyText,
  target_organizations: z
    .array(
      z.object({
        organization: nonEmptyText,
        region: nonEmptyText,
        opportunity_type: nonEmptyText,
        why_target: nonEmptyText,
      }),
    )
    .min(1)
    .max(8),
  cv_preparation: z.array(nonEmptyText).min(2).max(12),
  applied_knowledge: z.array(nonEmptyText).min(2).max(12),
  interview_preparation: z.array(nonEmptyText).min(2).max(12),
  success_metrics: z.array(nonEmptyText).min(1).max(10),
});

const fullTimeStageSchema = z.object({
  stage_order: z.literal(3),
  stage_type: z.literal("full_time"),
  stage_name: nonEmptyText,
  time_limit: nonEmptyText,
  target_roles: z
    .array(
      z.object({
        role_name: nonEmptyText,
        responsibilities: z.array(nonEmptyText).min(1).max(10),
        salary_and_benefits_basis: z.array(nonEmptyText).min(1).max(10),
        readiness_signal: nonEmptyText,
      }),
    )
    .min(1)
    .max(5),
  first_90_days: z.array(nonEmptyText).min(2).max(12),
  promotion_path: z
    .array(
      z.object({
        target_position: nonEmptyText,
        expected_timeline: nonEmptyText,
        capabilities_to_build: z.array(nonEmptyText).min(1).max(10),
        proof_of_readiness: nonEmptyText,
      }),
    )
    .min(1)
    .max(6),
});

const relatedJobSchema = z.object({
  job_title: nonEmptyText,
  region: nonEmptyText,
  salary_band: nonEmptyText,
  required_skills: z.array(nonEmptyText).max(100),
  education_requirement: nonEmptyText,
  why_relevant: nonEmptyText,
});

export const careerRecommendationSchema = z.object({
  path_title: nonEmptyText,
  path_category: z.enum([
    "university",
    "college",
    "vocational",
    "certificate",
    "apprenticeship",
    "self_learning",
  ]),
  fit_score: z.number().min(0).max(100),
  fit_explanation: nonEmptyText,
  market_evidence: z.array(nonEmptyText).max(100),
  reference_documents: z.array(referenceDocumentSchema).max(8).default([]),
  matched_profile_signals: z.array(nonEmptyText).max(100),
  skill_gaps: z.array(skillGapSchema).max(100),
  roadmap: z.tuple([learningStageSchema, internshipStageSchema, fullTimeStageSchema]),
  related_jobs: z.array(relatedJobSchema).max(100),
  autonomy_note: nonEmptyText,
});

export const careerGuidanceOutputSchema = z.object({
  disclaimer: nonEmptyText,
  profile_summary: z.object({
    strengths: z.array(nonEmptyText).max(100),
    interests: z.array(nonEmptyText).max(100),
    personal_signals: z.array(nonEmptyText).max(100),
    constraints: z.array(nonEmptyText).max(100),
    data_confidence: confidenceSchema,
  }),
  market_summary: z.object({
    rising_careers: z
      .array(
        z.object({
          career: nonEmptyText,
          region: nonEmptyText,
          evidence: z.array(nonEmptyText).max(100),
          confidence: confidenceSchema,
        }),
      )
      .max(100),
    short_supply_skills: z
      .array(
        z.object({
          skill: nonEmptyText,
          region: nonEmptyText,
          related_roles: z.array(nonEmptyText).max(100),
        }),
      )
      .max(100),
  }),
  recommendations: z.array(careerRecommendationSchema).max(10),
  questions_to_improve_recommendation: z.array(nonEmptyText).max(20),
  memory_update: z.object({
    stable_interests: z.array(nonEmptyText).max(100),
    stable_abilities: z.array(nonEmptyText).max(100),
    new_constraints: z.array(nonEmptyText).max(100),
    student_decision_to_save: optionalText,
  }),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type LaborMarketSignals = z.infer<typeof laborMarketSignalsSchema>;
export type CareerGuidanceRequest = z.infer<typeof careerGuidanceRequestSchema>;
export type CareerGuidanceInput = z.infer<typeof careerGuidanceInputSchema>;
export type CareerRecommendation = z.infer<typeof careerRecommendationSchema>;
export type CareerGuidanceOutput = z.infer<typeof careerGuidanceOutputSchema>;
export type CareerStartingPointSnapshot = z.infer<
  typeof careerStartingPointSnapshotSchema
>;
