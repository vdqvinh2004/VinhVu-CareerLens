import "server-only";

import {
  DEFAULT_MODEL,
  generateAIJson,
  AIServiceError,
  resolveAIModel,
} from "@/lib/ai";

import {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
  type CareerRecommendation,
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
      "Bạn có đồng ý để CareerLens xử lý dữ liệu hồ sơ nhằm cá nhân hóa gợi ý không?",
    mockDisclaimer: "Đây là dữ liệu mock deterministic vì dịch vụ LLM chưa được cấu hình.",
  },
  en: {
    disclaimer:
      "This result is a suggestion for consideration and does not replace your decision or direct guidance from a counselor.",
    autonomyNote:
      "You can accept, reject, revisit, or change direction; validate your choice with a counselor and people working in the field.",
    consentConstraint: "Consent to process personal data has not been provided.",
    consentQuestion:
      "Do you agree to let CareerLens process your profile data to personalise its suggestions?",
    mockDisclaimer: "This is deterministic mock data because the LLM service is not configured.",
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
  userId?: string;
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

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function includesText(values: string[], candidate: string): boolean {
  const normalizedCandidate = candidate.toLocaleLowerCase("vi");
  return values.some((value) => value.toLocaleLowerCase("vi") === normalizedCandidate);
}

function formatSalary(min: number | null, max: number | null): string {
  const formatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
  if (min !== null && max !== null) {
    return `${formatter.format(min)}-${formatter.format(max)} VND/tháng`;
  }
  if (min !== null) return `Từ ${formatter.format(min)} VND/tháng`;
  if (max !== null) return `Đến ${formatter.format(max)} VND/tháng`;
  return "Chưa có dữ liệu lương";
}

function mapPathCategory(
  requirement: CareerGuidanceInput["labor_market_signals"]["postings"][number]["education_requirement"] | undefined,
): CareerRecommendation["path_category"] {
  if (requirement === "university") return "university";
  if (requirement === "college") return "college";
  if (requirement === "vocational") return "vocational";
  if (requirement === "certificate") return "certificate";
  return "self_learning";
}

function createRoadmap({
  pathTitle,
  skill,
  region,
  industry,
  salaryBand,
}: {
  pathTitle: string;
  skill: string;
  region: string;
  industry: string;
  salaryBand: string;
}): CareerRecommendation["roadmap"] {
  return [
    {
      stage_order: 1,
      stage_type: "learning",
      stage_name: "Học tập",
      time_limit: "6-18 tháng, điều chỉnh theo bậc học hiện tại",
      major_or_track: `Ưu tiên ngành hoặc hướng chuyên sâu có nền tảng cho ${pathTitle}; đối chiếu chương trình đào tạo với yêu cầu ${skill} trước khi đăng ký.`,
      subjects: [
        {
          subject_name: `${skill} nền tảng`,
          focus: `Hiểu khái niệm cốt lõi và dùng ${skill} để giải một bài toán gần với ${pathTitle}.`,
          evidence_of_completion: "Một bài thực hành có file nguồn, kết quả và phần giải thích quyết định.",
        },
        {
          subject_name: "Tư duy giải quyết vấn đề và giao tiếp chuyên môn",
          focus: `Phân tích yêu cầu, trình bày phương án và nhận phản biện trong bối cảnh ${industry}.`,
          evidence_of_completion: "Một báo cáo ngắn và bài thuyết trình được giáo viên, mentor hoặc bạn học phản biện.",
        },
      ],
      certificates: [
        {
          certificate_name: `Chứng chỉ thực hành ${skill} phù hợp với role mục tiêu`,
          purpose: "Bổ sung cấu trúc học và bằng chứng kỹ năng; chỉ chọn sau khi kiểm tra mô tả tuyển dụng thực tế.",
          target_time: "Sau khi hoàn thành kiến thức nền, trước kỳ ứng tuyển intern 2-4 tháng.",
        },
      ],
      research_and_competitions: [
        {
          activity_type: "research",
          activity_name: `Đề tài nghiên cứu nhỏ ứng dụng ${skill}`,
          goal: `Dùng dữ liệu hoặc quan sát thực tế để trả lời một vấn đề thuộc ${industry}.`,
          evidence_of_completion: "Poster, báo cáo phương pháp, kết quả và giới hạn của nghiên cứu.",
        },
        {
          activity_type: "competition",
          activity_name: `Cuộc thi hoặc hackathon có đề bài gần với ${pathTitle}`,
          goal: "Luyện làm việc nhóm, xử lý deadline và nhận phản hồi từ người chấm.",
          evidence_of_completion: "Sản phẩm dự thi, nhật ký vai trò cá nhân và bài học sau cuộc thi.",
        },
      ],
      milestones: [
        `Tự giải thích được công việc hằng ngày của ${pathTitle} và ba kỹ năng đầu vào.`,
        `Có ít nhất hai sản phẩm thực hành, trong đó một sản phẩm dùng ${skill}.`,
        "Được giáo viên, counselor hoặc mentor review portfolio trước khi ứng tuyển intern.",
      ],
    },
    {
      stage_order: 2,
      stage_type: "internship",
      stage_name: "Intern",
      time_limit: "3-6 tháng chuẩn bị và 2-6 tháng thực tập",
      target_organizations: [
        {
          organization: `Doanh nghiệp hoặc đơn vị ${industry} có đội ngũ liên quan đến ${pathTitle}`,
          region,
          opportunity_type: "Internship, trainee hoặc dự án cộng tác có mentor",
          why_target: "Có môi trường dùng kỹ năng mục tiêu và đầu việc đủ rõ để tạo bằng chứng năng lực.",
        },
      ],
      cv_preparation: [
        `Viết tiêu đề CV bám đúng role ${pathTitle}; đưa ${skill} và các từ khóa thật sự đã thực hành lên đầu.`,
        "Mỗi dự án trình bày theo cấu trúc vấn đề - hành động cá nhân - kết quả đo được - bài học.",
        "Gắn portfolio hoặc sản phẩm; nhờ mentor review cả nội dung lẫn lỗi trình bày trước khi gửi.",
      ],
      applied_knowledge: [
        `Áp dụng ${skill} vào một đầu việc có dữ liệu đầu vào, tiêu chí chất lượng và deadline rõ ràng.`,
        "Ghi lại giả định, quyết định, phản hồi và tác động để chuyển thành case study sau kỳ thực tập.",
      ],
      interview_preparation: [
        `Luyện giải thích một project dùng ${skill} trong 3 phút, sau đó trả lời sâu về lựa chọn và lỗi đã gặp.`,
        `Chuẩn bị câu hỏi tình huống và bài thực hành gần với nhiệm vụ của ${pathTitle}.`,
        "Tập phỏng vấn thử, nhận phản hồi về cấu trúc trả lời, giao tiếp và phần kiến thức còn thiếu.",
      ],
      success_metrics: [
        "Có CV và portfolio được ít nhất một người có kinh nghiệm review.",
        "Hoàn thành tối thiểu một đầu việc có thể mô tả bằng kết quả hoặc chỉ số chất lượng.",
        "Nhận phản hồi cuối kỳ về chuyên môn, phối hợp và mức sẵn sàng cho fresher.",
      ],
    },
    {
      stage_order: 3,
      stage_type: "full_time",
      stage_name: "Công việc chính thức",
      time_limit: "0-5 năm đầu sự nghiệp",
      target_roles: [
        {
          role_name: pathTitle,
          responsibilities: [
            `Thực hiện các đầu việc cốt lõi của ${pathTitle} dưới tiêu chuẩn chất lượng của đội ngũ.`,
            "Phối hợp với các bên liên quan, báo cáo tiến độ và chủ động xử lý rủi ro trong phạm vi phụ trách.",
          ],
          salary_and_benefits_basis: [
            `Dải tham khảo từ dữ liệu đầu vào: ${salaryBand}; cần kiểm tra lại theo thời điểm, vùng và cấp độ.`,
            `So sánh lương cứng, thưởng theo hiệu suất, bảo hiểm, đào tạo, mentor, thời gian làm việc và cơ hội thăng tiến.`,
            `Đánh giá offer theo phạm vi trách nhiệm, mức thành thạo ${skill}, kinh nghiệm và chất lượng portfolio.`,
          ],
          readiness_signal: "Tự hoàn thành đầu việc fresher có review, giải thích được quyết định và sửa lỗi dựa trên phản hồi.",
        },
      ],
      first_90_days: [
        "30 ngày đầu: hiểu sản phẩm, quy trình, tiêu chuẩn chất lượng và thống nhất kỳ vọng với quản lý.",
        `60 ngày: tự nhận một đầu việc có dùng ${skill}, cập nhật tiến độ và xin phản hồi sớm.`,
        "90 ngày: hoàn thành một kết quả đo được, tổng kết khoảng trống kỹ năng và chốt kế hoạch phát triển 6 tháng.",
      ],
      promotion_path: [
        {
          target_position: `Chuyên viên vững nghề trong hướng ${pathTitle}`,
          expected_timeline: "Khoảng 1-3 năm, phụ thuộc hiệu quả thực tế và tiêu chuẩn từng tổ chức.",
          capabilities_to_build: [`Năng lực chuyên sâu về ${skill}`, "Quản lý chất lượng", "Giao tiếp với stakeholder"],
          proof_of_readiness: "Sở hữu nhiều kết quả đo được, xử lý đầu việc ít giám sát và hỗ trợ đồng đội ở phạm vi nhỏ.",
        },
        {
          target_position: "Senior, lead chuyên môn hoặc quản lý nhóm",
          expected_timeline: "Khoảng 3-5+ năm; không mặc định chỉ có một hướng thăng tiến.",
          capabilities_to_build: ["Thiết kế giải pháp", "Ra quyết định dựa trên dữ liệu", "Mentoring", "Lập kế hoạch nguồn lực"],
          proof_of_readiness: "Dẫn dắt được dự án có tác động, phát triển người khác và chịu trách nhiệm về kết quả của phạm vi lớn hơn.",
        },
      ],
    },
  ];
}

function createMockCareerGuidance(input: CareerGuidanceInput): CareerGuidanceOutput {
  const outputCopy = REQUIRED_OUTPUT_COPY[input.user_request.preferred_output_language];
  const { student_profile: profile, labor_market_signals: market, user_request: request } = input;
  const interests = unique([
    ...profile.personal_interests.map((interest) => interest.name),
    ...profile.conversation_memory.stable_interests,
  ]);
  const strengths = unique([
    ...profile.academic_records
      .filter((record) => record.score !== null && record.score >= 8)
      .map((record) => `${record.subject} (${record.score}/10)`),
    ...profile.conversation_memory.stable_abilities,
  ]);
  const personalSignals = unique([
    ...profile.self_reported_activities.map((activity) => activity.name),
    ...profile.simulated_experiences.flatMap((experience) => experience.observed_signal),
  ]);
  const constraints = unique(
    [
      profile.preferences.target_budget,
      profile.preferences.family_constraints,
      profile.preferences.health_constraints_opt_in,
      profile.preferences.time_commitment_hours_per_week === null
        ? null
        : `${profile.preferences.time_commitment_hours_per_week} giờ học mỗi tuần`,
    ].filter((value): value is string => Boolean(value)),
  );
  const avoidPaths = profile.conversation_memory.avoid_paths;
  const requestedTarget = request.target_career_or_major?.trim();
  const postingTitles = market.postings.map((posting) => posting.job_title);
  const candidateTitles = unique([
    ...(requestedTarget ? [requestedTarget] : []),
    ...postingTitles,
    "Phân tích dữ liệu ứng dụng",
    "Vận hành kỹ thuật số",
    "Thiết kế trải nghiệm dịch vụ",
    "Kỹ thuật thực hành và tự động hóa",
  ]).filter((candidate) => !includesText(avoidPaths, candidate));

  while (candidateTitles.length < 3) {
    candidateTitles.push(`Hướng khám phá ${candidateTitles.length + 1}`);
  }

  const labels = ["an toàn", "tăng trưởng cao", "khám phá"] as const;
  const scores = [78, 84, 70];
  const recommendations = candidateTitles.slice(0, 3).map((title, index) => {
    const posting = market.postings.find((item) => item.job_title === title) ?? market.postings[index];
    const firstSkill = posting?.required_skills[0]?.skill_name ?? "kỹ năng nền tảng theo role";
    const matchedSignals = unique([...strengths, ...interests, ...personalSignals]).slice(0, 5);
    const memoryEvidence = profile.conversation_memory.stable_abilities[0];
    const switchContext =
      request.intent === "switch_major"
        ? ` Lộ trình mới tái sử dụng kỹ năng chuyển đổi${memoryEvidence ? ` “${memoryEvidence}”` : " đã lưu"} và tránh các lý do từng khiến bạn từ chối hướng cũ.`
        : "";

    return {
      path_title: `Lộ trình ${labels[index]}: ${title}`,
      path_category:
        index === 2 ? "self_learning" : mapPathCategory(posting?.education_requirement),
      fit_score: scores[index],
      fit_explanation: `Đây là giả lập POC dựa trên các tín hiệu hồ sơ đã cung cấp và dữ liệu thị trường hiện có.${switchContext}`,
      market_evidence: posting
        ? [
            `${posting.job_title} có posting tại ${posting.region}.`,
            `Mức lương ghi nhận: ${formatSalary(posting.avg_salary.min, posting.avg_salary.max)}.`,
          ]
        : ["Chưa có posting trực tiếp; cần bổ sung dữ liệu thị trường trước khi quyết định."],
      reference_documents: [
        { title: "Kaggle Learn", url: "https://www.kaggle.com/learn" },
        { title: "freeCodeCamp Learn", url: "https://www.freecodecamp.org/learn/" },
      ],
      matched_profile_signals: matchedSignals.length > 0 ? matchedSignals : ["Chưa đủ tín hiệu hồ sơ"],
      skill_gaps: (posting?.required_skills.slice(0, 3) ?? [{ skill_name: firstSkill }]).map(
        (skill) => ({
          skill: skill.skill_name,
          current_level: "unknown" as const,
          target_level: "intermediate" as const,
          why_needed: `Cần kiểm chứng mức độ thành thạo ${skill.skill_name} qua bài thực hành hoặc project.`,
        }),
      ),
      roadmap: createRoadmap({
        pathTitle: title,
        skill: firstSkill,
        region:
          posting?.region ||
          profile.target_regions[0] ||
          profile.current_region ||
          "Việt Nam",
        industry: posting?.industry ?? "lĩnh vực mục tiêu",
        salaryBand: posting
          ? formatSalary(posting.avg_salary.min, posting.avg_salary.max)
          : "Chưa có dữ liệu lương trực tiếp",
      }),
      related_jobs: [],
      autonomy_note: outputCopy.autonomyNote,
    } satisfies CareerRecommendation;
  });

  const risingCareers = market.trend_summary.slice(0, 5).map((trend) => ({
    career: trend.career_family,
    region: trend.region,
    evidence: [
      `Tăng trưởng posting: ${trend.posting_growth_rate}%.`,
      `Tăng trưởng lương: ${trend.salary_growth_rate}%.`,
    ],
    confidence: trend.confidence >= 0.75 ? "high" as const : trend.confidence >= 0.45 ? "medium" as const : "low" as const,
  }));
  const shortSupplySkills = unique(
    market.postings.flatMap((posting) =>
      posting.required_skills
        .filter((skill) => skill.is_short_supply)
        .map((skill) => skill.skill_name),
    ),
  ).map((skill) => ({
    skill,
    region: profile.target_regions[0] ?? profile.current_region,
    related_roles: unique(
      market.postings
        .filter((posting) => posting.required_skills.some((item) => item.skill_name === skill))
        .map((posting) => posting.job_title),
    ),
  }));

  return careerGuidanceOutputSchema.parse({
    disclaimer: `${outputCopy.disclaimer} ${outputCopy.mockDisclaimer}`,
    profile_summary: {
      strengths,
      interests,
      personal_signals: personalSignals,
      constraints,
      data_confidence:
        profile.academic_records.length > 0 && profile.personal_interests.length > 0
          ? "high"
          : interests.length > 0 || personalSignals.length > 0
            ? "medium"
            : "low",
    },
    market_summary: {
      rising_careers: risingCareers,
      short_supply_skills: shortSupplySkills,
    },
    recommendations,
    questions_to_improve_recommendation: [
      "Bạn muốn ưu tiên thời gian học, chi phí hay cơ hội việc làm gần nơi ở?",
      "Bạn đã có project hoặc trải nghiệm thực tế nào liên quan đến ba hướng trên chưa?",
    ],
    memory_update: {
      stable_interests: interests,
      stable_abilities: strengths,
      new_constraints: constraints,
      student_decision_to_save:
        request.intent === "switch_major" && requestedTarget
          ? `switch_major:${requestedTarget}`
          : null,
    },
  });
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
 * Generates validated, explainable CareerLens guidance through the configured
 * FPT Cloud LLM. Local development remains usable through a deterministic mock.
 */
export async function generateCareerGuidance(
  rawInput: unknown,
  options: GenerateCareerGuidanceOptions = {},
): Promise<CareerGuidanceOutput> {
  const input = sanitizeCareerGuidanceInput(rawInput);

  if (!input.student_profile.consent_data_usage) {
    return createConsentRequiredOutput(input.user_request.preferred_output_language);
  }

  if (!process.env.FPT_AI_API_KEY) {
    return createMockCareerGuidance(input);
  }

  const requestedModel = resolveAIModel(options.model);
  const generateWithModel = async (model: string) => {
    const { data } = await generateAIJson<unknown>({
      systemPrompt: CAREERLENS_SYSTEM_PROMPT,
      userPrompt: buildCareerGuidanceUserPrompt(input),
      model,
      traceName: "careerlens-guidance",
      userId: options.userId,
    });

    const parsedOutput = careerGuidanceOutputSchema.safeParse(data);
    if (!parsedOutput.success) {
      throw new AIServiceError(
        `CareerLens LLM output failed validation: ${parsedOutput.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    if (parsedOutput.data.recommendations.length !== 3) {
      throw new AIServiceError(
        `CareerLens LLM output must contain exactly 3 recommendations; received ${parsedOutput.data.recommendations.length}`,
      );
    }

    return applyMandatoryGuardrails(
      parsedOutput.data,
      input.user_request.preferred_output_language,
    );
  };

  try {
    return await generateWithModel(requestedModel);
  } catch (error) {
    if (requestedModel === DEFAULT_MODEL) throw error;

    console.warn("[careerlens] selected model output failed; retrying with default", {
      selectedModel: requestedModel,
      fallbackModel: DEFAULT_MODEL,
    });
    return generateWithModel(DEFAULT_MODEL);
  }
}

export { CAREERLENS_SYSTEM_PROMPT } from "./system-prompt";
export {
  careerGuidanceInputSchema,
  careerGuidanceOutputSchema,
  type CareerGuidanceInput,
  type CareerGuidanceOutput,
} from "./schemas";
