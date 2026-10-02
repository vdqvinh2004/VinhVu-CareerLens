"use client";
import { useWorkspace } from "@/lib/browser-storage";

import { getJourneyEntries } from "@/lib/journey";

import { JourneyTimeline } from "./_components/journey-timeline";


export default function MyJourneyPage() {
  useWorkspace();
  const entries = getJourneyEntries();
  const params = { imported: new URLSearchParams(window.location.search).get("imported") ?? undefined };
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
