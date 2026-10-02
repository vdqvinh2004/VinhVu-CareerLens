import { readWorkspace, updateWorkspace } from "@/lib/browser-storage";
import { careerLensStoredFormSchema, type CareerLensStoredFormValues } from "./form";
import { careerGuidanceInputSchema, careerGuidanceOutputSchema, type CareerGuidanceInput, type CareerGuidanceOutput } from "./schemas";
export type SavedCareerRoadmap = {
  id: string;
  title: string;
  formValues: CareerLensStoredFormValues;
  guidanceInput: CareerGuidanceInput;
  guidanceOutput: CareerGuidanceOutput;
  selectedRecommendationIndex: number;
  isFollowing: boolean;
  followProgress: string[];
  followedAt: string | null;
  stoppedFollowingAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareerRoadmapSummary = Pick<
  SavedCareerRoadmap,
  "id" | "title" | "updatedAt"
>;

export type FollowedCareerRoadmapSummary = Pick<
  SavedCareerRoadmap,
  "id" | "title" | "followedAt" | "stoppedFollowingAt" | "isFollowing"
>;


export function getLatestCareerRoadmap(): SavedCareerRoadmap | null {
  return [...readWorkspace().roadmaps].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
export function getLatestCreatedCareerRoadmap(): SavedCareerRoadmap | null {
  return [...readWorkspace().roadmaps].sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}
export function getCareerRoadmap(roadmapId: string) { return readWorkspace().roadmaps.find(row => row.id === roadmapId) ?? null; }
export function getCareerRoadmapSummaries(): CareerRoadmapSummary[] {
  return [...readWorkspace().roadmaps].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(({id,title,updatedAt}) => ({id,title,updatedAt}));
}
export function getFollowedCareerRoadmap() {
  return readWorkspace().roadmaps.find(row => row.isFollowing) ?? null;
}
export function getFollowedCareerRoadmapHistory(): FollowedCareerRoadmapSummary[] {
  return readWorkspace().roadmaps.filter(row => row.followedAt).map(({id,title,followedAt,stoppedFollowingAt,isFollowing}) => ({id,title,followedAt,stoppedFollowingAt,isFollowing}));
}
export function saveCareerRoadmap(input: { roadmapId?: string; formValues: CareerLensStoredFormValues; guidanceInput: CareerGuidanceInput; guidanceOutput: CareerGuidanceOutput }) {
  const formValues = careerLensStoredFormSchema.parse(input.formValues);
  const guidanceInput = careerGuidanceInputSchema.parse(input.guidanceInput);
  const guidanceOutput = careerGuidanceOutputSchema.parse(input.guidanceOutput);
  const id = input.roadmapId ?? crypto.randomUUID();
  const now = new Date().toISOString();
  updateWorkspace(state => {
    const previous = state.roadmaps.find(row => row.id === id);
    const row: SavedCareerRoadmap = {
      id, title: guidanceOutput.recommendations[0]?.path_title ?? "Career roadmap", formValues, guidanceInput, guidanceOutput,
      selectedRecommendationIndex: 0, isFollowing: previous?.isFollowing ?? false,
      followProgress: [], followedAt: previous?.followedAt ?? null, stoppedFollowingAt: previous?.stoppedFollowingAt ?? null,
      createdAt: previous?.createdAt ?? now, updatedAt: now,
    };
    state.roadmaps = [row, ...state.roadmaps.filter(row => row.id !== id)];
  });
  return id;
}
export function selectCareerRoadmapRecommendation(input: { roadmapId: string; recommendationIndex: number }) {
  const row = getCareerRoadmap(input.roadmapId);
  const selected = row?.guidanceOutput.recommendations[input.recommendationIndex];
  if (!row || !selected) return false;
  updateWorkspace(state => {
    const target = state.roadmaps.find(row => row.id === input.roadmapId)!;
    target.selectedRecommendationIndex = input.recommendationIndex; target.title = selected.path_title;
    target.followProgress = []; target.updatedAt = new Date().toISOString();
  });
  return true;
}
export function followCareerRoadmap(input: { roadmapId: string }) {
  const target = getCareerRoadmap(input.roadmapId);
  if (!target) return false;
  if (target.isFollowing) return true;
  const now = new Date().toISOString();
  updateWorkspace(state => { state.roadmaps.forEach(row => {
    if (row.isFollowing) { row.isFollowing = false; row.stoppedFollowingAt = now; }
    if (row.id === input.roadmapId) { row.isFollowing = true; row.followedAt = now; row.stoppedFollowingAt = null; }
  }); });
  return true;
}
export function stopFollowingCareerRoadmap() {
  updateWorkspace(state => { state.roadmaps.forEach(row => {
    if (row.isFollowing) { row.isFollowing = false; row.stoppedFollowingAt = new Date().toISOString(); }
  }); });
}
export function setCareerRoadmapTaskDone(input: { roadmapId: string; taskId: string; done: boolean }) {
  updateWorkspace(state => {
    const row = state.roadmaps.find(row => row.id === input.roadmapId && row.isFollowing);
    if (!row) return;
    row.followProgress = input.done ? [...new Set([...row.followProgress, input.taskId])] : row.followProgress.filter(id => id !== input.taskId);
    row.updatedAt = new Date().toISOString();
  });
}
