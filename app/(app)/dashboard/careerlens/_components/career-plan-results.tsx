"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  Compass,
  ExternalLink,
  Gauge,
  Lightbulb,
  MapPin,
  Search,
  Milestone,
  Target,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CareerGuidanceOutput } from "@/lib/careerlens/schemas";
import { applyRoadmapToJourneyAction } from "@/app/(app)/dashboard/my-journey/actions";

import {
  findRelatedJobsAction,
  selectCareerRecommendationAction,
  type RelatedJobsActionState,
} from "../actions";

function cleanText(value: string) {
  return value.replace(/[–—]/g, "-");
}

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
          {cleanText(item)}
        </li>
      ))}
    </ul>
  );
}

type CareerPlanResultsProps = {
  location: string;
  output: CareerGuidanceOutput;
  roadmapId: string;
  selectedRecommendationIndex?: number;
  successMessage?: string;
};

const initialRelatedJobsState: RelatedJobsActionState = {
  status: "idle",
  jobs: [],
};

export function CareerPlanResults({
  location,
  output,
  roadmapId,
  selectedRecommendationIndex = 0,
  successMessage,
}: CareerPlanResultsProps) {
  const t = useTranslations("Roadmap.results");
  const [relatedJobsState, relatedJobsAction, findingJobs] = useActionState(
    findRelatedJobsAction,
    initialRelatedJobsState,
  );
  const selectedRecommendation =
    output.recommendations[selectedRecommendationIndex] ??
    output.recommendations[0];
  const selectedIndex = Math.max(
    0,
    output.recommendations.indexOf(selectedRecommendation),
  );
  const visibleRecommendations = selectedRecommendation
    ? [{ recommendation: selectedRecommendation, recommendationIndex: selectedIndex }]
    : [];

  return (
    <section aria-labelledby="career-plan-results" className="flex flex-col gap-12">
      <header className="grid overflow-hidden rounded-[2.25rem] bg-foreground text-background lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-7 sm:p-10 lg:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-background/50">
            {t("eyebrow")}
          </p>
          <h2
            id="career-plan-results"
            className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl"
          >
            {t("title")}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-background/60">
            {cleanText(successMessage ?? t("description"))}
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-background/10 lg:grid-cols-1 lg:border-t-0 lg:border-l">
          <div className="flex flex-col justify-end p-6 sm:p-8">
            <p className="font-mono text-5xl font-semibold tracking-[-0.06em]">
              {output.recommendations.length}
            </p>
            <p className="mt-2 text-sm text-background/50">{t("directionCount")}</p>
          </div>
          <div className="flex flex-col justify-end border-l border-background/10 p-6 sm:p-8 lg:border-t lg:border-l-0">
            <p className="font-mono text-lg font-semibold uppercase">
              {t(`confidence.${output.profile_summary.data_confidence}`)}
            </p>
            <p className="mt-2 text-sm text-background/50">{t("confidenceLabel")}</p>
          </div>
        </div>
      </header>

      <Alert className="rounded-2xl bg-muted/45">
        <Compass aria-hidden="true" />
        <AlertTitle>{t("disclaimerTitle")}</AlertTitle>
        <AlertDescription>{cleanText(output.disclaimer)}</AlertDescription>
      </Alert>

      <div className="grid overflow-hidden rounded-[2rem] border bg-card lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card className="rounded-none border-0 shadow-none">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle>{t("profileTitle")}</CardTitle>
            <CardDescription>
              {t("profileDescription", {
                confidence: t(`confidence.${output.profile_summary.data_confidence}`),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 px-6 pb-8 sm:grid-cols-2 sm:px-8">
            <div>
              <h3 className="text-sm font-medium">{t("strengths")}</h3>
              {output.profile_summary.strengths.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                  {output.profile_summary.strengths.map((strength) => (
                    <li key={strength} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                      {cleanText(strength)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t("noStrengths")}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium">{t("interests")}</h3>
              {output.profile_summary.interests.length + output.profile_summary.personal_signals.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                  {[...output.profile_summary.interests, ...output.profile_summary.personal_signals]
                    .slice(0, 5)
                    .map((signal) => (
                      <li key={signal} className="flex items-start gap-2">
                        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        {cleanText(signal)}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{t("noInterests")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-x-0 border-y-0 bg-muted/45 shadow-none lg:border-l">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle>{t("marketTitle")}</CardTitle>
            <CardDescription>{t("marketDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 sm:px-8">
            {output.market_summary.short_supply_skills.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {output.market_summary.short_supply_skills.slice(0, 4).map((item) => (
                  <li key={`${item.skill}-${item.region}`} className="border-t pt-4 first:border-t-0 first:pt-0">
                    <p className="text-base font-medium">{cleanText(item.skill)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin aria-hidden="true" className="size-4" />
                      {cleanText(item.region)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noMarket")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-8">
        {visibleRecommendations.map(({ recommendation, recommendationIndex }) => (
          <Card
            key={`${recommendation.path_title}-${recommendationIndex}`}
            className="overflow-hidden rounded-[2rem] border-0 bg-muted/35 shadow-none ring-1 ring-foreground/5"
          >
            <CardHeader className="gap-7 p-6 sm:p-8 lg:grid-cols-[5rem_minmax(0,1fr)_10rem] lg:items-start">
              <p className="font-mono text-5xl font-medium tracking-[-0.06em] text-foreground/20">
                0{recommendationIndex + 1}
              </p>
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t(`category.${recommendation.path_category}`)}
                  </Badge>
                  <Badge>{t("selected")}</Badge>
                </div>
                <CardTitle className="mt-4 text-2xl tracking-[-0.025em] sm:text-3xl">
                  {cleanText(recommendation.path_title)}
                </CardTitle>
                <CardDescription className="mt-3 max-w-3xl text-sm leading-6 sm:text-base sm:leading-7">
                  {cleanText(recommendation.fit_explanation)}
                </CardDescription>
              </div>
              <div className="rounded-2xl bg-background p-5 ring-1 ring-foreground/5 lg:text-right">
                <p className="font-mono text-4xl font-semibold tracking-[-0.05em]">
                  {recommendation.fit_score}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t("fitLabel")}</p>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-8 bg-card px-6 py-8 sm:px-8">
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                <div className="border-t pt-5">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Target aria-hidden="true" className="size-4 text-primary" />
                    {t("matchedTitle")}
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                    {recommendation.matched_profile_signals.slice(0, 5).map((signal) => (
                      <li key={signal} className="flex items-start gap-2">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        {cleanText(signal)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t pt-5">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Gauge aria-hidden="true" className="size-4 text-primary" />
                    {t("evidenceTitle")}
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                    {recommendation.market_evidence.slice(0, 5).map((evidence) => (
                      <li key={evidence}>{cleanText(evidence)}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-4">
                  <h3 className="shrink-0 text-base font-semibold">{t("skillGapsTitle")}</h3>
                  <Separator />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recommendation.skill_gaps.map((gap) => (
                    <div key={gap.skill} className="rounded-2xl bg-muted/60 p-5">
                      <p className="font-medium">{cleanText(gap.skill)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("levelRange", {
                          current: gap.current_level,
                          target: gap.target_level,
                        })}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {cleanText(gap.why_needed)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 border-t pt-6 text-base font-semibold">
                  <BookOpenCheck aria-hidden="true" className="size-4 text-primary" />
                  {t("roadmapTitle")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("roadmapDiagramDescription")}
                </p>
                <Accordion className="mt-5 gap-0 overflow-visible rounded-none border-0">
                  {recommendation.roadmap.map((stage, stageIndex) => (
                    <AccordionItem
                      key={`${stage.stage_order}-${stage.stage_type}`}
                      value={String(stage.stage_order)}
                      className="relative border-0 bg-transparent pb-6 pl-14 not-last:border-b-0 last:pb-0 data-open:bg-transparent"
                    >
                      {stageIndex < recommendation.roadmap.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-12 -bottom-3 left-5 border-l-2 border-dashed border-border"
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="absolute top-3 left-0 flex size-10 items-center justify-center rounded-full border-2 bg-background font-mono text-sm font-semibold"
                      >
                        {String(stage.stage_order).padStart(2, "0")}
                      </span>
                      <div className="overflow-hidden rounded-2xl border bg-background">
                        <AccordionTrigger className="p-5 hover:no-underline sm:p-6">
                          <span className="flex min-w-0 flex-1 flex-col gap-2">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold">
                                {t(`stages.${stage.stage_type}`)}
                              </span>
                              <Badge variant="secondary">
                                {cleanText(stage.time_limit)}
                              </Badge>
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {t("roadmapClickHint")}
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-1 pb-1 sm:px-2 sm:pb-2">
                        {stage.stage_type === "learning" ? (
                          <div className="flex flex-col gap-6">
                            <div className="rounded-2xl bg-muted/60 p-5">
                              <p className="text-sm font-medium">{t("learning.track")}</p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {cleanText(stage.major_or_track)}
                              </p>
                            </div>

                            <div>
                              <p className="font-medium">{t("learning.subjects")}</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.subjects.map((subject) => (
                                  <div key={subject.subject_name} className="rounded-2xl border p-5">
                                    <p className="font-medium">{cleanText(subject.subject_name)}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                      {cleanText(subject.focus)}
                                    </p>
                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                      {t("learning.evidence", {
                                        value: cleanText(subject.evidence_of_completion),
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {stage.certificates.length > 0 ? (
                              <div>
                                <p className="font-medium">{t("learning.certificates")}</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {stage.certificates.map((certificate) => (
                                    <div key={certificate.certificate_name} className="rounded-2xl bg-muted/60 p-5">
                                      <p className="font-medium">{cleanText(certificate.certificate_name)}</p>
                                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {cleanText(certificate.purpose)}
                                      </p>
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        {t("learning.certificateTiming", {
                                          value: cleanText(certificate.target_time),
                                        })}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div>
                              <p className="font-medium">{t("learning.activities")}</p>
                              <div className="mt-3 flex flex-col gap-3">
                                {stage.research_and_competitions.map((activity) => (
                                  <div key={`${activity.activity_type}-${activity.activity_name}`} className="rounded-2xl border p-5">
                                    <p className="font-medium">{cleanText(activity.activity_name)}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                      {cleanText(activity.goal)}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                      {t("learning.evidence", {
                                        value: cleanText(activity.evidence_of_completion),
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="font-medium">{t("learning.milestones")}</p>
                              <DetailList items={stage.milestones} />
                            </div>
                          </div>
                        ) : stage.stage_type === "internship" ? (
                          <div className="flex flex-col gap-6">
                            <div>
                              <p className="font-medium">{t("internship.where")}</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.target_organizations.map((target) => (
                                  <div key={`${target.organization}-${target.region}`} className="rounded-2xl border p-5">
                                    <p className="font-medium">{cleanText(target.organization)}</p>
                                    <p className="mt-1 text-sm text-primary">{cleanText(target.region)}</p>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                      {cleanText(target.opportunity_type)}. {cleanText(target.why_target)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-5 md:grid-cols-2">
                              <div className="rounded-2xl bg-muted/60 p-5">
                                <p className="font-medium">{t("internship.cv")}</p>
                                <DetailList items={stage.cv_preparation} />
                              </div>
                              <div className="rounded-2xl bg-muted/60 p-5">
                                <p className="font-medium">{t("internship.knowledge")}</p>
                                <DetailList items={stage.applied_knowledge} />
                              </div>
                              <div className="rounded-2xl bg-muted/60 p-5">
                                <p className="font-medium">{t("internship.interview")}</p>
                                <DetailList items={stage.interview_preparation} />
                              </div>
                              <div className="rounded-2xl bg-muted/60 p-5">
                                <p className="font-medium">{t("internship.success")}</p>
                                <DetailList items={stage.success_metrics} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-6">
                            <div>
                              <p className="font-medium">{t("fullTime.roles")}</p>
                              <div className="mt-3 flex flex-col gap-4">
                                {stage.target_roles.map((role) => (
                                  <div key={role.role_name} className="rounded-2xl border p-5">
                                    <p className="font-medium">{cleanText(role.role_name)}</p>
                                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                                      <div>
                                        <p className="text-sm font-medium">{t("fullTime.responsibilities")}</p>
                                        <DetailList items={role.responsibilities} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium">{t("fullTime.salary")}</p>
                                        <DetailList items={role.salary_and_benefits_basis} />
                                      </div>
                                    </div>
                                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                                      {t("fullTime.readiness", {
                                        value: cleanText(role.readiness_signal),
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-muted/60 p-5">
                              <p className="font-medium">{t("fullTime.first90")}</p>
                              <DetailList items={stage.first_90_days} />
                            </div>

                            <div>
                              <p className="font-medium">{t("fullTime.promotion")}</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stage.promotion_path.map((step) => (
                                  <div key={step.target_position} className="rounded-2xl border p-5">
                                    <p className="font-medium">{cleanText(step.target_position)}</p>
                                    <p className="mt-1 text-sm text-primary">
                                      {cleanText(step.expected_timeline)}
                                    </p>
                                    <DetailList items={step.capabilities_to_build} />
                                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                      {t("fullTime.readinessProof", {
                                        value: cleanText(step.proof_of_readiness),
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        </AccordionContent>
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <BriefcaseBusiness aria-hidden="true" className="size-4 text-primary" />
                    {t("relatedJobsTitle")}
                  </h3>
                  <form action={relatedJobsAction}>
                    <input type="hidden" name="pathTitle" value={recommendation.path_title} />
                    <input type="hidden" name="location" value={location} />
                    <input
                      type="hidden"
                      name="skills"
                      value={recommendation.skill_gaps.map((gap) => gap.skill).join(", ")}
                    />
                    <Button type="submit" variant="outline" disabled={findingJobs}>
                      <Search data-icon="inline-start" />
                      {findingJobs ? t("jobSearchLoading") : t("jobSearchButton")}
                    </Button>
                  </form>
                </div>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">
                  {t("jobSearchDescription", { location })}
                </p>
                {relatedJobsState.status === "error" ? (
                  <p role="alert" className="text-sm text-destructive">
                    {relatedJobsState.message ?? t("jobSearchFailed")}
                  </p>
                ) : null}
                {relatedJobsState.jobs.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {relatedJobsState.jobs.map((job) => (
                      <a
                        key={job.url}
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border p-5 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{cleanText(job.title)}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {cleanText(job.company)} | {cleanText(job.location)}
                            </p>
                          </div>
                          <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {cleanText(job.reason)}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {job.platform}
                          {job.postedAt ? ` | ${job.postedAt}` : ""}
                        </p>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>

            <CardFooter className="flex-col items-stretch gap-5 border-t bg-card px-6 py-5 sm:flex-row sm:items-center sm:px-8">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <CircleHelp aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {cleanText(recommendation.autonomy_note)}
                </p>
              </div>
              <form action={applyRoadmapToJourneyAction} className="shrink-0">
                <input type="hidden" name="roadmapId" value={roadmapId} />
                <Button type="submit" size="lg">
                  <Milestone data-icon="inline-start" />
                  {t("applyToJourney")}
                </Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>

      {output.recommendations.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("otherDirectionsTitle")}</CardTitle>
            <CardDescription>{t("otherDirectionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {output.recommendations.map((recommendation, recommendationIndex) => (
              <div key={`${recommendation.path_title}-${recommendationIndex}`} className="flex flex-col gap-4 rounded-xl border p-5">
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{t(`category.${recommendation.path_category}`)}</Badge>
                    {recommendationIndex === selectedIndex ? (
                      <Badge>{t("selected")}</Badge>
                    ) : null}
                  </div>
                  <p className="font-medium">{cleanText(recommendation.path_title)}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("fitValue", { value: recommendation.fit_score })}
                  </p>
                </div>
                {recommendationIndex !== selectedIndex ? (
                  <form action={selectCareerRecommendationAction}>
                    <input type="hidden" name="roadmapId" value={roadmapId} />
                    <input type="hidden" name="recommendationIndex" value={recommendationIndex} />
                    <Button type="submit" variant="outline">
                      {t("chooseDirection")}
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {output.questions_to_improve_recommendation.length > 0 ? (
        <Card className="rounded-[2rem] shadow-none">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle>{t("followUpTitle")}</CardTitle>
            <CardDescription>{t("followUpDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 sm:px-8">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              {output.questions_to_improve_recommendation.map((question, index) => (
                <li key={question} className="grid grid-cols-[2rem_1fr] gap-3 border-t pt-4 first:border-t-0 first:pt-0">
                  <span className="font-mono text-foreground/45">0{index + 1}</span>
                  {cleanText(question)}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
