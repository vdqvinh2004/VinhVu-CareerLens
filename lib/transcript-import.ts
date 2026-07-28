import {
  readSheet,
  type CellValue,
  type SheetData,
} from "read-excel-file/node";

import {
  TRANSCRIPT_FILE_MAX_BYTES,
  TRANSCRIPT_MAX_ROWS,
  type EducationLevel,
  type TranscriptStage,
} from "@/lib/profile-records";

export type TranscriptEntryInput = {
  stage: TranscriptStage;
  subjectName: string;
  credits: number | null;
  score: number;
};

export type TranscriptImportErrorCode =
  | "fileTooLarge"
  | "invalidFile"
  | "missingHeaders"
  | "empty"
  | "tooManyRows"
  | "invalidRow"
  | "duplicateSubject"
  | "reimportRequired";

export class TranscriptImportError extends Error {
  constructor(
    public readonly code: TranscriptImportErrorCode,
    public readonly row?: number,
  ) {
    super(code);
    this.name = "TranscriptImportError";
  }
}

type SpreadsheetCell = CellValue | null;

function normalizeHeader(value: SpreadsheetCell) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function columnIndex(headers: SpreadsheetCell[], aliases: string[]) {
  const normalized = headers.map(normalizeHeader);
  return normalized.findIndex((header) => aliases.includes(header));
}

function numberFromCell(value: SpreadsheetCell) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number(value.trim().replace(",", "."));
}

function subjectFromCell(value: SpreadsheetCell) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validateXlsxFile(file: File) {
  if (file.size === 0 || !file.name.toLowerCase().endsWith(".xlsx")) {
    throw new TranscriptImportError("invalidFile");
  }
  if (file.size > TRANSCRIPT_FILE_MAX_BYTES) {
    throw new TranscriptImportError("fileTooLarge");
  }
}

export async function parseTranscriptFile(
  file: File,
  level: EducationLevel,
  stage: TranscriptStage,
  scoreScale: 4 | 10,
): Promise<TranscriptEntryInput[]> {
  validateXlsxFile(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new TranscriptImportError("invalidFile");
  }

  let rows: SheetData;
  try {
    rows = await readSheet(Buffer.from(bytes));
  } catch {
    throw new TranscriptImportError("invalidFile");
  }

  const [headers, ...dataRows] = rows;
  if (!headers) throw new TranscriptImportError("empty");

  const subjectIndex = columnIndex(headers, ["mon hoc", "ten mon hoc", "subject"]);
  const scoreAliases =
    level === "HIGH_SCHOOL"
      ? ["diem trung binh ca nam", "diem tb ca nam", "diem", "score"]
      : ["diem", "score"];
  const scoreIndex = columnIndex(headers, scoreAliases);
  const creditsIndex =
    level === "HIGH_SCHOOL"
      ? -1
      : columnIndex(headers, ["tin chi", "so tin chi", "credits", "credit"]);

  if (subjectIndex < 0 || scoreIndex < 0 || (level !== "HIGH_SCHOOL" && creditsIndex < 0)) {
    throw new TranscriptImportError("missingHeaders");
  }

  const nonEmptyRows = dataRows.filter((row) => row.some((cell) => cell !== null));
  if (nonEmptyRows.length === 0) throw new TranscriptImportError("empty");
  if (nonEmptyRows.length > TRANSCRIPT_MAX_ROWS) {
    throw new TranscriptImportError("tooManyRows");
  }

  const subjects = new Set<string>();
  return nonEmptyRows.map((row, index) => {
    const subjectName = subjectFromCell(row[subjectIndex]);
    const score = numberFromCell(row[scoreIndex]);
    const credits =
      level === "HIGH_SCHOOL" ? null : numberFromCell(row[creditsIndex]);
    const rowNumber = index + 2;

    if (
      !subjectName ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > scoreScale ||
      (level !== "HIGH_SCHOOL" &&
        (!Number.isFinite(credits) || credits === null || credits <= 0))
    ) {
      throw new TranscriptImportError("invalidRow", rowNumber);
    }

    const subjectKey = subjectName.toLocaleLowerCase("vi");
    if (subjects.has(subjectKey)) {
      throw new TranscriptImportError("duplicateSubject", rowNumber);
    }
    subjects.add(subjectKey);

    return { stage, subjectName, credits, score };
  });
}

export { calculateTranscriptAverage } from "@/lib/transcript-average";
