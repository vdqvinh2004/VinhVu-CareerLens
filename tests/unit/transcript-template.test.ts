import { describe, expect, it } from "vitest";

import { parseTranscriptFile } from "@/lib/transcript-import";
import {
  createTranscriptTemplate,
  transcriptTemplateFileName,
} from "@/lib/transcript-template";

describe("transcript Excel templates", () => {
  it("creates a high-school template accepted by the importer", async () => {
    const buffer = await createTranscriptTemplate("HIGH_SCHOOL", 10, "vi");
    const file = new File(
      [new Uint8Array(buffer)],
      transcriptTemplateFileName("HIGH_SCHOOL", 10, "vi"),
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );

    const entries = await parseTranscriptFile(
      file,
      "HIGH_SCHOOL",
      "GRADE_10",
      10,
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      credits: null,
      score: 8.5,
      stage: "GRADE_10",
      subjectName: "Toán",
    });
  });

  it("creates a credit-based university template for the selected scale", async () => {
    const buffer = await createTranscriptTemplate("UNDERGRADUATE", 4, "en");
    const file = new File(
      [new Uint8Array(buffer)],
      transcriptTemplateFileName("UNDERGRADUATE", 4, "en"),
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );

    const entries = await parseTranscriptFile(
      file,
      "UNDERGRADUATE",
      "CUMULATIVE",
      4,
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      credits: 3,
      score: 3.5,
      stage: "CUMULATIVE",
      subjectName: "Data Structures",
    });
  });
});
