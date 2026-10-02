"use client";
import { useWorkspace } from "@/lib/browser-storage";
import Link from "next/link";
import { BrainCircuit, Eye, RotateCcw, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ProfileRecords } from "@/app/(app)/dashboard/profile/_components/profile-records";
import { CvImportDialog } from "@/app/(app)/dashboard/starting-point/_components/cv-import-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PersonalityType } from "@/lib/personality-test";
import type { TranscriptStage } from "@/lib/profile-records";
import { calculateTranscriptAverage } from "@/lib/transcript-import";


export default function StartingPointPage() {
  const state = useWorkspace();
  const t = useTranslations("StartingPoint");
  const profileT = useTranslations("Profile");
  const personalityT = useTranslations("PersonalityTest");
  const locale = useLocale();
  const { personality, education, activities } = state;
  const competitionsList = state.competitions;
  const workExperienceList = state.workExperiences;
  const transcriptRows = education.flatMap(record => record.transcriptEntries.map(entry => ({ ...entry, educationRecordId: record.id })));
  const certificateRows = state.certificates.map(record => ({ ...record, fileName: record.attachment?.fileName, mimeType: record.attachment?.mimeType }));
  const transcriptGroups = new Map<
    string,
    Array<{ stage: TranscriptStage; credits: number | null; score: number }>
  >();
  for (const row of transcriptRows) {
    const key = `${row.educationRecordId}:${row.stage}`;
    const group = transcriptGroups.get(key) ?? [];
    group.push({ stage: row.stage, credits: row.credits, score: row.score });
    transcriptGroups.set(key, group);
  }

  const personalityType = personality?.resultType as PersonalityType | undefined;
  const completedLabel = personality?.completedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(personality.completedAt),
      )
    : undefined;
  const currentYear = new Date().getUTCFullYear();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <CvImportDialog />
      </header>

      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>
            {personalityType
              ? profileT("personality.completedTitle")
              : profileT("personality.emptyTitle")}
          </CardTitle>
          <CardDescription>
            {personalityType
              ? profileT("personality.completedDescription")
              : profileT("personality.emptyDescription")}
          </CardDescription>
        </CardHeader>
        {personalityType ? (
          <CardContent>
            <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {personalityType}
                </p>
                <p className="text-sm font-medium">
                  {personalityT(`types.${personalityType}.title`)}
                </p>
              </div>
              {completedLabel ? (
                <p className="text-sm text-muted-foreground">
                  {profileT("personality.completedOn", { date: completedLabel })}
                </p>
              ) : null}
            </div>
          </CardContent>
        ) : null}
        <CardFooter className="flex-wrap justify-end gap-3">
          {personalityType ? (
            <Link
              href="/dashboard/profile/personality-test?view=result"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Eye data-icon="inline-start" />
              {profileT("personality.viewDetails")}
            </Link>
          ) : null}
          <Link
            href="/dashboard/profile/personality-test"
            className={buttonVariants({ size: "lg" })}
          >
            {personalityType ? (
              <RotateCcw data-icon="inline-start" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {personalityType
              ? profileT("personality.retake")
              : profileT("personality.takeTest")}
          </Link>
        </CardFooter>
      </Card>

      <ProfileRecords
        activities={activities}
        certificates={certificateRows.map((certificate) => ({
          id: certificate.id,
          name: certificate.name,
          issuedYear: certificate.issuedYear,
          startMonth: certificate.startMonth,
          startYear: certificate.startYear,
          endMonth: certificate.endMonth,
          endYear: certificate.endYear,
          attachment:
            certificate.fileName && certificate.mimeType
              ? { fileName: certificate.fileName, mimeType: certificate.mimeType }
              : null,
        }))}
        competitions={competitionsList}
        currentYear={currentYear}
        education={education.map((record) => ({
          ...record,
          scoreScale: record.scoreScale as 4 | 10,
          transcriptSummaries: ([
            "GRADE_10",
            "GRADE_11",
            "GRADE_12",
            "CUMULATIVE",
          ] as const).flatMap((stage) => {
            const entries = transcriptGroups.get(`${record.id}:${stage}`);
            if (!entries?.length) return [];
            return [{
              stage,
              average: calculateTranscriptAverage(entries) ?? 0,
              subjectCount: entries.length,
              totalCredits:
                stage === "CUMULATIVE"
                  ? entries.reduce((total, entry) => total + (entry.credits ?? 0), 0)
                  : null,
            }];
          }),
        }))}
        workExperiences={workExperienceList}
      />
    </section>
  );
}
