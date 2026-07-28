import type { AgentCitation } from "../agent/types";
import { WebResearchState, type WebEvidence } from "./research-state";

export type CitationRepairErrorCode =
  | "free_form_link"
  | "unknown_evidence"
  | "missing_citation"
  | "lexical_mismatch"
  | "numeric_mismatch"
  | "polarity_mismatch";

export type CitationRepairError = {
  code: CitationRepairErrorCode;
  message: string;
  claim?: string;
  evidenceId?: string;
};

export type CitedAnswerValidation = {
  valid: boolean;
  text: string;
  citations: AgentCitation[];
  errors: CitationRepairError[];
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "been",
  "being",
  "but",
  "can",
  "for",
  "from",
  "has",
  "have",
  "into",
  "its",
  "that",
  "the",
  "their",
  "than",
  "then",
  "this",
  "was",
  "were",
  "will",
  "with",
  "các",
  "cho",
  "có",
  "của",
  "đã",
  "đang",
  "đó",
  "được",
  "hoặc",
  "khi",
  "là",
  "một",
  "như",
  "nhưng",
  "những",
  "này",
  "sẽ",
  "tại",
  "theo",
  "trên",
  "trong",
  "từ",
  "và",
  "về",
  "với",
]);

const MARKER_PATTERN = /\[\[([^\]]+)\]\]/g;
const VALID_EVIDENCE_ID = /^E[1-9]\d*$/;
const NUMBER_OR_DATE_PATTERN = /\b\d[\d.,]*(?:[/-]\d[\d.,]*)*%?\b/g;
const POSITIVE_POLARITY_PATTERN =
  /\b(?:grew|grown|grow|increased?|increasing|rose|risen|rising|gained?|tăng|tăng trưởng)\b/i;
const NEGATIVE_POLARITY_PATTERN =
  /\b(?:fell|fallen|falling|decreased?|decreasing|declined?|declining|dropped?|giảm|sụt giảm)\b/i;
const NEGATION_PATTERN = /\b(?:not|no|never|without|không|chưa|chẳng)\b/i;
const CRITICAL_TERM_GROUPS = [
  /\b(?:double|doubled|twice)\b|gấp đôi/iu,
  /\b(?:half|halved)\b|một nửa|phân nửa/iu,
  /\b(?:highest|largest|greatest|maximum)\b|cao nhất|lớn nhất|nhiều nhất/iu,
  /\b(?:lowest|smallest|least|minimum)\b|thấp nhất|nhỏ nhất|ít nhất/iu,
  /\b(?:majority|most)\b|đa số|phần lớn|hơn một nửa/iu,
  /\b(?:more than|greater than|over)\b|nhiều hơn|lớn hơn/iu,
  /\b(?:less than|fewer than|under)\b|ít hơn|thấp hơn|dưới/iu,
  /\b(?:at least|no fewer than)\b|tối thiểu|ít nhất/iu,
  /\b(?:at most|no more than)\b|tối đa|nhiều nhất/iu,
] as const;

function stripFreeFormLinks(text: string): { text: string; found: boolean } {
  let found = false;
  let sanitized = text.replace(/\[([^\]]*)\]\([^\n)]*\)/g, (_match, label: string) => {
    found = true;
    return label;
  });
  sanitized = sanitized.replace(/<https?:\/\/[^>]+>/gi, () => {
    found = true;
    return "";
  });
  sanitized = sanitized.replace(/https?:\/\/[^\s)\]}>,]+/gi, () => {
    found = true;
    return "";
  });
  sanitized = sanitized.replace(/\bwww\.[^\s)\]}>,]+/gi, () => {
    found = true;
    return "";
  });
  return { text: sanitized, found };
}

function lexicalTokens(text: string): Set<string> {
  const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(
    tokens.filter(
      (token) => token.length >= 3 && !/^\d+$/.test(token) && !STOP_WORDS.has(token),
    ),
  );
}

function hasLexicalSupport(claim: string, evidence: WebEvidence): boolean {
  const claimTokens = lexicalTokens(claim.replace(MARKER_PATTERN, ""));
  const evidenceTokens = lexicalTokens(evidence.quote);
  if (claimTokens.size === 0) return false;
  let overlap = 0;
  for (const token of claimTokens) {
    if (evidenceTokens.has(token)) overlap += 1;
  }
  const requiredOverlap = Math.min(
    claimTokens.size,
    Math.max(2, Math.ceil(claimTokens.size / 2)),
  );
  return overlap >= requiredOverlap;
}

function hasCriticalTermSupport(claim: string, evidence: WebEvidence): boolean {
  return CRITICAL_TERM_GROUPS.every(
    (pattern) => !pattern.test(claim) || pattern.test(evidence.quote),
  );
}

function normalizedNumericTokens(text: string): string[] {
  return (text.match(NUMBER_OR_DATE_PATTERN) ?? []).map((token) =>
    token.toLocaleLowerCase(),
  );
}

function hasExactNumericSupport(claim: string, evidence: WebEvidence): boolean {
  const claimNumbers = normalizedNumericTokens(claim);
  if (claimNumbers.length === 0) return true;
  const evidenceNumbers = new Set(normalizedNumericTokens(evidence.quote));
  return claimNumbers.every((number) => evidenceNumbers.has(number));
}

