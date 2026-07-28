import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createJourneyEntry: vi.fn(),
  deleteJourneyEntry: vi.fn(),
  generateAIJson: vi.fn(),
  getJourneyEntries: vi.fn(),
  updateJourneyEntry: vi.fn(),
}));

vi.mock("@/lib/ai/generate", () => ({
  generateAIJson: mocks.generateAIJson,
}));

vi.mock("@/lib/journey/index", () => ({
  createJourneyEntry: mocks.createJourneyEntry,
  deleteJourneyEntry: mocks.deleteJourneyEntry,
  getJourneyEntries: mocks.getJourneyEntries,
  updateJourneyEntry: mocks.updateJourneyEntry,
}));

import { applyJourneyAiRequest } from "@/lib/journey/ai";

const deletedEntryId = "11111111-1111-4111-8111-111111111111";
const updatedEntryId = "22222222-2222-4222-8222-222222222222";
const foreignEntryId = "33333333-3333-4333-8333-333333333333";

function journeyEntry(id: string, title: string) {
  return {
    id,
    category: "personal" as const,
    completed: false,
    completedAt: null,
    createdAt: "2026-07-19T00:00:00.000Z",
    description: "",
    source: "manual" as const,
    sourceLabel: null,
    targetDate: "2026-08-19",
    title,
    updatedAt: "2026-07-19T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Journey AI deletion", () => {
  it("deletes only owned journey entries and skips updates for deleted entries", async () => {
    const deletedEntry = journeyEntry(deletedEntryId, "Mục cần xoá");
    const updatedEntry = journeyEntry(updatedEntryId, "Mục cần hoàn thành");
    const changedEntries = [{ ...updatedEntry, completed: true }];

    mocks.getJourneyEntries
      .mockResolvedValueOnce([deletedEntry, updatedEntry])
      .mockResolvedValueOnce(changedEntries);
    mocks.generateAIJson.mockResolvedValue({
      data: {
        assistantMessage: "Đã xoá dấu mốc theo yêu cầu.",
        deletions: [
          { entryId: deletedEntryId },
          { entryId: deletedEntryId },
          { entryId: foreignEntryId },
        ],
        newEntries: [],
        updates: [
          { entryId: deletedEntryId, title: "Không được cập nhật" },
          { completed: true, entryId: updatedEntryId },
        ],
      },
    });
    mocks.deleteJourneyEntry.mockResolvedValue(deletedEntryId);
    mocks.updateJourneyEntry.mockResolvedValue(changedEntries[0]);

    const result = await applyJourneyAiRequest({
      locale: "vi",
      prompt: "Xoá mục cần xoá",
      userId: "user-1",
    });

    expect(mocks.deleteJourneyEntry).toHaveBeenCalledOnce();
    expect(mocks.deleteJourneyEntry).toHaveBeenCalledWith({
      entryId: deletedEntryId,
      userId: "user-1",
    });
    expect(mocks.updateJourneyEntry).toHaveBeenCalledOnce();
    expect(mocks.updateJourneyEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        completed: true,
        entryId: updatedEntryId,
        userId: "user-1",
      }),
    );
    expect(result.changedEntries).toEqual(changedEntries);

    const aiRequest = mocks.generateAIJson.mock.calls[0]?.[0];
    expect(aiRequest.systemPrompt).toContain(
      "Only delete an entry when the user explicitly asks",
    );
    expect(aiRequest.systemPrompt).toContain("deletions: [{entryId}]");
  });
});
