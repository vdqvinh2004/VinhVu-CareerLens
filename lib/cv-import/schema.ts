import { z } from "zod";

import {
  activitySchema,
  certificateSchema,
  competitionSchema,
  educationRecordSchema,
  workExperienceSchema,
} from "@/lib/profile-record-validation";

const importedTranscriptEntrySchema = z.object({
  stage: z.enum(["GRADE_10", "GRADE_11", "GRADE_12", "CUMULATIVE"]),
  subjectName: z.string().trim().min(1).max(200),
  credits: z.number().positive().max(100).nullable(),
  score: z.number().min(0).max(10),
});

function withoutId<T extends { id?: string }>(value: T): Omit<T, "id"> {
  const { id, ...record } = value;
  void id;
  return record;
}

const importedEducationSchema = z
  .object({
    record: educationRecordSchema.transform(withoutId),
    transcriptEntries: z.array(importedTranscriptEntrySchema).max(200).default([]),
  })
  .superRefine(({ record, transcriptEntries }, context) => {
    for (const [index, entry] of transcriptEntries.entries()) {
      if (entry.score > record.scoreScale) {
        context.addIssue({
          code: "custom",
          message: "scoreOutsideScale",
          path: ["transcriptEntries", index, "score"],
        });
      }

      if (record.level === "HIGH_SCHOOL") {
        if (entry.stage === "CUMULATIVE" || entry.credits !== null) {
          context.addIssue({
            code: "custom",
            message: "invalidHighSchoolTranscript",
            path: ["transcriptEntries", index],
          });
        }
      } else if (entry.stage !== "CUMULATIVE" || entry.credits === null) {
        context.addIssue({
          code: "custom",
          message: "invalidHigherEducationTranscript",
          path: ["transcriptEntries", index],
        });
      }
    }
  });

export const cvImportSchema = z.object({
  education: z.array(importedEducationSchema).max(6).default([]),
  certificates: z
    .array(certificateSchema.transform(withoutId))
    .max(30)
    .default([]),
  competitions: z
    .array(competitionSchema.transform(withoutId))
    .max(20)
    .default([]),
  activities: z.array(activitySchema.transform(withoutId)).max(30).default([]),
  workExperiences: z
    .array(workExperienceSchema.transform(withoutId))
    .max(30)
    .default([]),
});

export type CvImportData = z.infer<typeof cvImportSchema>;
export type CvImportEducation = CvImportData["education"][number];
