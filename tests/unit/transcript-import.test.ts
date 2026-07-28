import { describe, expect, it } from "vitest";

import { calculateTranscriptAverage } from "@/lib/transcript-import";

describe("transcript calculations", () => {
  it("calculates the arithmetic average for high school subjects", () => {
    expect(
      calculateTranscriptAverage([
        { credits: null, score: 8.2 },
        { credits: null, score: 7.5 },
        { credits: null, score: 9.1 },
      ]),
    ).toBe(8.27);
  });

  it("calculates the credit-weighted cumulative average", () => {
    expect(
      calculateTranscriptAverage([
        { credits: 3, score: 3.5 },
        { credits: 2, score: 4 },
        { credits: 1, score: 2.5 },
      ]),
    ).toBe(3.5);
  });

  it("returns null when there are no transcript rows", () => {
    expect(calculateTranscriptAverage([])).toBeNull();
  });
});
