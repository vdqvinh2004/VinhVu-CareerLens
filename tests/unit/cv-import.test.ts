import { describe, expect, it } from "vitest";

import { CV_PDF_MAX_BYTES, validateCvPdfFile } from "@/lib/cv-import/pdf";
import { normalizeCvImportKey } from "@/lib/cv-import/persistence";
import { cvImportSchema } from "@/lib/cv-import/schema";

const validEducation = {
  education: [
    {
      record: {
        level: "HIGH_SCHOOL",
        institutionName: "THPT Chuyên Hà Nội - Amsterdam",
        fieldOfStudy: "Chuyên Toán",
        startMonth: 9,
        startYear: 2020,
        endMonth: 5,
        endYear: 2023,
        scoreScale: 10,
        researchTitle: null,
        researchDescription: null,
      },
      transcriptEntries: [
        {
          stage: "GRADE_12",
          subjectName: "Toán",
          credits: null,
          score: 9.2,
        },
      ],
    },
  ],
  certificates: [],
  competitions: [],
  activities: [],
  workExperiences: [],
};

describe("CV import validation", () => {
  it("accepts profile data that matches the existing education model", () => {
    const result = cvImportSchema.parse(validEducation);

    expect(result.education[0]?.record.institutionName).toBe(
      "THPT Chuyên Hà Nội - Amsterdam",
    );
    expect(result.education[0]?.record.researchTitle).toBeNull();
  });

  it("rejects cumulative transcript rows for high school", () => {
    const input = structuredClone(validEducation);
    input.education[0]!.transcriptEntries[0]!.stage = "CUMULATIVE";

    expect(cvImportSchema.safeParse(input).success).toBe(false);
  });

  it("normalizes Vietnamese text for duplicate detection", () => {
    expect(normalizeCvImportKey("  Đại học BÁCH-KHOA  ")).toBe(
      "dai hoc bach khoa",
    );
  });
});
describe("CV PDF validation", () => {
  it("accepts a PDF within the upload limit", () => {
    const file = new File(["%PDF-test"], "cv.pdf", {
      type: "application/pdf",
    });

    expect(validateCvPdfFile(file)).toBeNull();
  });

  it("rejects a file with the wrong extension", () => {
    const file = new File(["%PDF-test"], "cv.txt", {
      type: "application/pdf",
    });

    expect(validateCvPdfFile(file)).toBe("invalidType");
  });

  it("rejects a PDF above the upload limit", () => {
    const file = new File([new Uint8Array(CV_PDF_MAX_BYTES + 1)], "cv.pdf", {
      type: "application/pdf",
    });

    expect(validateCvPdfFile(file)).toBe("tooLarge");
  });
});
