
import {
  generateAIJson,
  AIServiceError,
  resolveAIModel,
} from "@/lib/ai";

import {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
} from "./schemas";
import { CAREERLENS_SYSTEM_PROMPT } from "./system-prompt";

const REQUIRED_OUTPUT_COPY = {
  vi: {
    disclaimer:
      "Kết quả này là gợi ý tham khảo, không thay thế quyết định của bạn hoặc tư vấn trực tiếp từ counselor.",
    autonomyNote:
      "Bạn có thể chấp nhận, từ chối, xem lại hoặc đổi hướng; nên kiểm chứng lựa chọn với counselor và người đang làm nghề.",
    consentConstraint: "Chưa có sự đồng ý xử lý dữ liệu cá nhân.",
    consentQuestion:
      "Bạn có đồng ý để VinhVu CareerLen xử lý dữ liệu hồ sơ nhằm cá nhân hóa gợi ý không?",
  },
  en: {
    disclaimer:
      "This result is a suggestion for consideration and does not replace your decision or direct guidance from a counselor.",
    autonomyNote:
      "You can accept, reject, revisit, or change direction; validate your choice with a counselor and people working in the field.",
    consentConstraint: "Consent to process personal data has not been provided.",
    consentQuestion:
      "Do you agree to let VinhVu CareerLen process your profile data to personalise its suggestions?",
  },
} as const;

const OUTPUT_CONTRACT = {
  disclaimer: "string",
  profile_summary: {
    strengths: ["string"],
    interests: ["string"],
    personal_signals: ["string"],
    constraints: ["string"],
    data_confidence: "low | medium | high",
  },
  market_summary: {
    rising_careers: [
      {
        career: "string",
        region: "string",
        evidence: ["string"],
        confidence: "low | medium | high",
      },
    ],
    short_supply_skills: [
      { skill: "string", region: "string", related_roles: ["string"] },
    ],
  },
  recommendations: [
    {
      path_title: "string",
      path_category:
        "university | college | vocational | certificate | apprenticeship | self_learning",
      fit_score: 0,
      fit_explanation: "string",
      market_evidence: ["string"],
      reference_documents: [{ title: "string", url: "https://example.com/document" }],
      matched_profile_signals: ["string"],
      skill_gaps: [
        {
          skill: "string",
          current_level: "unknown | beginner | basic | intermediate | advanced",
          target_level: "basic | intermediate | advanced",
          why_needed: "string",
        },
      ],
      roadmap: [
        {
          stage_order: 1,
          stage_type: "learning",
          stage_name: "Học tập",
          time_limit: "string",
          major_or_track: "string",
          subjects: [
            {
              subject_name: "string",
              focus: "string",
              evidence_of_completion: "string",
            },
          ],
          certificates: [
            { certificate_name: "string", purpose: "string", target_time: "string" },
          ],
          research_and_competitions: [
            {
              activity_type: "research | competition | club_project",
              activity_name: "string",
              goal: "string",
              evidence_of_completion: "string",
            },
          ],
          milestones: ["string"],
        },
        {
          stage_order: 2,
          stage_type: "internship",
          stage_name: "Intern",
          time_limit: "string",
          target_organizations: [
            {
              organization: "string",
              region: "string",
              opportunity_type: "string",
              why_target: "string",
            },
          ],
          cv_preparation: ["string"],
          applied_knowledge: ["string"],
          interview_preparation: ["string"],
          success_metrics: ["string"],
        },
        {
          stage_order: 3,
          stage_type: "full_time",
          stage_name: "Công việc chính thức",
          time_limit: "string",
          target_roles: [
            {
              role_name: "string",
              responsibilities: ["string"],
              salary_and_benefits_basis: ["string"],
              readiness_signal: "string",
            },
          ],
          first_90_days: ["string"],
          promotion_path: [
            {
              target_position: "string",
              expected_timeline: "string",
              capabilities_to_build: ["string"],
              proof_of_readiness: "string",
            },
          ],
        },
      ],
      related_jobs: [],
      autonomy_note: "string",
    },
  ],
  questions_to_improve_recommendation: ["string"],
  memory_update: {
    stable_interests: ["string"],
    stable_abilities: ["string"],
    new_constraints: ["string"],
    student_decision_to_save: "string | null",
  },
};

export interface GenerateCareerGuidanceOptions {
  model?: string;
}

