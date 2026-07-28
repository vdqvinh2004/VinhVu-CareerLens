import { describe, expect, it } from "vitest";

import {
  CAREERLENS_MARKET_SEED,
  MARKET_INDUSTRY_COUNT,
  MARKET_ROLE_COUNT_PER_REGION,
  selectCareerLensMarketSignals,
} from "@/lib/careerlens/market-seed";
import { laborMarketSignalsSchema } from "@/lib/careerlens/schemas";
import { VIETNAM_PROVINCES } from "@/lib/careerlens/vietnam-provinces";

describe("CareerLens market seed", () => {
  it("contains 200 distinct careers across 20 industries for every province", () => {
    expect(MARKET_ROLE_COUNT_PER_REGION).toBe(200);
    expect(MARKET_INDUSTRY_COUNT).toBe(20);
    expect(CAREERLENS_MARKET_SEED.postings).toHaveLength(34 * 200);
    expect(new Set(CAREERLENS_MARKET_SEED.postings.map((posting) => posting.job_id))).toHaveLength(
      34 * 200,
    );

    for (const region of VIETNAM_PROVINCES) {
      const postings = CAREERLENS_MARKET_SEED.postings.filter(
        (posting) => posting.region === region,
      );
      expect(postings).toHaveLength(200);
      expect(new Set(postings.map((posting) => posting.job_title))).toHaveLength(200);
      expect(new Set(postings.map((posting) => posting.industry))).toHaveLength(20);
    }
  });

  it("selects a compact, relevant and schema-valid sample for the LLM", () => {
    const selected = selectCareerLensMarketSignals({
      currentRegion: "Thành phố Hồ Chí Minh",
      targetRegions: ["Thành phố Hà Nội"],
      keywords: ["Toán", "SQL", "Data Analyst"],
    });

    expect(selected.postings).toHaveLength(40);
    expect(selected.postings[0].job_title).toBe("Data Analyst");
    expect(new Set(selected.postings.map((posting) => posting.region))).toEqual(
      new Set(["Thành phố Hà Nội", "Thành phố Hồ Chí Minh"]),
    );
    expect(selected.trend_summary).toHaveLength(10);
    expect(laborMarketSignalsSchema.safeParse(selected).success).toBe(true);
  });
});
