import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getJourneyEntries } from "@/lib/journey";

import { JourneyTimeline } from "./_components/journey-timeline";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Journey");
  return { title: t("metadataTitle") };
}

export default async function MyJourneyPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string | string[] }>;
}) {
  const viewer = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (viewer.actor.kind !== "user") redirect("/dashboard");

  const [entries, params] = await Promise.all([
    getJourneyEntries(viewer.actor.userId),
    searchParams,
  ]);
  const importedValue = Array.isArray(params.imported)
    ? params.imported[0]
    : params.imported;
  const importedCount = importedValue === undefined
    ? null
    : Number.isFinite(Number(importedValue))
      ? Number(importedValue)
      : null;

  return (
    <section className="ai-workspace-surface relative min-h-dvh overflow-x-clip">
      <JourneyTimeline
        initialEntries={entries}
        importedCount={importedCount}
      />
    </section>
  );
}
