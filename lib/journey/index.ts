import { readWorkspace, updateWorkspace } from "@/lib/browser-storage";
import { getCareerRoadmap } from "@/lib/careerlens/roadmaps";
import type { CareerRecommendation } from "@/lib/careerlens/schemas";
export type JourneyEntrySource = "manual" | "roadmap" | "ai";
export type JourneyEntryCategory =
  | "learning"
  | "experience"
  | "career"
  | "personal";

export type JourneyEntryView = {
  id: string;
  source: JourneyEntrySource;
  category: JourneyEntryCategory;
  title: string;
  description: string;
  targetDate: string;
  completed: boolean;
  completedAt: string | null;
  sourceLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

type JourneyEntryDraft = Omit<JourneyEntryView, "id" | "createdAt" | "updatedAt">;
function addMonths(base: Date, months: number) {
  const result = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 10),
  );
  return result.toISOString().slice(0, 10);
}

function roadmapDrafts(
  recommendation: CareerRecommendation,
  now = new Date(),
): JourneyEntryDraft[] {
  const [learning, internship, fullTime] = recommendation.roadmap;
  const drafts: JourneyEntryDraft[] = [];

  const pushStageItems = ({
    category,
    description,
    items,
    offset,
    sourceLabel,
  }: {
    category: JourneyEntryCategory;
    description: string;
    items: string[];
    offset: number;
    sourceLabel: string;
  }) => {
    items.forEach((title, index) => {
      drafts.push({
        category,
        completed: false,
        completedAt: null,
        description,
        source: "roadmap",
        sourceLabel,
        targetDate: addMonths(now, offset + Math.floor(index / 2)),
        title,
      });
    });
  };

  pushStageItems({
    category: "learning",
    description: `${learning.stage_name}. ${learning.major_or_track}`,
    items: [
      ...learning.subjects
        .slice(0, 2)
        .map(
          (subject) =>
            `${subject.subject_name}: ${subject.evidence_of_completion}`,
        ),
      ...learning.certificates
        .slice(0, 2)
        .map((certificate) => `Hoàn thành ${certificate.certificate_name}`),
      ...learning.milestones.slice(0, 2),
    ],
    offset: 0,
    sourceLabel: learning.stage_name,
  });

  pushStageItems({
    category: "experience",
    description: `${internship.stage_name}. Mục tiêu trong ${internship.time_limit}.`,
    items: [
      ...internship.cv_preparation.slice(0, 2),
      ...internship.interview_preparation.slice(0, 2),
      ...internship.success_metrics.slice(0, 2),
    ],
    offset: 6,
    sourceLabel: internship.stage_name,
  });

  pushStageItems({
    category: "career",
    description: `${fullTime.stage_name}. Mục tiêu trong ${fullTime.time_limit}.`,
    items: [
      ...fullTime.first_90_days.slice(0, 2),
      ...fullTime.target_roles
        .slice(0, 1)
        .map((role) => `${role.role_name}: ${role.readiness_signal}`),
      ...fullTime.promotion_path
        .slice(0, 1)
        .map((step) => `Chuẩn bị cho vai trò ${step.target_position}`),
    ],
    offset: 12,
    sourceLabel: fullTime.stage_name,
  });

  return drafts;
}


export function getJourneyEntries(): JourneyEntryView[] {
  return [...readWorkspace().journey].sort((a,b) => a.targetDate.localeCompare(b.targetDate));
}
export async function appendRoadmapToJourney({ roadmapId }: { roadmapId: string }) {
  const roadmap = getCareerRoadmap(roadmapId);
  if (!roadmap) return null;
  const recommendation = roadmap.guidanceOutput.recommendations[roadmap.selectedRecommendationIndex];
  if (!recommendation) return null;
  const now = new Date().toISOString();
  const entries = roadmapDrafts(recommendation).map(draft => ({ ...draft, id: crypto.randomUUID(), createdAt: now, updatedAt: now }));
  updateWorkspace(state => { state.journey.push(...entries); });
  return { directionTitle: recommendation.path_title, entries };
}
export function createJourneyEntry(input: { category: JourneyEntryCategory; description: string; source?: JourneyEntrySource; targetDate: string; title: string }) {
  const now = new Date().toISOString();
  const fields = input;
  const entry: JourneyEntryView = { ...fields, id: crypto.randomUUID(), source: input.source ?? "manual", sourceLabel: null, completed: false, completedAt: null, createdAt: now, updatedAt: now };
  updateWorkspace(state => { state.journey.push(entry); });
  return entry;
}
export function updateJourneyEntry(input: { category?: JourneyEntryCategory; completed?: boolean; description?: string; entryId: string; targetDate?: string; title?: string }) {
  let updated: JourneyEntryView | null = null;
  updateWorkspace(state => {
    const entry = state.journey.find(row => row.id === input.entryId);
    if (!entry) return;
    const { entryId: _id, ...fields } = input;
    void _id;
    Object.assign(entry, Object.fromEntries(Object.entries(fields).filter(([,value]) => value !== undefined)));
    entry.updatedAt = new Date().toISOString();
    if (input.completed !== undefined) entry.completedAt = input.completed ? entry.updatedAt : null;
    updated = entry;
  });
  return updated as JourneyEntryView | null;
}
export function deleteJourneyEntry({ entryId }: { entryId: string }) {
  updateWorkspace(state => { state.journey = state.journey.filter(row => row.id !== entryId); });
  return entryId;
}
