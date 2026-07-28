const DEFAULT_MAX_CONTENT_BYTES = 1_024 * 1_024;
const DEFAULT_MAX_METADATA_BYTES = 32 * 1_024;
const BLOCKED_PAGE_PATTERN =
  /\b(?:captcha|access denied|verify (?:that )?you(?:'re| are)? (?:a )?human|human verification|unusual traffic|log ?in to continue|sign ?in to continue)\b/i;
const LOGIN_PAGE_PATTERN = /^\s*(?:#{1,6}\s*)?(?:log ?in|sign ?in)\b/i;

export type ExtractedContent = {
  text: string;
  contentType?: string | null;
  metadata?: Readonly<Record<string, unknown>> | null;
};

export type ExtractedContentPolicyOptions = {
  maxContentBytes?: number;
  maxMetadataBytes?: number;
};

export class ExtractedContentPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractedContentPolicyError";
  }
}

function isTextLikeContentType(value: string) {
  const contentType = value.split(";", 1)[0].trim().toLowerCase();
  return (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "application/ld+json" ||
    contentType === "application/xml" ||
    contentType === "application/xhtml+xml" ||
    contentType.endsWith("+json") ||
    contentType.endsWith("+xml")
  );
}

export function validateExtractedContent<T extends ExtractedContent>(
  content: T,
  options: ExtractedContentPolicyOptions = {},
): T {
  const maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
  const maxMetadataBytes = options.maxMetadataBytes ?? DEFAULT_MAX_METADATA_BYTES;
  if (!Number.isSafeInteger(maxContentBytes) || maxContentBytes <= 0) {
    throw new ExtractedContentPolicyError(
      "maxContentBytes must be a positive safe integer",
    );
  }
  if (!Number.isSafeInteger(maxMetadataBytes) || maxMetadataBytes <= 0) {
    throw new ExtractedContentPolicyError(
      "maxMetadataBytes must be a positive safe integer",
    );
  }

  if (typeof content.text !== "string" || content.text.trim().length === 0) {
    throw new ExtractedContentPolicyError("Extracted content must contain non-empty text");
  }
  if (Buffer.byteLength(content.text, "utf8") > maxContentBytes) {
    throw new ExtractedContentPolicyError("Extracted content exceeds the allowed size");
  }
  if (BLOCKED_PAGE_PATTERN.test(content.text) || LOGIN_PAGE_PATTERN.test(content.text)) {
    throw new ExtractedContentPolicyError(
      "Extracted content is an access challenge or login page",
    );
  }

  const metadata = content.metadata;
  if (metadata) {
    let serializedMetadata: string;
    try {
      serializedMetadata = JSON.stringify(metadata);
    } catch {
      throw new ExtractedContentPolicyError(
        "Extracted content metadata must be JSON-serializable",
      );
    }
    if (Buffer.byteLength(serializedMetadata, "utf8") > maxMetadataBytes) {
      throw new ExtractedContentPolicyError(
        "Extracted content metadata exceeds the allowed size",
      );
    }
  }
  const candidates = [
    content.contentType,
    metadata?.contentType,
    metadata?.mimeType,
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

  if (candidates.length === 0 || candidates.some((value) => !isTextLikeContentType(value))) {
    throw new ExtractedContentPolicyError(
      "Extracted content must have an allowed text-like content type",
    );
  }

  return content;
}
