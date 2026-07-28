export const EDUCATION_LEVELS = [
  "HIGH_SCHOOL",
  "UNDERGRADUATE",
  "GRADUATE",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const TRANSCRIPT_STAGES = [
  "GRADE_10",
  "GRADE_11",
  "GRADE_12",
  "CUMULATIVE",
] as const;
export type TranscriptStage = (typeof TRANSCRIPT_STAGES)[number];

export type TranscriptSummaryDto = {
  stage: TranscriptStage;
  average: number;
  subjectCount: number;
  totalCredits: number | null;
};

export type EducationRecordDto = {
  id: string;
  level: EducationLevel;
  institutionName: string;
  fieldOfStudy: string | null;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  scoreScale: 4 | 10;
  researchTitle: string | null;
  researchDescription: string | null;
  transcriptSummaries: TranscriptSummaryDto[];
};

export type CertificateDto = {
  id: string;
  name: string;
  issuedYear: number;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
  attachment: {
    fileName: string;
    mimeType: string;
  } | null;
};

export type CompetitionDto = {
  id: string;
  name: string;
  awardName: string | null;
  year: number;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

export type ActivityDto = {
  id: string;
  name: string;
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

export type WorkExperienceDto = {
  id: string;
  workplaceName: string;
  position: string | null;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
  isCurrent: boolean;
  learnings: string | null;
  skills: string | null;
};

export type ProfileRecordKind =
  | "education"
  | "certificate"
  | "competition"
  | "activity"
  | "workExperience";

export type ProfileRecordActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const PROFILE_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const TRANSCRIPT_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const TRANSCRIPT_MAX_ROWS = 200;
export const PROFILE_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
