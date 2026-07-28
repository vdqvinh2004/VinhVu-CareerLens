import type { CareerStartingPointSnapshot } from "./schemas";

export function hasCareerStartingPointData(
  snapshot: CareerStartingPointSnapshot,
) {
  return Boolean(
    snapshot.personality ||
      snapshot.education.length ||
      snapshot.certificates.length ||
      snapshot.competitions.length ||
      snapshot.activities.length ||
      snapshot.workExperiences.length,
  );
}
