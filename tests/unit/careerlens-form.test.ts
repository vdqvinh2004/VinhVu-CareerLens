import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCareerGuidanceInput,
  careerLensFormSchema,
} from "@/lib/careerlens/form";

function createValidFormData() {
  const formData = new FormData();
  const values = {
    educationLevel: "THPT",
    currentRegion: "Thành phố Hồ Chí Minh",
    targetRegion: "Thành phố Hồ Chí Minh",
    languages: "Tiếng Việt, English",
    strongSubject: "Toán",
    subjectScore: "8.5",
    interests: "Công nghệ, bóng đá, kinh doanh",
    activity: "Tôi từng làm website giới thiệu cho câu lạc bộ ở trường.",
    weeklyHours: "10",
    targetBudget: "Dưới 20 triệu đồng/năm",
    workEnvironment: "team_based",
    learningStyle: "project_based",
    familyConstraints: "Cần học gần nhà",
    intent: "initial_guidance",
    question: "Tôi nên bắt đầu kiểm chứng hướng nghề nào trong ba tháng tới?",
    consent: "on",
    submitAction: "generate",
  };

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("VinhVu CareerLen form integration", () => {
  it("maps validated form values into the LLM input contract", () => {
    const rawValues = Object.fromEntries(createValidFormData());
    const parsed = careerLensFormSchema.parse(rawValues);

    const input = buildCareerGuidanceInput(parsed, "student-001");

    expect(input.student_profile.profile_id).toBe("student-001");
    expect(input.student_profile.personal_interests.map((item) => item.name)).toEqual([
      "Công nghệ",
      "bóng đá",
      "kinh doanh",
    ]);
    expect(input.student_profile.preferences.learning_style).toEqual(["project_based"]);
    expect(input.labor_market_signals.postings).toHaveLength(20);
    expect(new Set(input.labor_market_signals.postings.map((posting) => posting.industry))).toHaveLength(20);
    expect(input.labor_market_signals.postings.every((posting) => posting.region === "Thành phố Hồ Chí Minh")).toBe(true);
    expect(input.user_request.target_career_or_major).toBeNull();
  });

  it("rejects form submission without explicit consent", () => {
    const rawValues = Object.fromEntries(createValidFormData());
    delete rawValues.consent;

    const parsed = careerLensFormSchema.safeParse(rawValues);

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.consent).toBeDefined();
    }
  });



  it("does not add a blank activity or academic record", () => {
    const formData = new FormData();
    formData.set("consent", "on");
    const parsed = careerLensFormSchema.parse(Object.fromEntries(formData));

    const input = buildCareerGuidanceInput(parsed, "student-001");

    expect(input.student_profile.academic_records).toEqual([]);
    expect(input.student_profile.self_reported_activities).toEqual([]);
  });


  it("accepts an empty desired outcome", () => {
    const rawValues = Object.fromEntries(createValidFormData());
    rawValues.question = "";

    const parsed = careerLensFormSchema.parse(rawValues);
    const input = buildCareerGuidanceInput(parsed, "student-001");

    expect(input.user_request.question).toBe("");
  });

  it("integrates the complete Starting Point snapshot into the guidance input", () => {
    const parsed = careerLensFormSchema.parse(
      Object.fromEntries(createValidFormData()),
    );
    const startingPoint = {
      personality: {
        resultType: "INTJ",
        scores: { E: 1, I: 2, S: 1, N: 2, T: 2, F: 1, J: 2, P: 1 },
        completedAt: "2026-07-18T00:00:00.000Z",
      },
      education: [
        {
          id: "0efb4bd6-83ef-4c77-ae60-5f8cfe004177",
          level: "UNDERGRADUATE" as const,
          institutionName: "Đại học Mẫu",
          fieldOfStudy: "Khoa học dữ liệu",
          startMonth: 9,
          startYear: 2024,
          endMonth: 6,
          endYear: 2028,
          scoreScale: 4 as const,
          researchTitle: "Phân tích dữ liệu giáo dục",
          researchDescription: "Mô hình phát hiện sớm rủi ro học tập.",
          transcriptEntries: [
            {
              stage: "CUMULATIVE" as const,
              subjectName: "Xác suất thống kê",
              credits: 3,
              score: 3.2,
            },
          ],
        },
      ],
      certificates: [
        {
          name: "SQL cơ bản",
          issuedYear: 2025,
          startMonth: 1,
          startYear: 2025,
          endMonth: 3,
          endYear: 2025,
          hasAttachment: true,
        },
      ],
      competitions: [
        {
          name: "Phân tích dữ liệu sinh viên",
          awardName: "Giải khuyến khích",
          year: 2025,
          startMonth: 3,
          startYear: 2025,
          endMonth: 5,
          endYear: 2025,
        },
      ],
      activities: [
        {
          name: "Câu lạc bộ học thuật",
          startMonth: 9,
          startYear: 2024,
          endMonth: 6,
          endYear: 2025,
        },
      ],
      workExperiences: [
        {
          workplaceName: "Phòng dữ liệu",
          position: "Thực tập sinh",
          startMonth: 6,
          startYear: 2025,
          endMonth: 8,
          endYear: 2025,
          isCurrent: false,
          learnings: "Làm sạch dữ liệu",
          skills: "SQL, Excel",
        },
      ],
    };

    const input = buildCareerGuidanceInput(
      parsed,
      "student-001",
      "vi",
      startingPoint,
    );

    expect(input.student_profile.starting_point).toEqual(startingPoint);
    expect(input.student_profile.academic_records).toContainEqual({
      subject: "Xác suất thống kê (Đại học Mẫu)",
      score: 8,
      evidence: "school_record",
    });
    expect(input.student_profile.self_reported_activities.map((item) => item.type)).toEqual(
      expect.arrayContaining(["project", "certificate", "competition", "other", "part_time"]),
    );
    expect(input.student_profile.conversation_memory.stable_abilities).toEqual(
      expect.arrayContaining(["Toán", "SQL", "Excel"]),
    );
  });

  it("accepts only the official 34 province and city values", () => {
    const validValues = Object.fromEntries(createValidFormData());
    const validResult = careerLensFormSchema.safeParse(validValues);
    expect(validResult.success).toBe(true);

    validValues.currentRegion = "Tỉnh không tồn tại";
    const invalidResult = careerLensFormSchema.safeParse(validValues);
    expect(invalidResult.success).toBe(false);
  });


});
