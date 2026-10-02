import { afterEach, describe, expect, it, vi } from "vitest";

import { getInterestSuggestions } from "@/lib/careerlens/interest-suggestions";
import { getVietnamProvinceNames, VIETNAM_PROVINCES } from "@/lib/careerlens/vietnam-provinces";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VinhVu CareerLen profile helpers", () => {
  it("provides subject-specific interest suggestions", () => {
    expect(getInterestSuggestions("Toán và lập trình")).toEqual(
      expect.arrayContaining(["Phân tích dữ liệu", "Phát triển phần mềm", "AI và học máy"]),
    );
  });

  it("localizes suggestions for English input", () => {
    expect(getInterestSuggestions("Math and programming", "en")).toEqual(
      expect.arrayContaining(["Data analysis", "Software development", "AI and machine learning"]),
    );
  });

  it("keeps the official province list complete and unique", () => {
    expect(VIETNAM_PROVINCES).toHaveLength(34);
    expect(new Set(VIETNAM_PROVINCES)).toHaveLength(34);
    expect(VIETNAM_PROVINCES).toContain("Thành phố Hồ Chí Minh");
    expect(VIETNAM_PROVINCES).toContain("Tỉnh Cà Mau");
  });

  it("uses bundled provinces without network access", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(getVietnamProvinceNames()).toEqual([...VIETNAM_PROVINCES]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
