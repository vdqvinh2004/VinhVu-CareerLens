"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
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

async function requireJourneyUser() {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") throw new Error("Forbidden");
  return viewer.actor.userId;
}

export async function applyRoadmapToJourneyAction(formData: FormData) {
  const userId = await requireJourneyUser();
  const parsed = z.string().uuid().safeParse(formData.get("roadmapId"));
  if (!parsed.success) redirect("/dashboard/careerlens");

  const result = await appendRoadmapToJourney({
    roadmapId: parsed.data,
    userId,
  });

  revalidatePath("/dashboard/my-journey");
  redirect(
    result
      ? `/dashboard/my-journey?imported=${result.entries.length}`
      : "/dashboard/my-journey?imported=0",
  );
}

export async function createJourneyEntryAction(input: unknown) {
  const userId = await requireJourneyUser();
  const parsed = z
    .object({
      category: categorySchema,
      description: z.string().trim().max(2_000),
      targetDate: dateSchema,
      title: z.string().trim().min(1).max(500),
    })
    .parse(input);

  const entry = await createJourneyEntry({ ...parsed, userId });
  revalidatePath("/dashboard/my-journey");
  return entry;
}

export async function updateJourneyEntryAction(input: unknown) {
  const userId = await requireJourneyUser();
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

  const entry = await updateJourneyEntry({ ...parsed, userId });
  revalidatePath("/dashboard/my-journey");
  return entry;
}

export async function deleteJourneyEntryAction(input: unknown) {
  const userId = await requireJourneyUser();
  const entryId = z.string().uuid().parse(input);
  const deletedEntryId = await deleteJourneyEntry({ entryId, userId });

  revalidatePath("/dashboard/my-journey");
  return deletedEntryId;
}

export async function askJourneyAiAction(prompt: string) {
  const userId = await requireJourneyUser();
  const parsedPrompt = z.string().trim().min(3).max(2_000).parse(prompt);
  const locale = await getLocale();

  const result = await applyJourneyAiRequest({
    locale,
    prompt: parsedPrompt,
    userId,
  });
  revalidatePath("/dashboard/my-journey");
  return result;
}
