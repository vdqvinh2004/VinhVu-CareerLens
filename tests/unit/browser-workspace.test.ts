import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function browser() {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: vi.fn((key: string, value: string) => { data.set(key, value); }) };
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", storage);
  const storageModule = await import("@/lib/browser-storage");
  return { ...storageModule, data, storage };
}

describe("browser workspace", () => {
  it("restores saved data and keeps existing state when storage is full", async () => {
    const browserState = await browser();
    browserState.updateWorkspace(state => { state.profile.fullName = "Saved learner"; state.ai.apiKey = "personal-key"; });
    vi.resetModules();
    const reloaded = await import("@/lib/browser-storage");
    expect(reloaded.readWorkspace().profile.fullName).toBe("Saved learner");
    expect(reloaded.readWorkspace().ai.apiKey).toBe("personal-key");
    const saved = browserState.data.get(browserState.STORAGE_KEY);
    browserState.storage.setItem.mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(() => reloaded.updateWorkspace(state => { state.profile.fullName = "Unsaved"; })).toThrow("storage is full");
    expect(reloaded.readWorkspace().profile.fullName).toBe("Saved learner");
    expect(browserState.data.get(browserState.STORAGE_KEY)).toBe(saved);
  });

  it("preserves unreadable saved data instead of replacing it", async () => {
    const state = await browser();
    state.data.set(state.STORAGE_KEY, "broken JSON");
    expect(() => state.readWorkspace()).toThrow("could not be read");
    expect(state.data.get(state.STORAGE_KEY)).toBe("broken JSON");
    expect(state.storage.setItem).not.toHaveBeenCalled();
  });

  it("uses browser key, URL, and model directly; rejects missing keys and unsafe URLs", async () => {
    const state = await browser();
    const { completeChat } = await import("@/lib/ai/generate");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Career advice" } }] })));
    vi.stubGlobal("fetch", fetch);
    await expect(completeChat([{ role: "user", content: "Help" }])).rejects.toThrow("API key");
    expect(fetch).not.toHaveBeenCalled();
    state.updateWorkspace(draft => { draft.ai = { apiKey: "user-key", baseUrl: "https://provider.example/v1", model: "custom-model" }; });
    await expect(completeChat([{ role: "user", content: "Help" }])).resolves.toBe("Career advice");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://provider.example/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer user-key");
    expect(JSON.parse(options.body)).toEqual({ model: "custom-model", messages: [{ role: "user", content: "Help" }] });
    expect(options.redirect).toBe("error");
    const { validateAISettings } = await import("@/lib/ai/client");
    expect(() => validateAISettings({ apiKey: "key", baseUrl: "http://external.example", model: "model" })).toThrow("HTTPS");
    expect(() => validateAISettings({ apiKey: "key", baseUrl: "https://user:pass@external.example", model: "model" })).toThrow("credentials");
    expect(validateAISettings({ apiKey: "key", baseUrl: "http://localhost:1234/v1", model: "model" }).baseUrl).toBe("http://localhost:1234/v1");
  });

  it("imports CV records once, feeds profile snapshot, and persists journey edits", async () => {
    const state = await browser();
    const { persistCvImport } = await import("@/lib/cv-import/persistence");
    const data = {
      education: [], competitions: [], activities: [], workExperiences: [],
      certificates: [{ name: "SQL", issuedYear: 2025, startMonth: 1, startYear: 2025, endMonth: 3, endYear: 2025 }],
    };
    expect((await persistCvImport(data)).imported.certificates).toBe(1);
    expect((await persistCvImport(data)).skippedDuplicates).toBe(1);
    const { getCareerStartingPointSnapshot } = await import("@/lib/careerlens/starting-point");
    expect(getCareerStartingPointSnapshot().certificates).toHaveLength(1);
    const { createJourneyEntry, updateJourneyEntry, deleteJourneyEntry } = await import("@/lib/journey");
    const entry = createJourneyEntry({ category: "learning", title: "Learn SQL", description: "Practice", targetDate: "2026-12-01" });
    expect(updateJourneyEntry({ entryId: entry.id, completed: true })?.completed).toBe(true);
    expect(state.readWorkspace().journey[0].completedAt).not.toBeNull();
    deleteJourneyEntry({ entryId: entry.id });
    expect(state.readWorkspace().journey).toEqual([]);
  });
});
