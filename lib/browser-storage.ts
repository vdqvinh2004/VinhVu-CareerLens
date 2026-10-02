"use client";

import { useSyncExternalStore } from "react";
import type { EducationRecordDto, CertificateDto, CompetitionDto, ActivityDto, WorkExperienceDto } from "./profile-records";
import type { TranscriptEntryInput } from "./transcript-import";
import type { CareerStartingPointSnapshot } from "./careerlens/schemas";
import type { SavedCareerRoadmap } from "./careerlens/roadmaps";
import type { CareerPreferences } from "./careerlens/preferences";
import type { JourneyEntryView } from "./journey";

export const STORAGE_KEY = "careerlens.workspace.v1";
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; model: string };
export type ChatSession = { id: string; title: string; model: string; messages: ChatMessage[]; createdAt: string; updatedAt: string };
export type AISettings = { apiKey: string; baseUrl: string; model: string };
export type LocalEducation = Omit<EducationRecordDto, "transcriptSummaries"> & { transcriptEntries: TranscriptEntryInput[] };
export type LocalCertificate = CertificateDto & { dataUrl?: string };
export type Workspace = {
  version: 1;
  profile: { fullName: string; email: string; birthDate: string };
  ai: AISettings;
  preferences: CareerPreferences;
  personality: CareerStartingPointSnapshot["personality"];
  education: LocalEducation[];
  certificates: LocalCertificate[];
  competitions: CompetitionDto[];
  activities: ActivityDto[];
  workExperiences: WorkExperienceDto[];
  roadmaps: SavedCareerRoadmap[];
  journey: JourneyEntryView[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  journeyMessages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
};
function emptyWorkspace(): Workspace {
  return {
    version: 1, profile: { fullName: "Learner", email: "", birthDate: "2000-01-01" },
    ai: { apiKey: "", baseUrl: "https://mkp-api.fptcloud.com/v1", model: "Qwen3.6-27B" },
    preferences: { preferredCareerModel: "Qwen3.6-27B", reuseLatestRoadmapData: true, roadmapDataResetAt: null },
    personality: null, education: [], certificates: [], competitions: [], activities: [], workExperiences: [],
    roadmaps: [], journey: [], sessions: [], activeSessionId: null, journeyMessages: [],
  };
}
let snapshot = emptyWorkspace();
let loaded = false;
const listeners = new Set<() => void>();
export function readWorkspace(): Workspace {
  if (typeof window === "undefined") return snapshot;
  if (!loaded) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) snapshot = emptyWorkspace();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !parsed.profile || !parsed.ai || !parsed.preferences ||
            !["education", "certificates", "competitions", "activities", "workExperiences", "roadmaps", "journey", "sessions"].every(key => Array.isArray(parsed[key]))) {
          throw new Error("Invalid workspace");
        }
        snapshot = { ...emptyWorkspace(), ...parsed };
      } catch {
        throw new Error("Saved browser data could not be read. Export it before clearing browser storage.");
      }
    }
    loaded = true;
  }
  return snapshot;
}
export function updateWorkspace(change: (draft: Workspace) => void) {
  const next = structuredClone(readWorkspace());
  change(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("Browser storage is full or unavailable. Export a backup and remove large attachments before saving again.");
  }
  snapshot = next;
  listeners.forEach(listener => listener());
}
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) {
    loaded = false;
    listeners.forEach(listener => listener());
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}
export function useWorkspace() {
  return useSyncExternalStore(subscribe, readWorkspace, () => snapshot);
}
export function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read attachment."));
    reader.readAsDataURL(file);
  });
}
export function downloadFile(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
