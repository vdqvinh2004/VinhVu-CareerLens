import { describe, expect, it } from "vitest";

import {
  certificateSchema,
  educationRecordSchema,
  hasValidEvidenceSignature,
  validateEvidenceFile,
  workExperienceSchema,
} from "@/lib/profile-record-validation";

describe("profile record validation", () => {
  it("accepts a new education record without an id", () => {
    const result = educationRecordSchema.safeParse({
      id: null,
      level: "UNDERGRADUATE",
      institutionName: "Đại học Bách khoa",
      fieldOfStudy: "Khoa học máy tính",
      scoreScale: "4",
      researchTitle: "",
      researchDescription: "",
      startMonth: "9",
      startYear: "2021",
      endMonth: "6",
      endYear: "2025",
    });

    expect(result.success).toBe(true);
  });

  it("removes scientific research from high school records", () => {
    const result = educationRecordSchema.safeParse({
      id: null,
      level: "HIGH_SCHOOL",
      institutionName: "THPT Chu Văn An",
      fieldOfStudy: "Khoa học tự nhiên",
      scoreScale: "4",
      researchTitle: "Không được lưu",
      researchDescription: "Không được lưu",
      startMonth: "9",
      startYear: "2018",
      endMonth: "6",
      endYear: "2021",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scoreScale).toBe(10);
      expect(result.data.researchTitle).toBeNull();
      expect(result.data.researchDescription).toBeNull();
    }
  });

  it("accepts a high-school form when hidden research fields are absent", () => {
    const result = educationRecordSchema.safeParse({
      id: null,
      level: "HIGH_SCHOOL",
      institutionName: "THPT Chu Văn An",
      fieldOfStudy: "Khoa học tự nhiên",
      scoreScale: "10",
      startMonth: "9",
      startYear: "2018",
      endMonth: "6",
      endYear: "2021",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.researchTitle).toBeNull();
      expect(result.data.researchDescription).toBeNull();
    }
  });

  it("requires both a research title and description", () => {
    const result = educationRecordSchema.safeParse({
      id: null,
      level: "GRADUATE",
      institutionName: "Đại học Quốc gia",
      fieldOfStudy: "Trí tuệ nhân tạo",
      scoreScale: "10",
      researchTitle: "Mô hình tư vấn nghề nghiệp",
      researchDescription: "",
      startMonth: "9",
      startYear: "2025",
      endMonth: "6",
      endYear: "2027",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("researchIncomplete");
    }
  });

  it("requires a complete work end date when the role is not current", () => {
    const result = workExperienceSchema.safeParse({
      id: null,
      workplaceName: "MeshMind",
      position: "Intern",
      startMonth: "6",
      startYear: "2025",
      endMonth: "",
      endYear: "",
      isCurrent: null,
      learnings: "",
      skills: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("endDateRequired");
    }
  });

  it("rejects a work end date before its start date", () => {
    const result = workExperienceSchema.safeParse({
      id: null,
      workplaceName: "MeshMind",
      position: "Intern",
      startMonth: "6",
      startYear: "2025",
      endMonth: "5",
      endYear: "2025",
      isCurrent: null,
      learnings: "",
      skills: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("endDateBeforeStart");
    }
  });

  it("accepts a current role without an end date", () => {
    const result = workExperienceSchema.safeParse({
      id: null,
      workplaceName: "MeshMind",
      position: "Engineer",
      startMonth: "1",
      startYear: "2025",
      endMonth: null,
      endYear: null,
      isCurrent: "on",
      learnings: "Product delivery",
      skills: "TypeScript",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endMonth).toBeNull();
      expect(result.data.endYear).toBeNull();
    }
  });

  it("validates certificate fields and evidence file limits", () => {
    expect(
      certificateSchema.safeParse({
        id: null,
        name: "IELTS",
        issuedYear: "2025",
        startMonth: "1",
        startYear: "2025",
        endMonth: "12",
        endYear: "2025",
      }).success,
    ).toBe(true);

    const pdf = new File(["%PDF-1.7"], "ielts.pdf", {
      type: "application/pdf",
    });
    expect(validateEvidenceFile(pdf, true)).toBeNull();
    expect(
      hasValidEvidenceSignature(
        pdf.type,
        new TextEncoder().encode("%PDF-1.7"),
      ),
    ).toBe(true);
  });

  it("rejects a file whose content does not match its declared type", () => {
    expect(
      hasValidEvidenceSignature(
        "application/pdf",
        new TextEncoder().encode("not a pdf"),
      ),
    ).toBe(false);
  });
});
