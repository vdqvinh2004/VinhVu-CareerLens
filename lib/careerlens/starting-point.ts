import { readWorkspace } from "@/lib/browser-storage";
import { careerStartingPointSnapshotSchema, type CareerStartingPointSnapshot } from "./schemas";
export function getCareerStartingPointSnapshot(): CareerStartingPointSnapshot {
  const state = readWorkspace();
  return careerStartingPointSnapshotSchema.parse({
    personality: state.personality, education: state.education,
    certificates: state.certificates.map(({ attachment, ...row }) => ({ ...row, hasAttachment: Boolean(attachment) })),
    competitions: state.competitions, activities: state.activities, workExperiences: state.workExperiences,
  });
}
