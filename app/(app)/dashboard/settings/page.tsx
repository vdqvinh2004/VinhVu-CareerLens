"use client";
import { useWorkspace } from "@/lib/browser-storage";
import { useTranslations } from "next-intl";

import { AISettingsForm } from "./_components/ai-settings-form";
import { getCareerPreferences } from "@/lib/careerlens/preferences";

import { RoadmapDataSettingsForm } from "./_components/roadmap-data-settings-form";


export default function SettingsPage() {
  useWorkspace();
  const t = useTranslations("Settings");
  const preferences = getCareerPreferences();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>
      <div className="flex flex-col gap-6">
        <AISettingsForm />
        <RoadmapDataSettingsForm
          reuseLatestRoadmapData={preferences.reuseLatestRoadmapData}
        />
      </div>
    </section>
  );
}
