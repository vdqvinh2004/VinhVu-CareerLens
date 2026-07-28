import { describe, expect, it } from "vitest";

import { validateCitedAnswer, WebResearchState } from "@/lib/ai/web";

function evidenceState() {
  const state = new WebResearchState();
  state.addEvidence("W1", "Vietnam technology employment grew by 12% in 2026.");
  state.addEvidence("W2", "The survey counted 450 employers in July 2026.");
  return state;
}

describe("cited answer validation", () => {
  it("maps existing evidence markers to safe numeric citations", () => {
    const result = validateCitedAnswer(
      "Vietnam technology employment grew by 12% in 2026 [[ E1 ]].",
      evidenceState(),
    );

    expect(result).toEqual({
      valid: true,
      text: "Vietnam technology employment grew by 12% in 2026 [1].",
      citations: [
        {
          sourceId: "W1",
          quote: "Vietnam technology employment grew by 12% in 2026.",
        },
      ],
      errors: [],
    });
  });

  it("fails closed when numeric or lexical support is missing", () => {
    const result = validateCitedAnswer(
      "Vietnam technology employment grew by 99% in 2026 [[E1]]. A rocket launched in 2026 [[E1]].",
      evidenceState(),
    );

    expect(result.valid).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(["numeric_mismatch", "lexical_mismatch"]),
    );
    expect(result.citations).toEqual([]);
  });

  it("rejects doubled claims when evidence only reports 12 percent growth", () => {
    const result = validateCitedAnswer(
      "Vietnam technology employment doubled after growing by 12% in 2026 [[E1]].",
      evidenceState(),
    );

    expect(result.valid).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "lexical_mismatch", evidenceId: "E1" }),
    );
  });

  it("requires English and Vietnamese superlatives and quantifiers in evidence", () => {
    const state = new WebResearchState();
    state.addEvidence("W1", "Technology employment grew by 12% in 2026.");
    state.addEvidence("W2", "Việc làm công nghệ tăng 12% trong năm 2026.");

    const english = validateCitedAnswer(
      "Technology employment had the highest growth of 12% in 2026 [[E1]].",
      state,
    );
    const vietnamese = validateCitedAnswer(
      "Đa số việc làm công nghệ tăng 12% trong năm 2026 [[E2]].",
      state,
    );

    expect(english.text).toBe("");
    expect(english.errors).toContainEqual(
      expect.objectContaining({ code: "lexical_mismatch", evidenceId: "E1" }),
    );
    expect(vietnamese.text).toBe("");
    expect(vietnamese.errors).toContainEqual(
      expect.objectContaining({ code: "lexical_mismatch", evidenceId: "E2" }),
    );
  });

  it.each([
    ["Employment fell by half in 2026 [[E1]].", "Employment fell in 2026."],
    ["Employment was the lowest in 2026 [[E1]].", "Employment was reported in 2026."],
    ["Việc làm giảm một nửa trong năm 2026 [[E1]].", "Việc làm giảm trong năm 2026."],
    ["Việc làm thấp nhất trong năm 2026 [[E1]].", "Việc làm được báo cáo trong năm 2026."],
  ])("rejects a critical term absent from evidence: %s", (claim, quote) => {
    const state = new WebResearchState();
    state.addEvidence("W1", quote);

    const result = validateCitedAnswer(claim, state);

    expect(result.text).toBe("");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "lexical_mismatch", evidenceId: "E1" }),
    );
  });

  it("requires meaningful lexical coverage rather than two incidental words", () => {
    const result = validateCitedAnswer(
      "Vietnam technology wages and remote opportunities expanded in 2026 [[E1]].",
      evidenceState(),
    );

    expect(result.text).toBe("");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "lexical_mismatch", evidenceId: "E1" }),
    );
  });

  it("accepts critical relation terms when the evidence contains them", () => {
    const state = new WebResearchState();
    state.addEvidence("W1", "Technology employment doubled and reached its highest level in 2026.");
    state.addEvidence("W2", "Đa số việc làm công nghệ tăng gấp đôi trong năm 2026.");

    expect(
      validateCitedAnswer(
        "Technology employment doubled to its highest level in 2026 [[E1]].",
        state,
      ).valid,
    ).toBe(true);
    expect(
      validateCitedAnswer(
        "Đa số việc làm công nghệ tăng gấp đôi trong năm 2026 [[E2]].",
        state,
      ).valid,
    ).toBe(true);
  });

  it("rejects unknown markers and uncited factual claims", () => {
    const result = validateCitedAnswer(
      "The survey counted 450 employers [[E99]]. Demand rose by 30% in 2025.",
      evidenceState(),
    );

    expect(result.valid).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors.map((error) => error.code)).toEqual([
      "unknown_evidence",
      "missing_citation",
    ]);
  });

  it("strips fake Markdown, autolink, and bare URLs", () => {
    const result = validateCitedAnswer(
      "See [fake source](javascript:alert), <https://evil.test/b>, https://evil.test/c, or www.evil.test/d for advice.",
      evidenceState(),
    );

    expect(result.valid).toBe(false);
    expect(result.text).not.toContain("http");
    expect(result.text).toBe("");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "free_form_link" }),
    );
  });

  it("removes uncited ordinary declarative facts but permits recommendations", () => {
    const result = validateCitedAnswer(
      "Vietnam has a large technology workforce. Consider comparing several employers.",
      evidenceState(),
    );

    expect(result.valid).toBe(false);
    expect(result.text).toBe("Consider comparing several employers.");
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "missing_citation" }),
    );
  });

  it.each([
    "You should apply to Example University because its deadline is 31 July 2026.",
    "Consider Example University; its deadline has passed.",
    "We recommend Example University, which offers several scholarships.",
  ])("does not exempt factual claims introduced as recommendations: %s", (answer) => {
    const result = validateCitedAnswer(answer, evidenceState());

    expect(result.valid).toBe(false);
    expect(result.text).toBe("");
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "missing_citation",
        claim: answer,
      }),
    );
  });

  it("rejects direction and negation contradictions", () => {
    const state = new WebResearchState();
    state.addEvidence("W1", "Technology employment fell by 12% in 2026.");
    state.addEvidence("W2", "Việc làm công nghệ không tăng trong năm 2026.");

    const direction = validateCitedAnswer(
      "Technology employment grew by 12% in 2026 [[E1]].",
      state,
    );
    const negation = validateCitedAnswer(
      "Việc làm công nghệ tăng trong năm 2026 [[E2]].",
      state,
    );

    expect(direction.text).toBe("");
    expect(direction.errors).toContainEqual(
      expect.objectContaining({ code: "polarity_mismatch" }),
    );
    expect(negation.text).toBe("");
    expect(negation.errors).toContainEqual(
      expect.objectContaining({ code: "polarity_mismatch" }),
    );
  });
});
