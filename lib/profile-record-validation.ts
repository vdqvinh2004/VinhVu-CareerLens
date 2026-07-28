import { z } from "zod";

import {
  EDUCATION_LEVELS,
  PROFILE_EVIDENCE_MAX_BYTES,
  PROFILE_EVIDENCE_MIME_TYPES,
} from "@/lib/profile-records";

const currentYear = new Date().getUTCFullYear();
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === null || value === undefined ? "" : value),
    z.string().trim().max(max).transform((value) => value || null),
  );
const year = z.coerce.number().int().min(1900).max(currentYear + 10);
const month = z.coerce.number().int().min(1).max(12);
const periodShape = {
  startMonth: month,
  startYear: year,
  endMonth: month,
  endYear: year,
};
const id = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().uuid().optional(),
);

function validatePeriod(
  value: { startMonth: number; startYear: number; endMonth: number; endYear: number },
  context: z.RefinementCtx,
) {
  if (value.endYear * 12 + value.endMonth < value.startYear * 12 + value.startMonth) {
    context.addIssue({
      code: "custom",
      message: "endDateBeforeStart",
      path: ["endDate"],
    });
  }
}

export const educationRecordSchema = z
  .object({
    id,
    level: z.enum(EDUCATION_LEVELS),
    institutionName: requiredText(200),
    fieldOfStudy: optionalText(200),
    scoreScale: z.coerce
      .number()
      .refine((value) => value === 4 || value === 10)
      .transform((value) => value as 4 | 10),
    researchTitle: optionalText(300),
    researchDescription: optionalText(4000),
    ...periodShape,
  })
  .superRefine((value, context) => {
    validatePeriod(value, context);
    if (
      value.level !== "HIGH_SCHOOL" &&
      Boolean(value.researchTitle) !== Boolean(value.researchDescription)
    ) {
      context.addIssue({
        code: "custom",
        message: "researchIncomplete",
        path: ["research"],
      });
    }
  })
  .transform((value) =>
    value.level === "HIGH_SCHOOL"
      ? {
          ...value,
          scoreScale: 10 as const,
          researchTitle: null,
          researchDescription: null,
        }
      : value,
  );

export const certificateSchema = z
  .object({
    id,
    name: requiredText(200),
    issuedYear: year,
    ...periodShape,
  })
  .superRefine(validatePeriod);

export const competitionSchema = z
  .object({
    id,
    name: requiredText(200),
    awardName: optionalText(200),
    year,
    ...periodShape,
  })
  .superRefine(validatePeriod);

export const activitySchema = z
  .object({
    id,
    name: requiredText(300),
    ...periodShape,
  })
  .superRefine(validatePeriod);

export const workExperienceSchema = z
  .object({
    id,
    workplaceName: requiredText(200),
    position: optionalText(200),
    startMonth: month,
    startYear: year,
    endMonth: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      month.optional(),
    ),
    endYear: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      year.optional(),
    ),
    isCurrent: z.preprocess(
      (value) => value === "on" || value === "true" || value === true,
      z.boolean(),
    ),
    learnings: optionalText(4000),
    skills: optionalText(2000),
  })
  .superRefine((value, context) => {
    if (value.isCurrent) {
      return;
    }

    if (!value.endMonth || !value.endYear) {
      context.addIssue({
        code: "custom",
        message: "endDateRequired",
        path: ["endDate"],
      });
      return;
    }

    const start = value.startYear * 12 + value.startMonth;
    const end = value.endYear * 12 + value.endMonth;
    if (end < start) {
      context.addIssue({
        code: "custom",
        message: "endDateBeforeStart",
        path: ["endDate"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    endMonth: value.isCurrent ? null : (value.endMonth ?? null),
    endYear: value.isCurrent ? null : (value.endYear ?? null),
  }));

export function validateEvidenceFile(file: File | null, required: boolean) {
  if (!file || file.size === 0) {
    return required ? "required" : null;
  }

  if (file.size > PROFILE_EVIDENCE_MAX_BYTES) {
    return "tooLarge";
  }

  if (
    !PROFILE_EVIDENCE_MIME_TYPES.includes(
      file.type as (typeof PROFILE_EVIDENCE_MIME_TYPES)[number],
    )
  ) {
    return "invalidType";
  }

  return null;
}

export function hasValidEvidenceSignature(
  mimeType: string,
  bytes: Uint8Array,
) {
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }

  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}
