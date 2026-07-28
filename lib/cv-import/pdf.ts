import "server-only";

import { extractText, getDocumentProxy } from "unpdf";

export const CV_PDF_MAX_BYTES = 6 * 1024 * 1024;
export const CV_PDF_MAX_PAGES = 15;
export const CV_TEXT_MAX_CHARS = 50_000;

export type CvPdfErrorCode =
  | "required"
  | "tooLarge"
  | "invalidType"
  | "invalidContent"
  | "tooManyPages"
  | "noText"
  | "readFailed";

export class CvPdfError extends Error {
  constructor(public readonly code: CvPdfErrorCode) {
    super(code);
    this.name = "CvPdfError";
  }
}
function hasPdfSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-"
  );
}

export function validateCvPdfFile(file: File | null) {
  if (!file || file.size === 0) return "required" as const;
  if (file.size > CV_PDF_MAX_BYTES) return "tooLarge" as const;
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return "invalidType" as const;
  }
  return null;
}

export async function extractCvPdf(file: File) {
  const validationError = validateCvPdfFile(file);
  if (validationError) throw new CvPdfError(validationError);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasPdfSignature(bytes)) throw new CvPdfError("invalidContent");

    const pdf = await getDocumentProxy(bytes);
    try {
      if (pdf.numPages > CV_PDF_MAX_PAGES) {
        throw new CvPdfError("tooManyPages");
      }

      const result = await extractText(pdf, { mergePages: true });
      const rawText = Array.isArray(result.text)
        ? result.text.join("\n")
        : result.text;
      const text = rawText
        .replace(/\u0000/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (text.length < 80) throw new CvPdfError("noText");

      return {
        pageCount: pdf.numPages,
        text: text.slice(0, CV_TEXT_MAX_CHARS),
        wasTruncated: text.length > CV_TEXT_MAX_CHARS,
      };
    } finally {
      await pdf.destroy();
    }
  } catch (error) {
    if (error instanceof CvPdfError) throw error;
    throw new CvPdfError("readFailed");
  }
}
