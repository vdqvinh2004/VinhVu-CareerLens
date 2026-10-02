"use client";
import { useWorkspace } from "@/lib/browser-storage";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  createCareerLensMarketSeed,
  MARKET_INDUSTRY_COUNT,
  MARKET_ROLE_COUNT_PER_REGION,
} from "@/lib/careerlens/market-seed";
import { getCareerPreferences } from "@/lib/careerlens/preferences";
import { getRoadmapPrefillDefaults } from "@/lib/careerlens/roadmap-prefill";
import {
  getCareerRoadmap,
  getFollowedCareerRoadmap,
  getFollowedCareerRoadmapHistory,
  getCareerRoadmapSummaries,
  getLatestCreatedCareerRoadmap,
  getLatestCareerRoadmap,
} from "@/lib/careerlens/roadmaps";
import { getCareerStartingPointSnapshot } from "@/lib/careerlens/starting-point";
import { getVietnamProvinceNames } from "@/lib/careerlens/vietnam-provinces";

import { CareerWorkspace } from "./_components/career-workspace";


export default function CareerLensPage() {
  useWorkspace();
  const t = useTranslations("Roadmap");
  const locale = useLocale();
  const requestedRoadmapId = new URLSearchParams(window.location.search).get("roadmap");
  const startingPoint = getCareerStartingPointSnapshot();
  const savedRoadmaps = getCareerRoadmapSummaries();
  const requestedSavedRoadmap = requestedRoadmapId ? getCareerRoadmap(requestedRoadmapId) : null;
  const latestRoadmap = getLatestCareerRoadmap();
  const latestCreatedRoadmap = getLatestCreatedCareerRoadmap();
  const preferences = getCareerPreferences();
  const provinces = getVietnamProvinceNames();
  const followedRoadmap = getFollowedCareerRoadmap();
  const followedRoadmapHistory = getFollowedCareerRoadmapHistory();
  const marketSeed = createCareerLensMarketSeed(provinces);
  const savedRoadmap = requestedSavedRoadmap ?? latestRoadmap;
  const newRoadmapDefaults = getRoadmapPrefillDefaults({
    enabled: preferences.reuseLatestRoadmapData,
    latestRoadmap: latestCreatedRoadmap,
    resetAt: preferences.roadmapDataResetAt,
  });

  const regionCount = new Set(
    marketSeed.postings.map((posting) => posting.region),
  ).size;
  const sourceDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(marketSeed.source_timestamp));

  return (
    <section className="ai-workspace-surface relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="ai-workspace-grid pointer-events-none absolute inset-x-0 top-0 h-[34rem]" />
      <div className="relative mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <header className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)] lg:items-end lg:gap-16">
          <div className="max-w-4xl">
            <Badge variant="secondary">{t("eyebrow")}</Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl lg:leading-[1.02]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {t("description")}
            </p>
          </div>

          <div className="rounded-[2rem] bg-foreground/5 p-1.5 ring-1 ring-foreground/5">
            <Card className="overflow-hidden rounded-[calc(2rem-0.375rem)] border-0 bg-foreground text-background shadow-none">
              <CardHeader className="gap-3 p-6">
                <Badge variant="secondary">{t("brief.status")}</Badge>
                <CardTitle className="text-xl text-background">{t("brief.title")}</CardTitle>
                <CardDescription className="text-background/60">{t("brief.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-0 px-6 pb-6">
                {(["profile", "signals", "plan"] as const).map((step, index) => (
                  <div key={step}>
                    {index > 0 ? <Separator className="bg-background/10" /> : null}
                    <div className="grid grid-cols-[2rem_1fr] gap-3 py-3">
                      <span className="font-mono text-xs text-background/40">0{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{t(`steps.${step}.title`)}</p>
                        <p className="mt-1 text-xs leading-5 text-background/55">
                          {t(`steps.${step}.description`)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </header>

        <CareerWorkspace
          newRoadmapDefaults={newRoadmapDefaults}
          reuseLatestRoadmapData={preferences.reuseLatestRoadmapData}
          startingPoint={startingPoint}
          savedRoadmap={savedRoadmap}
          savedRoadmaps={savedRoadmaps}
          followedRoadmap={followedRoadmap}
          followedRoadmapHistory={followedRoadmapHistory}
          provinces={provinces}
          marketOverview={{
            postingCount: marketSeed.postings.length,
            regionCount,
            roleCountPerRegion: MARKET_ROLE_COUNT_PER_REGION,
            industryCount: MARKET_INDUSTRY_COUNT,
            sourceDate,
          }}
        />
      </div>
    </section>
  );
}
