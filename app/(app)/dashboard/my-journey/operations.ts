import { navigate } from "@/lib/browser-navigation";
import { getLocale } from "@/i18n/client";
import { z } from "zod";

import { applyJourneyAiRequest } from "@/lib/journey/ai";
import {
  appendRoadmapToJourney,
  createJourneyEntry,
  deleteJourneyEntry,
  updateJourneyEntry,
} from "@/lib/journey";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const categorySchema = z.enum([
  "learning",
  "experience",
  "career",
  "personal",
]);

export async function applyRoadmapToJourneyAction(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("roadmapId"));
  if (!parsed.success) return navigate("/dashboard/careerlens");

  const result = await appendRoadmapToJourney({
    roadmapId: parsed.data,
    });

  navigate(
    result
      ? `/dashboard/my-journey?imported=${result.entries.length}`
      : "/dashboard/my-journey?imported=0",
  );
}

export async function createJourneyEntryAction(input: unknown) {
  const parsed = z
    .object({
      category: categorySchema,
      description: z.string().trim().max(2_000),
      targetDate: dateSchema,
      title: z.string().trim().min(1).max(500),
    })
    .parse(input);

  const entry = await createJourneyEntry(parsed);
  return entry;
}

export async function updateJourneyEntryAction(input: unknown) {
  const parsed = z
    .object({
      category: categorySchema.optional(),
      completed: z.boolean().optional(),
      description: z.string().trim().max(2_000).optional(),
      entryId: z.string().uuid(),
      targetDate: dateSchema.optional(),
      title: z.string().trim().min(1).max(500).optional(),
    })
    .parse(input);

  const entry = await updateJourneyEntry(parsed);
  return entry;
}

export async function deleteJourneyEntryAction(input: unknown) {
  const entryId = z.string().uuid().parse(input);
  const deletedEntryId = await deleteJourneyEntry({ entryId });

  return deletedEntryId;
}

export async function askJourneyAiAction(prompt: string) {
  const parsedPrompt = z.string().trim().min(3).max(2_000).parse(prompt);
  const locale = await getLocale();

  const result = await applyJourneyAiRequest({
    locale,
    prompt: parsedPrompt,
    });
  return result;
}
