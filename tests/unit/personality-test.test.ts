import { describe, expect, it } from "vitest";

import {
  personalityAnswersSchema,
  scorePersonalityTest,
} from "@/lib/personality-test";

describe("personality test scoring", () => {
  it("returns ESTJ when every answer favors the first trait", () => {
    const result = scorePersonalityTest(Array(12).fill("a"));

    expect(result.result).toBe("ESTJ");
    expect(result.scores).toEqual({
      E: 3,
      I: 0,
      S: 3,
      N: 0,
      T: 3,
      F: 0,
      J: 3,
      P: 0,
    });
  });

  it("returns INFP when every answer favors the second trait", () => {
    expect(scorePersonalityTest(Array(12).fill("b")).result).toBe("INFP");
  });

  it("rejects incomplete answer sets", () => {
    expect(personalityAnswersSchema.safeParse(["a", "b"]).success).toBe(false);
  });
});
