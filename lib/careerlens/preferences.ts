import { readWorkspace, updateWorkspace } from "@/lib/browser-storage";
export type CareerPreferences = { preferredCareerModel: string; reuseLatestRoadmapData: boolean; roadmapDataResetAt: string | null };
export function getCareerPreferences(): CareerPreferences {
  const state = readWorkspace();
  return { ...state.preferences, preferredCareerModel: state.ai.model };
}
export function getPreferredCareerModel() {
  return readWorkspace().ai.model;
}

export function saveRoadmapDataPreference(reuseLatestRoadmapData: boolean) {
  updateWorkspace(state => { state.preferences.reuseLatestRoadmapData = reuseLatestRoadmapData; });
}
export function resetRoadmapPrefillData() {
  updateWorkspace(state => { state.preferences.roadmapDataResetAt = new Date().toISOString(); });
}