export function sanitizeCareerGuidanceInput(input: unknown): CareerGuidanceInput {
  // Zod objects strip unknown keys recursively. Sensitive fields such as gender,
  // hometown, ethnicity and religion therefore cannot reach the model.
  return careerGuidanceInputSchema.parse(input);
}

export function buildCareerGuidanceUserPrompt(input: CareerGuidanceInput): string {
  return [
    "Hãy tạo kết quả hướng nghiệp từ dữ liệu đã được xác thực dưới đây.",
    "Trả đúng JSON contract, không thêm markdown hoặc giải thích ngoài JSON.",
    "Nếu dữ liệu đủ, recommendations phải có đúng 3 phần tử theo thứ tự: an toàn, tăng trưởng cao, khám phá.",
    "Dùng đầy đủ student_profile.starting_point khi tổng hợp tính cách, học vấn, bảng điểm, nghiên cứu, chứng chỉ, cuộc thi, hoạt động và kinh nghiệm làm việc; không tự suy diễn dữ liệu còn thiếu.",
    "Mỗi recommendation phải có đúng ba roadmap stage theo thứ tự: Học tập, Intern, Công việc chính thức; điền đầy đủ chi tiết riêng cho nghề đó.",
    "Mỗi recommendation phải có reference_documents là link web trực tiếp đến tài liệu học/chứng chỉ/nghiên cứu liên quan. Không trả keyword tìm kiếm hoặc URL trang search.",
    "Không lưu live job listing trong roadmap JSON. related_jobs phải là [] vì việc làm được tìm mới theo vị trí khi user bấm nút trong UI.",
    "",
    "<output_contract>",
    JSON.stringify(OUTPUT_CONTRACT, null, 2),
    "</output_contract>",
    "",
    "<career_guidance_input>",
    JSON.stringify(input, null, 2),
    "</career_guidance_input>",
  ].join("\n");
}

function createConsentRequiredOutput(language: "vi" | "en"): CareerGuidanceOutput {
  const copy = REQUIRED_OUTPUT_COPY[language];

  return {
    disclaimer: copy.disclaimer,
    profile_summary: {
      strengths: [],
      interests: [],
      personal_signals: [],
      constraints: [copy.consentConstraint],
      data_confidence: "low",
    },
    market_summary: { rising_careers: [], short_supply_skills: [] },
    recommendations: [],
    questions_to_improve_recommendation: [copy.consentQuestion],
    memory_update: {
      stable_interests: [],
      stable_abilities: [],
      new_constraints: [],
      student_decision_to_save: null,
    },
  };
}

function applyMandatoryGuardrails(
  output: CareerGuidanceOutput,
  language: "vi" | "en",
): CareerGuidanceOutput {
  const copy = REQUIRED_OUTPUT_COPY[language];

  return careerGuidanceOutputSchema.parse({
    ...output,
    disclaimer: copy.disclaimer,
    recommendations: output.recommendations.map((recommendation) => ({
      ...recommendation,
      autonomy_note: copy.autonomyNote,
    })),
  });
}

/**
 * Generates validated, explainable VinhVu CareerLen guidance through the configured
 * browser-configured AI provider.
 */
export async function generateCareerGuidance(
  rawInput: unknown,
  options: GenerateCareerGuidanceOptions = {},
): Promise<CareerGuidanceOutput> {
  const input = sanitizeCareerGuidanceInput(rawInput);

  if (!input.student_profile.consent_data_usage) {
    return createConsentRequiredOutput(input.user_request.preferred_output_language);
  }


  const requestedModel = resolveAIModel(options.model);
  const generateWithModel = async (model: string) => {
    const { data } = await generateAIJson<unknown>({
      systemPrompt: CAREERLENS_SYSTEM_PROMPT,
      userPrompt: buildCareerGuidanceUserPrompt(input),
      model,
    });

    const parsedOutput = careerGuidanceOutputSchema.safeParse(data);
    if (!parsedOutput.success) {
      throw new AIServiceError(
        `VinhVu CareerLen LLM output failed validation: ${parsedOutput.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    if (parsedOutput.data.recommendations.length !== 3) {
      throw new AIServiceError(
        `VinhVu CareerLen LLM output must contain exactly 3 recommendations; received ${parsedOutput.data.recommendations.length}`,
      );
    }

    return applyMandatoryGuardrails(
      parsedOutput.data,
      input.user_request.preferred_output_language,
    );
  };

  return generateWithModel(requestedModel);
}

export { CAREERLENS_SYSTEM_PROMPT } from "./system-prompt";
export {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
} from "./schemas";
