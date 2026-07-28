import "server-only";

import { z } from "zod";

import { generateAIJson } from "@/lib/ai/generate";

import {
  createJourneyEntry,
  deleteJourneyEntry,
  getJourneyEntries,
  updateJourneyEntry,
  type JourneyEntryCategory,
} from "./index";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonEmptyText = z.string().trim().min(1).max(500);

const journeyAiOutputSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(1_500),
  updates: z
    .array(
      z
        .object({
          entryId: z.string().uuid(),
          title: nonEmptyText.optional(),
          description: z.string().trim().max(2_000).optional(),
          targetDate: dateSchema.optional(),
          completed: z.boolean().optional(),
        })
        .refine(
          (value) =>
            value.title !== undefined ||
            value.description !== undefined ||
            value.targetDate !== undefined ||
            value.completed !== undefined,
          "An update needs at least one changed field",
        ),
    )
    .max(20),
  newEntries: z
    .array(
      z.object({
        title: nonEmptyText,
        description: z.string().trim().max(2_000),
        targetDate: dateSchema,
        category: z.enum(["learning", "experience", "career", "personal"]),
      }),
    )
    .max(10),
  deletions: z
    .array(
      z.object({
        entryId: z.string().uuid(),
      }),
    )
    .max(20),
});

export type JourneyAiResult = {
  assistantMessage: string;
  changedEntries: Awaited<ReturnType<typeof getJourneyEntries>>;
};

export async function applyJourneyAiRequest({
  locale,
  prompt,
  userId,
}: {
  locale: string;
  prompt: string;
  userId: string;
}): Promise<JourneyAiResult> {
  const entries = await getJourneyEntries(userId);
  const entryIds = new Set(entries.map((entry) => entry.id));
  const today = new Date().toISOString().slice(0, 10);
  const language = locale === "vi" ? "Vietnamese" : "English";

  const result = await generateAIJson<unknown>({
    systemPrompt: [
      "You are a careful career journey planning assistant.",
      "Interpret the user's request and return JSON only.",
      "You may update existing entries, append new entries, or delete existing entries.",
      "Only delete an entry when the user explicitly asks to delete or remove it.",
      "If the deletion target is ambiguous, do not delete anything; ask for clarification in assistantMessage.",
      "Never infer a deletion from a request to edit, postpone, replace, or reprioritize an entry.",
      "Do not update and delete the same entry in one response.",
      "Only reference entry IDs present in the provided data.",
      "Keep dates realistic and preserve completed work unless the user explicitly asks to change it.",
      `Write assistantMessage and all new text in ${language}.`,
      "Output shape: {assistantMessage, updates: [{entryId, title?, description?, targetDate?, completed?}], newEntries: [{title, description, targetDate, category}], deletions: [{entryId}]}",
    ].join("\n"),
    userPrompt: `Today is ${today}. Apply this request to my journey: ${prompt}`,
    rawInput: { entries },
    traceName: "journey-ai-edit",
    userId,
    logResponse: false,
  });

  const parsed = journeyAiOutputSchema.parse(result.data);
  const deletionIds = new Set(
    parsed.deletions
      .map((deletion) => deletion.entryId)
      .filter((entryId) => entryIds.has(entryId)),
  );
  const updates = parsed.updates.filter(
    (update) =>
      entryIds.has(update.entryId) && !deletionIds.has(update.entryId),
  );

  await Promise.all([
    ...Array.from(deletionIds).map((entryId) =>
      deleteJourneyEntry({ entryId, userId }),
    ),
    ...updates.map((update) =>
      updateJourneyEntry({
        completed: update.completed,
        description: update.description,
        entryId: update.entryId,
        targetDate: update.targetDate,
        title: update.title,
        userId,
      }),
    ),
    ...parsed.newEntries.map((entry) =>
      createJourneyEntry({
        category: entry.category as JourneyEntryCategory,
        description: entry.description,
        source: "ai",
        targetDate: entry.targetDate,
        title: entry.title,
        userId,
      }),
    ),
  ]);

  return {
    assistantMessage: parsed.assistantMessage,
    changedEntries: await getJourneyEntries(userId),
  };
}
