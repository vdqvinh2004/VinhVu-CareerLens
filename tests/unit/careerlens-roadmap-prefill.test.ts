import { describe, expect, it } from "vitest";

import type { CareerLensStoredFormValues } from "@/lib/careerlens/form";
import { getRoadmapPrefillDefaults } from "@/lib/careerlens/roadmap-prefill";

const formValues: CareerLensStoredFormValues = {
  activity: "Dự án câu lạc bộ",
  currentRegion: "Thành phố Hà Nội",
  educationLevel: "university",
  familyConstraints: "",
  interests: "Công nghệ",
  intent: "roadmap_detail",
  languages: "Tiếng Việt",
  learningStyle: "project_based",
  question: "",
  strongSubject: "Toán",
  subjectScore: 9,
  targetBudget: "",
  targetRegion: "Thành phố Hà Nội",
  weeklyHours: 12,
  workEnvironment: "team_based",
};

const latestRoadmap = {
  createdAt: "2026-07-19T08:00:00.000Z",
  formValues,
};

describe("roadmap prefill defaults", () => {
  it("reuses every stored value when the preference is enabled", () => {
    expect(
      getRoadmapPrefillDefaults({
        enabled: true,
        latestRoadmap,
        resetAt: null,
      }),
    ).toBe(formValues);
  });

  it("starts blank when reuse is disabled", () => {
    expect(
      getRoadmapPrefillDefaults({
        enabled: false,
        latestRoadmap,
        resetAt: null,
      }),
    ).toBeNull();
  });

  it("does not reuse a roadmap created before the refresh marker", () => {
    expect(
      getRoadmapPrefillDefaults({
        enabled: true,
        latestRoadmap,
        resetAt: "2026-07-19T09:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("can reuse a new roadmap created after the refresh marker", () => {
    expect(
      getRoadmapPrefillDefaults({
        enabled: true,
        latestRoadmap,
        resetAt: "2026-07-19T07:00:00.000Z",
      }),
    ).toBe(formValues);
  });
});
