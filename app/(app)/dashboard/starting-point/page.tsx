import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { BrainCircuit, Eye, RotateCcw, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

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
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import {
  certificateAttachments,
  certificates,
  competitions,
  educationRecords,
  personalityTestResults,
  profileActivities,
  transcriptEntries,
  workExperiences,
} from "@/lib/db/schema";
import type { PersonalityType } from "@/lib/personality-test";
import type { TranscriptStage } from "@/lib/profile-records";
import { calculateTranscriptAverage } from "@/lib/transcript-import";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StartingPoint");
  return { title: t("metadataTitle") };
}

export default async function StartingPointPage() {
  const [viewer, t, profileT, personalityT, locale] = await Promise.all([
    requireViewer(),
    getTranslations("StartingPoint"),
    getTranslations("Profile"),
    getTranslations("PersonalityTest"),
    getLocale(),
  ]);
  if (viewer.actor.kind !== "user") redirect("/dashboard");

  const db = getDb();
  const [
    [personality],
    education,
    transcriptRows,
    certificateRows,
    competitionsList,
    activities,
    workExperienceList,
  ] = await Promise.all([
    db
      .select({
        completedAt: personalityTestResults.completedAt,
        resultType: personalityTestResults.resultType,
      })
      .from(personalityTestResults)
      .where(eq(personalityTestResults.userId, viewer.actor.userId))
      .limit(1),
    db
      .select({
        id: educationRecords.id,
        level: educationRecords.level,
        institutionName: educationRecords.institutionName,
        fieldOfStudy: educationRecords.fieldOfStudy,
        startMonth: educationRecords.startMonth,
        startYear: educationRecords.startYear,
        endMonth: educationRecords.endMonth,
        endYear: educationRecords.endYear,
        scoreScale: educationRecords.scoreScale,
        researchTitle: educationRecords.researchTitle,
        researchDescription: educationRecords.researchDescription,
      })
      .from(educationRecords)
      .where(eq(educationRecords.userId, viewer.actor.userId))
      .orderBy(
        asc(sql`case ${educationRecords.level}
          when 'HIGH_SCHOOL' then 1
          when 'UNDERGRADUATE' then 2
          when 'GRADUATE' then 3
          else 4 end`),
        asc(educationRecords.startYear),
        asc(educationRecords.startMonth),
      ),
    db
      .select({
        educationRecordId: transcriptEntries.educationRecordId,
        stage: transcriptEntries.stage,
        credits: transcriptEntries.credits,
        score: transcriptEntries.score,
      })
      .from(transcriptEntries)
      .innerJoin(
        educationRecords,
        eq(educationRecords.id, transcriptEntries.educationRecordId),
      )
      .where(eq(educationRecords.userId, viewer.actor.userId)),
    db
      .select({
        id: certificates.id,
        name: certificates.name,
        issuedYear: certificates.issuedYear,
        startMonth: certificates.startMonth,
        startYear: certificates.startYear,
        endMonth: certificates.endMonth,
        endYear: certificates.endYear,
        fileName: certificateAttachments.fileName,
        mimeType: certificateAttachments.mimeType,
      })
      .from(certificates)
      .leftJoin(
        certificateAttachments,
        eq(certificateAttachments.certificateId, certificates.id),
      )
      .where(eq(certificates.userId, viewer.actor.userId))
      .orderBy(desc(certificates.endYear), desc(certificates.endMonth)),
    db
      .select({
        id: competitions.id,
        name: competitions.name,
        awardName: competitions.awardName,
        year: competitions.year,
        startMonth: competitions.startMonth,
        startYear: competitions.startYear,
        endMonth: competitions.endMonth,
        endYear: competitions.endYear,
      })
      .from(competitions)
      .where(eq(competitions.userId, viewer.actor.userId))
      .orderBy(desc(competitions.endYear), desc(competitions.endMonth)),
    db
      .select({
        id: profileActivities.id,
        name: profileActivities.name,
        startMonth: profileActivities.startMonth,
        startYear: profileActivities.startYear,
        endMonth: profileActivities.endMonth,
        endYear: profileActivities.endYear,
      })
      .from(profileActivities)
      .where(eq(profileActivities.userId, viewer.actor.userId))
      .orderBy(desc(profileActivities.endYear), desc(profileActivities.endMonth)),
    db
      .select({
        id: workExperiences.id,
        workplaceName: workExperiences.workplaceName,
        position: workExperiences.position,
        startMonth: workExperiences.startMonth,
        startYear: workExperiences.startYear,
        endMonth: workExperiences.endMonth,
        endYear: workExperiences.endYear,
        isCurrent: workExperiences.isCurrent,
        learnings: workExperiences.learnings,
        skills: workExperiences.skills,
      })
      .from(workExperiences)
      .where(eq(workExperiences.userId, viewer.actor.userId))
      .orderBy(
        desc(workExperiences.isCurrent),
        desc(workExperiences.startYear),
        desc(workExperiences.startMonth),
      ),
  ]);

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
        personality.completedAt,
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
