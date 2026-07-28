"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  BrainCircuit,
  BriefcaseBusiness,
  FileBadge,
  FlaskConical,
  GraduationCap,
  Trophy,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { CareerStartingPointSnapshot } from "@/lib/careerlens/schemas";
import { hasCareerStartingPointData } from "@/lib/careerlens/starting-point-data";
import type { PersonalityType } from "@/lib/personality-test";
import { calculateTranscriptAverage } from "@/lib/transcript-average";

type StartingPointSummaryProps = {
  snapshot: CareerStartingPointSnapshot;
};

function cleanText(value: string) {
  return value.replace(/[–—]/g, "-");
}

function periodLabel(
  locale: string,
  startMonth: number,
  startYear: number,
  endMonth: number | null,
  endYear: number | null,
  currentLabel: string,
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = formatter.format(new Date(Date.UTC(startYear, startMonth - 1, 1)));
  const end =
    endMonth && endYear
      ? formatter.format(new Date(Date.UTC(endYear, endMonth - 1, 1)))
      : currentLabel;
  return `${start} - ${end}`;
}

function SummaryList({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 py-2 text-sm">{children}</div>;
}

export function StartingPointSummary({ snapshot }: StartingPointSummaryProps) {
  const locale = useLocale();
  const t = useTranslations("Roadmap.startingPoint");
  const personalityT = useTranslations("PersonalityTest");

  if (!hasCareerStartingPointData(snapshot)) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GraduationCap />
          </EmptyMedia>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Accordion multiple defaultValue={["personality", "education"]}>
      <AccordionItem value="personality">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <BrainCircuit aria-hidden="true" />
            {t("personality")}
            <Badge variant="secondary">{snapshot.personality ? 1 : 0}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          {snapshot.personality ? (
            <div className="flex flex-wrap items-baseline gap-2 py-2">
              <span className="text-xl font-semibold">
                {snapshot.personality.resultType}
              </span>
              <span className="text-sm text-muted-foreground">
                {personalityT(
                  `types.${snapshot.personality.resultType as PersonalityType}.title`,
                )}
              </span>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">{t("notProvided")}</p>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="education">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <GraduationCap aria-hidden="true" />
            {t("education")}
            <Badge variant="secondary">{snapshot.education.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <SummaryList>
            {snapshot.education.length ? (
              snapshot.education.map((record) => {
                const stages = [
                  "GRADE_10",
                  "GRADE_11",
                  "GRADE_12",
                  "CUMULATIVE",
                ] as const;
                const averages = stages.flatMap((stage) => {
                  const entries = record.transcriptEntries.filter(
                    (entry) => entry.stage === stage,
                  );
                  const average = calculateTranscriptAverage(entries);
                  return average === null
                    ? []
                    : [t("average", { stage: t(`stages.${stage}`), value: average })];
                });

                return (
                  <div key={record.id} className="flex flex-col gap-1">
                    <p className="font-medium">
                      {cleanText(record.institutionName)}
                      {record.fieldOfStudy
                        ? `, ${cleanText(record.fieldOfStudy)}`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {t(`levels.${record.level}`)}. {periodLabel(
                        locale,
                        record.startMonth,
                        record.startYear,
                        record.endMonth,
                        record.endYear,
                        t("current"),
                      )}
                    </p>
                    {averages.length ? (
                      <p className="text-muted-foreground">{averages.join(", ")}</p>
                    ) : null}
                    {record.researchTitle ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted p-3">
                        <FlaskConical aria-hidden="true" />
                        <p>
                          <span className="font-medium">
                            {cleanText(record.researchTitle)}
                          </span>
                          {record.researchDescription
                            ? `: ${cleanText(record.researchDescription)}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground">{t("notProvided")}</p>
            )}
          </SummaryList>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="certificates">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <FileBadge aria-hidden="true" />
            {t("certificates")}
            <Badge variant="secondary">{snapshot.certificates.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <SummaryList>
            {snapshot.certificates.length ? (
              snapshot.certificates.map((certificate, index) => (
                <p key={`${certificate.name}-${index}`}>
                  <span className="font-medium">{cleanText(certificate.name)}</span>
                  <span className="text-muted-foreground">
                    {` (${certificate.issuedYear}${certificate.hasAttachment ? `, ${t("hasEvidence")}` : ""})`}
                  </span>
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">{t("notProvided")}</p>
            )}
          </SummaryList>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="experience">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <BriefcaseBusiness aria-hidden="true" />
            {t("experience")}
            <Badge variant="secondary">{snapshot.workExperiences.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <SummaryList>
            {snapshot.workExperiences.length ? (
              snapshot.workExperiences.map((experience, index) => (
                <div key={`${experience.workplaceName}-${index}`}>
                  <p className="font-medium">
                    {experience.position
                      ? `${cleanText(experience.position)} - ${cleanText(experience.workplaceName)}`
                      : cleanText(experience.workplaceName)}
                  </p>
                  <p className="text-muted-foreground">
                    {periodLabel(
                      locale,
                      experience.startMonth,
                      experience.startYear,
                      experience.endMonth,
                      experience.endYear,
                      t("current"),
                    )}
                  </p>
                  {experience.skills ? (
                    <p>{t("skills", { value: cleanText(experience.skills) })}</p>
                  ) : null}
                  {experience.learnings ? (
                    <p className="text-muted-foreground">
                      {t("learnings", { value: cleanText(experience.learnings) })}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{t("notProvided")}</p>
            )}
          </SummaryList>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="competitions">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Trophy aria-hidden="true" />
            {t("competitions")}
            <Badge variant="secondary">{snapshot.competitions.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <SummaryList>
            {snapshot.competitions.length ? (
              snapshot.competitions.map((competition, index) => (
                <p key={`${competition.name}-${index}`}>
                  <span className="font-medium">{cleanText(competition.name)}</span>
                  {competition.awardName
                    ? `: ${cleanText(competition.awardName)}`
                    : ""}
                  <span className="text-muted-foreground">{` (${competition.year})`}</span>
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">{t("notProvided")}</p>
            )}
          </SummaryList>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="activities">
        <AccordionTrigger>
          <span className="flex items-center gap-2">
            <Award aria-hidden="true" />
            {t("activities")}
            <Badge variant="secondary">{snapshot.activities.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <SummaryList>
            {snapshot.activities.length ? (
              snapshot.activities.map((activity, index) => (
                <p key={`${activity.name}-${index}`}>
                  <span className="font-medium">{cleanText(activity.name)}</span>
                  <span className="text-muted-foreground">
                    {` (${periodLabel(
                      locale,
                      activity.startMonth,
                      activity.startYear,
                      activity.endMonth,
                      activity.endYear,
                      t("current"),
                    )})`}
                  </span>
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">{t("notProvided")}</p>
            )}
          </SummaryList>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
