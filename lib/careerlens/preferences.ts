import "server-only";

import { eq } from "drizzle-orm";

import { resolveAIModel } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";

export type CareerPreferences = {
  preferredCareerModel: string;
  reuseLatestRoadmapData: boolean;
  roadmapDataResetAt: string | null;
};

export async function getCareerPreferences(
  userId: string,
): Promise<CareerPreferences> {
  const [preference] = await getDb()
    .select({
      preferredCareerModel: userPreferences.preferredCareerModel,
      reuseLatestRoadmapData: userPreferences.reuseLatestRoadmapData,
      roadmapDataResetAt: userPreferences.roadmapDataResetAt,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return {
    preferredCareerModel: resolveAIModel(preference?.preferredCareerModel),
    reuseLatestRoadmapData: preference?.reuseLatestRoadmapData ?? true,
    roadmapDataResetAt:
      preference?.roadmapDataResetAt?.toISOString() ?? null,
  };
}

export async function getPreferredCareerModel(userId: string) {
  const preferences = await getCareerPreferences(userId);
  return preferences.preferredCareerModel;
}

export async function savePreferredCareerModel(userId: string, model: string) {
  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      preferredCareerModel: model,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        preferredCareerModel: model,
        updatedAt: new Date(),
      },
    });
}

export async function saveRoadmapDataPreference(
  userId: string,
  reuseLatestRoadmapData: boolean,
) {
  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      reuseLatestRoadmapData,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        reuseLatestRoadmapData,
        updatedAt: new Date(),
      },
    });
}

export async function resetRoadmapPrefillData(userId: string) {
  const resetAt = new Date();

  await getDb()
    .insert(userPreferences)
    .values({
      userId,
      roadmapDataResetAt: resetAt,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        roadmapDataResetAt: resetAt,
        updatedAt: resetAt,
      },
    });
}