function hasCompatiblePolarity(claim: string, evidence: WebEvidence): boolean {
  const claimPositive = POSITIVE_POLARITY_PATTERN.test(claim);
  const claimNegative = NEGATIVE_POLARITY_PATTERN.test(claim);
  const evidencePositive = POSITIVE_POLARITY_PATTERN.test(evidence.quote);
  const evidenceNegative = NEGATIVE_POLARITY_PATTERN.test(evidence.quote);
  if ((claimPositive && evidenceNegative) || (claimNegative && evidencePositive)) {
    return false;
  }
  const claimNegated = NEGATION_PATTERN.test(claim);
  const evidenceNegated = NEGATION_PATTERN.test(evidence.quote);
  return claimNegated === evidenceNegated;
}

function isCitationExempt(segment: string): boolean {
  const text = segment.trim();
  if (!/[\p{L}\p{N}]/u.test(text)) return true;
  if (/^#{1,6}\s+.+$/.test(text) || /^.{1,80}:$/.test(text)) return true;
  if (/^(?:recommendation|recommendations|next steps?|summary|sources?)\s*:?$/i.test(text)) {
    return true;
  }
  const guidance = text.match(
    /^(?:(?:[-*]|\d+[.)])\s*)?(?:consider|try|use|avoid|choose|prefer|review|compare|consult|you should|we recommend|i recommend|nên|hãy|cân nhắc|khuyến nghị)\b/i,
  );
  if (!guidance) return false;
  const remainder = text.slice(guidance[0].length);
  return !(
    /\d|[;:]/u.test(remainder) ||
    /\b(?:is|are|was|were|has|have|had|offers?|requires?|costs?|deadline|ranked?|located|accepts?|provides?)\b/iu.test(
      remainder,
    ) ||
    /\b(?:because|since|given that|due to|which|whose|where|when|bởi vì|vì|do|mà)\b/iu.test(
      remainder,
    ) ||
    /\p{Lu}[\p{Ll}\p{M}'’-]+(?:[ \t]+\p{Lu}[\p{Ll}\p{M}'’-]+)+/u.test(remainder)
  );
}

function answerSegments(text: string): string[] {
  return text.match(/[^.!?\n]+(?:[.!?]+|(?=\n)|$)|\n+/g) ?? [text];
}

function cleanResult(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateCitedAnswer(
  answer: string,
  state: WebResearchState,
): CitedAnswerValidation {
  const errors: CitationRepairError[] = [];
  const stripped = stripFreeFormLinks(answer);
  if (stripped.found) {
    errors.push({
      code: "free_form_link",
      message: "Free-form links are not allowed; cite registered evidence markers instead.",
    });
  }

  const citations: AgentCitation[] = [];
  const citationNumbers = new Map<string, number>();
  const kept: string[] = [];

  for (const segment of answerSegments(stripped.text)) {
    if (/^\s*$/.test(segment)) {
      kept.push(segment);
      continue;
    }
    const markers = [...segment.matchAll(MARKER_PATTERN)];
    if (markers.length === 0) {
      if (!isCitationExempt(segment)) {
        errors.push({
          code: "missing_citation",
          message: "A factual claim is missing a read-evidence citation.",
          claim: segment.trim(),
        });
      } else {
        kept.push(segment);
      }
      continue;
    }

    const resolved: Array<{ id: string; evidence: WebEvidence }> = [];
    let supported = true;
    for (const marker of markers) {
      const evidenceId = marker[1].trim();
      const evidence = VALID_EVIDENCE_ID.test(evidenceId)
        ? state.getEvidence(evidenceId)
        : undefined;
      if (!evidence) {
        errors.push({
          code: "unknown_evidence",
          message: `Evidence marker [[${evidenceId}]] does not resolve to read evidence.`,
          claim: segment.trim(),
          evidenceId,
        });
        supported = false;
        continue;
      }
      if (!hasLexicalSupport(segment, evidence)) {
        errors.push({
          code: "lexical_mismatch",
          message: `Evidence ${evidenceId} does not lexically support the claim.`,
          claim: segment.trim(),
          evidenceId,
        });
        supported = false;
      }
      if (!hasCriticalTermSupport(segment, evidence)) {
        errors.push({
          code: "lexical_mismatch",
          message: `Evidence ${evidenceId} does not contain the claim's critical relation or quantifier terms.`,
          claim: segment.trim(),
          evidenceId,
        });
        supported = false;
      }
      if (!hasExactNumericSupport(segment, evidence)) {
        errors.push({
          code: "numeric_mismatch",
          message: `Evidence ${evidenceId} does not contain every numeric/date token in the claim.`,
          claim: segment.trim(),
          evidenceId,
        });
        supported = false;
      }
      if (!hasCompatiblePolarity(segment, evidence)) {
        errors.push({
          code: "polarity_mismatch",
          message: `Evidence ${evidenceId} contradicts the claim's direction or negation.`,
          claim: segment.trim(),
          evidenceId,
        });
        supported = false;
      }
      resolved.push({ id: evidenceId, evidence });
    }
    if (!supported) continue;

    let safeSegment = segment;
    for (const { id, evidence } of resolved) {
      let citationNumber = citationNumbers.get(id);
      if (citationNumber === undefined) {
        citations.push({ sourceId: evidence.sourceId, quote: evidence.quote });
        citationNumber = citations.length;
        citationNumbers.set(id, citationNumber);
      }
    }
    safeSegment = safeSegment.replace(MARKER_PATTERN, (_marker, rawId: string) => {
      const citationNumber = citationNumbers.get(rawId.trim());
      return citationNumber === undefined ? "" : `[${citationNumber}]`;
    });
    kept.push(safeSegment);
  }

  return {
    valid: errors.length === 0,
    text: cleanResult(kept.join("")),
    citations,
    errors,
  };
}
