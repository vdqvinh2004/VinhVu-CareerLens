import type { CareerLensStoredFormValues } from "./form";

type RoadmapPrefillCandidate = {
  createdAt: string;
  formValues: CareerLensStoredFormValues;
};

export function getRoadmapPrefillDefaults({
  enabled,
  latestRoadmap,
  resetAt,
}: {
  enabled: boolean;
  latestRoadmap: RoadmapPrefillCandidate | null;
  resetAt: string | null;
}): CareerLensStoredFormValues | null {
  if (!enabled || !latestRoadmap) return null;
  if (!resetAt) return latestRoadmap.formValues;

  return new Date(latestRoadmap.createdAt).getTime() >
    new Date(resetAt).getTime()
    ? latestRoadmap.formValues
    : null;
}
