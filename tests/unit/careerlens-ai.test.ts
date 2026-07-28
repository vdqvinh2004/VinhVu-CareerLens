import { afterEach, describe, expect, it, vi } from "vitest";

import { AVAILABLE_MODELS } from "@/lib/ai";
import {
  CAREERLENS_SYSTEM_PROMPT,
  buildCareerGuidanceUserPrompt,
  generateCareerGuidance,
  sanitizeCareerGuidanceInput,
  type CareerGuidanceInput,
} from "@/lib/careerlens";

function createCareerGuidanceInput(): CareerGuidanceInput {
  return {
    student_profile: {
      profile_id: "profile-001",
      consent_data_usage: true,
      bias_exclusion_flag: true,
      education_level: "THPT",
      current_region: "TP. Hồ Chí Minh",
      target_regions: ["TP. Hồ Chí Minh"],
      languages: ["Tiếng Việt", "English"],
      academic_records: [
        { subject: "Toán", score: 8.5, evidence: "school_record" },
      ],
      self_reported_activities: [
        {
          type: "project",
          name: "Website câu lạc bộ",
          description: "Thiết kế và triển khai website nhỏ.",
          duration: "3 tháng",
          evidence: null,
        },
      ],
      personal_interests: [
        {
          name: "Công nghệ",
          category: "technology",
          intensity: 4,
          why_it_matters: "Thích tạo sản phẩm hữu ích.",
        },
      ],
      preferences: {
        target_budget: "Dưới 20 triệu đồng/năm",
        time_commitment_hours_per_week: 10,
        work_env_pref: ["hybrid", "team_based"],
        learning_style: ["project_based", "mentor_guided"],
        health_constraints_opt_in: null,
        family_constraints: null,
      },
      simulated_experiences: [
        {
          scenario_name: "Giải quyết lỗi sản phẩm",
          behavioral_choice: "Tìm nguyên nhân và thử từng giả thuyết",
          response_time_sec: 45,
          observed_signal: ["problem_solving", "persistence"],
        },
      ],
      conversation_memory: {
        stable_interests: ["Xây dựng sản phẩm số"],
        stable_abilities: ["Tư duy phân tích"],
        avoid_paths: [],
        previous_recommendations: [],
        student_decisions: [],
      },
      starting_point: null,
    },
    labor_market_signals: {
      source_timestamp: "2026-07-18T00:00:00Z",
      postings: [
        {
          job_id: "job-001",
          job_title: "Data Analyst",
          industry: "Công nghệ",
          region: "TP. Hồ Chí Minh",
          avg_salary: {
            min: 12_000_000,
            max: 22_000_000,
            currency: "VND",
            period: "month",
          },
          required_skills: [
            {
              skill_name: "SQL",
              importance: 5,
              is_short_supply: true,
              is_proprietary: false,
            },
          ],
          experience_level: "fresher",
          education_requirement: "flexible",
          culture_fit_indicators: ["team_based"],
          posted_at: "2026-07-10T00:00:00Z",
        },
        {
          job_id: "job-002",
          job_title: "QA Automation",
          industry: "Phần mềm",
          region: "TP. Hồ Chí Minh",
          avg_salary: {
            min: 11_000_000,
            max: 20_000_000,
            currency: "VND",
            period: "month",
          },
          required_skills: [
            {
              skill_name: "Test automation",
              importance: 4,
              is_short_supply: false,
              is_proprietary: false,
            },
          ],
          experience_level: "fresher",
          education_requirement: "college",
          culture_fit_indicators: ["team_based"],
          posted_at: "2026-07-12T00:00:00Z",
        },
      ],
      trend_summary: [
        {
          career_family: "Dữ liệu",
          region: "TP. Hồ Chí Minh",
          posting_growth_rate: 12,
          salary_growth_rate: 6,
          short_supply_skills: ["SQL"],
          confidence: 0.8,
        },
      ],
    },
    user_request: {
      intent: "initial_guidance",
      question: "Tôi nên thử hướng nghề nào?",
      target_career_or_major: null,
      preferred_output_language: "vi",
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CareerLens AI", () => {
  it("strips sensitive identity fields before building the LLM prompt", () => {
    const rawInput = createCareerGuidanceInput() as CareerGuidanceInput & {
      student_profile: CareerGuidanceInput["student_profile"] & {
        gender: string;
        hometown: string;
        ethnicity: string;
        religion: string;
      };
    };
    rawInput.student_profile.gender = "sensitive-gender-value";
    rawInput.student_profile.hometown = "sensitive-hometown-value";
    rawInput.student_profile.ethnicity = "sensitive-ethnicity-value";
    rawInput.student_profile.religion = "sensitive-religion-value";

    const sanitized = sanitizeCareerGuidanceInput(rawInput);
    const prompt = buildCareerGuidanceUserPrompt(sanitized);

    expect(prompt).not.toContain("sensitive-gender-value");
    expect(prompt).not.toContain("sensitive-hometown-value");
    expect(prompt).not.toContain("sensitive-ethnicity-value");
    expect(prompt).not.toContain("sensitive-religion-value");
  });

  it("does not analyze personal data without consent", async () => {
    const input = createCareerGuidanceInput();
    input.student_profile.consent_data_usage = false;
    vi.stubEnv("FPT_AI_API_KEY", "should-not-be-used");

    const output = await generateCareerGuidance(input);

    expect(output.recommendations).toEqual([]);
    expect(output.profile_summary.strengths).toEqual([]);
    expect(output.profile_summary.constraints[0]).toContain("Chưa có sự đồng ý");
  });

  it("returns three deterministic recommendation paths when the LLM is not configured", async () => {
    vi.stubEnv("FPT_AI_API_KEY", "");
    const input = createCareerGuidanceInput();

    const firstOutput = await generateCareerGuidance(input);
    const secondOutput = await generateCareerGuidance(input);

    expect(secondOutput).toEqual(firstOutput);
    expect(firstOutput.disclaimer).toContain("mock deterministic");
    expect(firstOutput.recommendations).toHaveLength(3);
    expect(firstOutput.recommendations.map((item) => item.path_title)).toEqual([
      expect.stringContaining("an toàn"),
      expect.stringContaining("tăng trưởng cao"),
      expect.stringContaining("khám phá"),
    ]);
    expect(firstOutput.recommendations[2].path_category).not.toBe("university");
    expect(firstOutput.recommendations[0].roadmap.map((stage) => stage.stage_type)).toEqual([
      "learning",
      "internship",
      "full_time",
    ]);
    expect(firstOutput.recommendations[0].roadmap[0].subjects.length).toBeGreaterThanOrEqual(2);
    expect(firstOutput.recommendations[0].roadmap[1].cv_preparation.length).toBeGreaterThanOrEqual(2);
    expect(firstOutput.recommendations[0].roadmap[2].promotion_path.length).toBeGreaterThanOrEqual(1);
  });

  it("reuses stored abilities when generating a switch-major mock path", async () => {
    vi.stubEnv("FPT_AI_API_KEY", "");
    const input = createCareerGuidanceInput();
    input.user_request.intent = "switch_major";
    input.user_request.target_career_or_major = "Product Design";
    input.student_profile.conversation_memory.stable_abilities = [
      "Phỏng vấn và tổng hợp nhu cầu người dùng",
    ];
    input.student_profile.conversation_memory.avoid_paths = ["QA Automation"];

    const output = await generateCareerGuidance(input);

    expect(output.recommendations[0].path_title).toContain("Product Design");
    expect(output.recommendations[0].fit_explanation).toContain(
      "Phỏng vấn và tổng hợp nhu cầu người dùng",
    );
    expect(output.recommendations.some((item) => item.path_title.includes("QA Automation"))).toBe(
      false,
    );
    expect(output.memory_update.student_decision_to_save).toBe("switch_major:Product Design");
  });

  it("calls the configured LLM with the CareerLens system prompt and validates its output", async () => {
    const input = createCareerGuidanceInput();
    vi.stubEnv("FPT_AI_API_KEY", "");
    const validModelOutput = await generateCareerGuidance(input);
    vi.stubEnv("FPT_AI_API_KEY", "test-api-key");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "completion-001",
          object: "chat.completion",
          created: 1_752_793_600,
          model: "DeepSeek-V4-Flash",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: JSON.stringify(validModelOutput) },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const addedModel = !AVAILABLE_MODELS.includes("DeepSeek-V4-Flash");
    if (addedModel) AVAILABLE_MODELS.push("DeepSeek-V4-Flash");

    try {
      const output = await generateCareerGuidance(input, {
        model: "DeepSeek-V4-Flash",
      });

      expect(fetchMock).toHaveBeenCalledOnce();
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      const requestBody = JSON.parse(String(request.body)) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(requestBody.messages[0]).toEqual({
        role: "system",
        content: CAREERLENS_SYSTEM_PROMPT,
      });
      expect(requestBody.messages[1].role).toBe("user");
      expect(output.disclaimer).not.toContain("mock deterministic");
      expect(output.recommendations).toHaveLength(3);
    } finally {
      if (addedModel) AVAILABLE_MODELS.pop();
    }
  });

  it("retries with Qwen when another model returns an invalid output", async () => {
    const input = createCareerGuidanceInput();
    vi.stubEnv("FPT_AI_API_KEY", "");
    const validModelOutput = await generateCareerGuidance(input);
    vi.stubEnv("FPT_AI_API_KEY", "test-api-key");

    const completion = (model: string, content: string) =>
      new Response(
        JSON.stringify({
          id: `completion-${model}`,
          object: "chat.completion",
          created: 1_752_793_600,
          model,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completion("DeepSeek-V4-Flash", JSON.stringify({ invalid: true })),
      )
      .mockResolvedValueOnce(
        completion("Qwen3.6-27B", JSON.stringify(validModelOutput)),
      );
    vi.stubGlobal("fetch", fetchMock);
    const addedModel = !AVAILABLE_MODELS.includes("DeepSeek-V4-Flash");
    if (addedModel) AVAILABLE_MODELS.push("DeepSeek-V4-Flash");

    try {
      const output = await generateCareerGuidance(input, {
        model: "DeepSeek-V4-Flash",
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        fetchMock.mock.calls.map((call) =>
          JSON.parse(String((call[1] as RequestInit).body)).model,
        ),
      ).toEqual(["DeepSeek-V4-Flash", "Qwen3.6-27B"]);
      expect(output.recommendations).toHaveLength(3);
    } finally {
      if (addedModel) AVAILABLE_MODELS.pop();
    }
  });
});
