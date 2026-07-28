import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getCareerRoadmap } from "@/lib/careerlens/roadmaps";
import type { CareerRecommendation } from "@/lib/careerlens/schemas";
import { getDb } from "@/lib/db";
import { journeyEntries, journeyImports } from "@/lib/db/schema";

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

type JourneyEntryDraft = Omit<
  typeof journeyEntries.$inferInsert,
  "id" | "userId" | "importId" | "createdAt" | "updatedAt"
>;

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

function toView(row: typeof journeyEntries.$inferSelect): JourneyEntryView {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    title: row.title,
    description: row.description,
    targetDate: row.targetDate,
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() ?? null,
    sourceLabel: row.sourceLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getJourneyEntries(
  userId: string,
): Promise<JourneyEntryView[]> {
  const rows = await getDb()
    .select()
    .from(journeyEntries)
    .where(eq(journeyEntries.userId, userId))
    .orderBy(asc(journeyEntries.targetDate), asc(journeyEntries.createdAt));

  return rows.map(toView);
}

export async function appendRoadmapToJourney({
  roadmapId,
  userId,
}: {
  roadmapId: string;
  userId: string;
}) {
  const roadmap = await getCareerRoadmap(userId, roadmapId);
  if (!roadmap) return null;

  const recommendation =
    roadmap.guidanceOutput.recommendations[
      roadmap.selectedRecommendationIndex
    ] ?? roadmap.guidanceOutput.recommendations[0];
  if (!recommendation) return null;

  const drafts = roadmapDrafts(recommendation);
  if (drafts.length === 0) return null;

  return getDb().transaction(async (tx) => {
    const [journeyImport] = await tx
      .insert(journeyImports)
      .values({
        directionTitle: recommendation.path_title,
        roadmapId,
        userId,
      })
      .returning({ id: journeyImports.id });

    if (!journeyImport) throw new Error("Could not create journey import");

    const inserted = await tx
      .insert(journeyEntries)
      .values(
        drafts.map((draft) => ({
          ...draft,
          importId: journeyImport.id,
          userId,
        })),
      )
      .returning();

    return {
      directionTitle: recommendation.path_title,
      entries: inserted.map(toView),
    };
  });
}

export async function createJourneyEntry({
  category,
  description,
  source = "manual",
  targetDate,
  title,
  userId,
}: {
  category: JourneyEntryCategory;
  description: string;
  source?: JourneyEntrySource;
  targetDate: string;
  title: string;
  userId: string;
}) {
  const [entry] = await getDb()
    .insert(journeyEntries)
    .values({
      category,
      description,
      source,
      targetDate,
      title,
      userId,
    })
    .returning();

  if (!entry) throw new Error("Could not create journey entry");
  return toView(entry);
}

export async function updateJourneyEntry({
  category,
  completed,
  description,
  entryId,
  targetDate,
  title,
  userId,
}: {
  category?: JourneyEntryCategory;
  completed?: boolean;
  description?: string;
  entryId: string;
  targetDate?: string;
  title?: string;
  userId: string;
}) {
  const now = new Date();
  const [entry] = await getDb()
    .update(journeyEntries)
    .set({
      ...(category === undefined ? {} : { category }),
      ...(completed === undefined
        ? {}
        : { completed, completedAt: completed ? now : null }),
      ...(description === undefined ? {} : { description }),
      ...(targetDate === undefined ? {} : { targetDate }),
      ...(title === undefined ? {} : { title }),
      updatedAt: now,
    })
    .where(
      and(
        eq(journeyEntries.id, entryId),
        eq(journeyEntries.userId, userId),
      ),
    )
    .returning();

  return entry ? toView(entry) : null;
}

export async function deleteJourneyEntry({
  entryId,
  userId,
}: {
  entryId: string;
  userId: string;
}) {
  const [entry] = await getDb()
    .delete(journeyEntries)
    .where(
      and(
        eq(journeyEntries.id, entryId),
        eq(journeyEntries.userId, userId),
      ),
    )
    .returning({ id: journeyEntries.id });

  return entry?.id ?? null;
}
