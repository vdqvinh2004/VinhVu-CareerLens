"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  BookOpenCheck,
  Check,
  CircleAlert,
  Database,
  ExternalLink,
  FileSearch,
  LockKeyhole,
  Pencil,
  Plus,
  Route,
  Sparkles,
  SquareCheckBig,
} from "lucide-react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CareerLensStoredFormValues } from "@/lib/careerlens/form";
import type {
  CareerRoadmapSummary,
  FollowedCareerRoadmapSummary,
  SavedCareerRoadmap,
} from "@/lib/careerlens/roadmaps";
import type {
  CareerRecommendation,
  CareerGuidanceOutput,
  CareerStartingPointSnapshot,
} from "@/lib/careerlens/schemas";

import {
  followCareerRoadmapAction,
  generateCareerPlanAction,
  stopFollowingCareerRoadmapAction,
  toggleCareerRoadmapTaskAction,
  type CareerLensActionState,
} from "../actions";
import { CareerPlanResults } from "./career-plan-results";
import { InterestProfileFields } from "./interest-profile-fields";
import { ProvinceCombobox } from "./province-combobox";
import { StartingPointSummary } from "./starting-point-summary";

const initialState: CareerLensActionState = { status: "idle" };

const intentOptions = [
  "initial_guidance",
  "switch_major",
  "find_jobs",
  "compare_paths",
  "roadmap_detail",
] as const;

const workEnvironmentOptions = [
  "hybrid",
  "team_based",
  "independent",
  "hands_on",
  "fieldwork",
  "office",
  "remote",
] as const;

const learningStyleOptions = [
  "project_based",
  "mentor_guided",
  "self_paced",
  "classroom",
  "apprenticeship",
] as const;

const fieldStep: Record<string, number> = {
  consent: 0,
  activity: 1,
  currentRegion: 1,
  educationLevel: 1,
  languages: 1,
  strongSubject: 1,
  subjectScore: 1,
  targetRegion: 1,
  interests: 2,
  familyConstraints: 3,
  learningStyle: 3,
  targetBudget: 3,
  weeklyHours: 3,
  workEnvironment: 3,
  intent: 4,
  question: 4,
};

function recommendationTasks(recommendation: CareerRecommendation): FollowTask[] {
  return recommendation.roadmap.flatMap((stage) => {
    const prefix = `${stage.stage_order}-${stage.stage_type}`;
    if (stage.stage_type === "learning") {
      return [
        ...stage.subjects.map((subject, index) => ({
          id: `${prefix}-subject-${index}`,
          stage: stage.stage_name,
          title: subject.subject_name,
          detail: subject.evidence_of_completion,
        })),
        ...stage.certificates.map((certificate, index) => ({
          id: `${prefix}-certificate-${index}`,
          stage: stage.stage_name,
          title: certificate.certificate_name,
          detail: certificate.target_time,
        })),
        ...stage.research_and_competitions.map((activity, index) => ({
          id: `${prefix}-activity-${index}`,
          stage: stage.stage_name,
          title: activity.activity_name,
          detail: activity.evidence_of_completion,
        })),
        ...stage.milestones.map((milestone, index) => ({
          id: `${prefix}-milestone-${index}`,
          stage: stage.stage_name,
          title: milestone,
          detail: stage.time_limit,
        })),
      ];
    }

    if (stage.stage_type === "internship") {
      return [
        ...stage.cv_preparation.map((task, index) => ({
          id: `${prefix}-cv-${index}`,
          stage: stage.stage_name,
          title: task,
          detail: stage.time_limit,
        })),
        ...stage.applied_knowledge.map((task, index) => ({
          id: `${prefix}-apply-${index}`,
          stage: stage.stage_name,
          title: task,
          detail: stage.success_metrics[0] ?? stage.time_limit,
        })),
        ...stage.interview_preparation.map((task, index) => ({
          id: `${prefix}-interview-${index}`,
          stage: stage.stage_name,
          title: task,
          detail: stage.time_limit,
        })),
      ];
    }

    return [
      ...stage.first_90_days.map((task, index) => ({
        id: `${prefix}-first90-${index}`,
        stage: stage.stage_name,
        title: task,
        detail: stage.time_limit,
      })),
      ...stage.promotion_path.map((step, index) => ({
        id: `${prefix}-promotion-${index}`,
        stage: stage.stage_name,
        title: step.target_position,
        detail: step.proof_of_readiness,
      })),
    ];
  });
}

function recommendationResources(recommendation: CareerRecommendation) {
  return recommendation.reference_documents.slice(0, 8);
}

type GeneratedPlan = {
  formValues: CareerLensStoredFormValues;
  id: string;
  output: CareerGuidanceOutput;
  selectedRecommendationIndex: number;
};

type ActivePlan = {
  location: string;
  id: string;
  title: string;
  output: CareerGuidanceOutput;
  selectedRecommendationIndex: number;
  updatedAt: string;
};

type CareerWorkspaceProps = {
  followedRoadmap: SavedCareerRoadmap | null;
  followedRoadmapHistory: FollowedCareerRoadmapSummary[];
  marketOverview: {
    postingCount: number;
    regionCount: number;
    roleCountPerRegion: number;
    industryCount: number;
    sourceDate: string;
  };
  newRoadmapDefaults: CareerLensStoredFormValues | null;
  provinces: string[];
  reuseLatestRoadmapData: boolean;
  savedRoadmap: SavedCareerRoadmap | null;
  savedRoadmaps: CareerRoadmapSummary[];
  startingPoint: CareerStartingPointSnapshot;
};

type FollowTask = {
  id: string;
  stage: string;
  title: string;
  detail: string;
};

type RoadmapWizardProps = {
  defaults: CareerLensStoredFormValues | null;
  marketOverview: CareerWorkspaceProps["marketOverview"];
  mode: "new" | "edit";
  provinces: string[];
  roadmapId?: string;
  startingPoint: CareerStartingPointSnapshot;
  onCancel?: () => void;
  onSaved: (plan: GeneratedPlan) => void;
};

function PlanSkeleton() {
  const t = useTranslations("Roadmap");

  return (
    <section aria-label={t("loading")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function RoadmapWizard({
  defaults,
  marketOverview,
  mode,
  provinces,
  roadmapId,
  startingPoint,
  onCancel,
  onSaved,
}: RoadmapWizardProps) {
  const format = useFormatter();
  const t = useTranslations("Roadmap");
  const [step, setStep] = useState(0);
  const [educationLevel, setEducationLevel] = useState<string | null>(
    defaults?.educationLevel ?? null,
  );
  const [workEnvironment, setWorkEnvironment] = useState<string | null>(
    defaults?.workEnvironment ?? "team_based",
  );
  const [learningStyle, setLearningStyle] = useState<string | null>(
    defaults?.learningStyle ?? "project_based",
  );
  const [intent, setIntent] = useState<string | null>(
    defaults?.intent ?? null,
  );
  const [state, formAction, pending] = useActionState(
    generateCareerPlanAction,
    initialState,
  );

  const educationItems = [
    { value: "THPT", label: t("form.educationOptions.THPT") },
    { value: "college", label: t("form.educationOptions.college") },
    { value: "university", label: t("form.educationOptions.university") },
    { value: "graduate", label: t("form.educationOptions.graduate") },
    { value: "other", label: t("form.educationOptions.other") },
  ];
  const workEnvironmentItems = workEnvironmentOptions.map((value) => ({
    value,
    label: t(`form.options.workEnvironment.${value}`),
  }));
  const learningStyleItems = learningStyleOptions.map((value) => ({
    value,
    label: t(`form.options.learningStyle.${value}`),
  }));
  const intentItems = intentOptions.map((value) => ({
    value,
    label: t(`form.options.intent.${value}`),
  }));
  const stepItems = [
    {
      title: t("wizard.confirm.title"),
      description: t("wizard.confirm.description"),
    },
    {
      title: t("wizard.foundation.title"),
      description: t("wizard.foundation.description"),
    },
    {
      title: t("wizard.interests.title"),
      description: t("wizard.interests.description"),
    },
    {
      title: t("wizard.conditions.title"),
      description: t("wizard.conditions.description"),
    },
    {
      title: t("wizard.goal.title"),
      description: t("wizard.goal.description"),
    },
  ];

  useEffect(() => {
    if (
      state.status === "success" &&
      state.output &&
      state.roadmapId &&
      state.formValues
    ) {
      onSaved({
        formValues: state.formValues,
        id: state.roadmapId,
        output: state.output,
        selectedRecommendationIndex:
          state.selectedRecommendationIndex ?? 0,
      });
    }
  }, [onSaved, state.formValues, state.output, state.roadmapId, state.selectedRecommendationIndex, state.status]);

  function fieldError(field: string) {
    return state.fieldErrors?.[field]?.[0];
  }

  const firstErrorField = state.fieldErrors
    ? Object.keys(state.fieldErrors)[0]
    : undefined;
  const firstErrorStep = firstErrorField
    ? fieldStep[firstErrorField] ?? 0
    : undefined;
  const errorMessages = state.fieldErrors
    ? [...new Set(Object.values(state.fieldErrors).flat())]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Badge variant="secondary">
                {mode === "edit" ? t("wizard.editBadge") : t("wizard.newBadge")}
              </Badge>
              <CardTitle className="text-2xl">{t("wizard.title")}</CardTitle>
              <CardDescription>{t("wizard.description")}</CardDescription>
            </div>
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("wizard.cancel")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label={t("wizard.progressLabel")}>
            {stepItems.map((item, index) => (
              <li
                key={item.title}
                aria-current={step === index ? "step" : undefined}
                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
              >
                {index < step ? <Check aria-hidden="true" /> : null}
                <span className={step === index ? "font-medium" : "text-muted-foreground"}>
                  {item.title}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <Card>
          <form action={formAction} noValidate>
            {roadmapId ? <input type="hidden" name="roadmapId" value={roadmapId} /> : null}
            <CardHeader>
              <CardTitle>{stepItems[step].title}</CardTitle>
              <CardDescription>{stepItems[step].description}</CardDescription>
            </CardHeader>

            <CardContent>
              {state.status === "error" && errorMessages.length > 0 ? (
                <Alert variant="destructive" className="mb-6">
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>{state.message}</AlertTitle>
                  <AlertDescription>
                    <ul className="flex list-disc flex-col gap-1 pl-4">
                      {errorMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              <FieldSet hidden={step !== 0}>
                <FieldLegend>{t("wizard.confirm.title")}</FieldLegend>
                <FieldDescription>{t("wizard.confirm.hint")}</FieldDescription>
                <div className="mt-5">
                  <StartingPointSummary snapshot={startingPoint} />
                </div>
                <FieldGroup className="mt-6">
                  <Field orientation="horizontal" data-invalid={Boolean(fieldError("consent")) || undefined}>
                    <Checkbox
                      id="careerlens-consent"
                      name="consent"
                      defaultChecked
                      required
                      aria-invalid={Boolean(fieldError("consent")) || undefined}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="careerlens-consent">
                        {t("wizard.confirm.consent")}
                      </FieldLabel>
                      <FieldDescription>{t("wizard.confirm.consentHint")}</FieldDescription>
                      <FieldError>{fieldError("consent")}</FieldError>
                    </FieldContent>
                  </Field>
                  <Link
                    href="/dashboard/starting-point"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Pencil data-icon="inline-start" />
                    {t("wizard.confirm.editStartingPoint")}
                  </Link>
                </FieldGroup>
              </FieldSet>

              <FieldSet hidden={step !== 1}>
                <FieldLegend>{t("wizard.foundation.title")}</FieldLegend>
                <FieldDescription>{t("wizard.foundation.hint")}</FieldDescription>
                <FieldGroup className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field data-invalid={Boolean(fieldError("educationLevel")) || undefined}>
                    <FieldLabel htmlFor="careerlens-education">{t("form.educationLevel")}</FieldLabel>
                    <Select
                      items={educationItems}
                      name="educationLevel"
                      value={educationLevel}
                      onValueChange={setEducationLevel}
                    >
                      <SelectTrigger id="careerlens-education" className="w-full" aria-invalid={Boolean(fieldError("educationLevel")) || undefined}>
                        <SelectValue placeholder={t("form.optionalSelect")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {educationItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{fieldError("educationLevel")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("languages")) || undefined}>
                    <FieldLabel htmlFor="careerlens-languages">{t("form.languages")}</FieldLabel>
                    <Input
                      id="careerlens-languages"
                      name="languages"
                      defaultValue={defaults?.languages ?? ""}
                      placeholder={t("form.languagesPlaceholder")}
                      aria-invalid={Boolean(fieldError("languages")) || undefined}
                    />
                    <FieldDescription>{t("form.languagesHint")}</FieldDescription>
                    <FieldError>{fieldError("languages")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("currentRegion")) || undefined}>
                    <FieldLabel htmlFor="careerlens-current-region">{t("form.currentRegion")}</FieldLabel>
                    <ProvinceCombobox
                      provinces={provinces}
                      id="careerlens-current-region"
                      name="currentRegion"
                      defaultValue={defaults?.currentRegion || undefined}
                      invalid={Boolean(fieldError("currentRegion"))}
                    />
                    <FieldError>{fieldError("currentRegion")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("targetRegion")) || undefined}>
                    <FieldLabel htmlFor="careerlens-target-region">{t("form.targetRegion")}</FieldLabel>
                    <ProvinceCombobox
                      provinces={provinces}
                      id="careerlens-target-region"
                      name="targetRegion"
                      defaultValue={defaults?.targetRegion || undefined}
                      invalid={Boolean(fieldError("targetRegion"))}
                    />
                    <FieldError>{fieldError("targetRegion")}</FieldError>
                  </Field>

                  <div className="md:col-span-2">
                    <InterestProfileFields
                      defaultSubject={defaults?.strongSubject}
                      defaultScore={defaults?.subjectScore}
                      defaultInterests={defaults?.interests}
                      subjectError={fieldError("strongSubject")}
                      scoreError={fieldError("subjectScore")}
                      interestsError={undefined}
                      showInterests={false}
                    />
                  </div>

                  <Field className="md:col-span-2" data-invalid={Boolean(fieldError("activity")) || undefined}>
                    <FieldLabel htmlFor="careerlens-activity">{t("form.activity")}</FieldLabel>
                    <Textarea
                      id="careerlens-activity"
                      name="activity"
                      rows={4}
                      defaultValue={defaults?.activity}
                      placeholder={t("form.activityPlaceholder")}
                      aria-invalid={Boolean(fieldError("activity")) || undefined}
                    />
                    <FieldError>{fieldError("activity")}</FieldError>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet hidden={step !== 2}>
                <FieldLegend>{t("wizard.interests.title")}</FieldLegend>
                <FieldDescription>{t("wizard.interests.hint")}</FieldDescription>
                <FieldGroup className="mt-5">
                  <InterestProfileFields
                    defaultSubject={defaults?.strongSubject}
                    defaultScore={defaults?.subjectScore}
                    defaultInterests={defaults?.interests}
                    subjectError={undefined}
                    scoreError={undefined}
                    interestsError={fieldError("interests")}
                    showSubject={false}
                  />
                </FieldGroup>
              </FieldSet>

              <FieldSet hidden={step !== 3}>
                <FieldLegend>{t("wizard.conditions.title")}</FieldLegend>
                <FieldDescription>{t("wizard.conditions.hint")}</FieldDescription>
                <FieldGroup className="mt-5 grid gap-5 md:grid-cols-2">
                  <Field data-invalid={Boolean(fieldError("weeklyHours")) || undefined}>
                    <FieldLabel htmlFor="careerlens-hours">{t("form.weeklyHours")}</FieldLabel>
                    <Input
                      id="careerlens-hours"
                      name="weeklyHours"
                      type="number"
                      min="0"
                      max="80"
                      defaultValue={defaults?.weeklyHours ?? 10}
                      aria-invalid={Boolean(fieldError("weeklyHours")) || undefined}
                    />
                    <FieldError>{fieldError("weeklyHours")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("targetBudget")) || undefined}>
                    <FieldLabel htmlFor="careerlens-budget">{t("form.budget")}</FieldLabel>
                    <Input
                      id="careerlens-budget"
                      name="targetBudget"
                      defaultValue={defaults?.targetBudget}
                      placeholder={t("form.budgetPlaceholder")}
                      aria-invalid={Boolean(fieldError("targetBudget")) || undefined}
                    />
                    <FieldError>{fieldError("targetBudget")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("workEnvironment")) || undefined}>
                    <FieldLabel htmlFor="careerlens-work-env">{t("form.workEnvironment")}</FieldLabel>
                    <Select
                      items={workEnvironmentItems}
                      name="workEnvironment"
                      value={workEnvironment}
                      onValueChange={setWorkEnvironment}
                    >
                      <SelectTrigger id="careerlens-work-env" className="w-full" aria-invalid={Boolean(fieldError("workEnvironment")) || undefined}>
                        <SelectValue placeholder={t("form.optionalSelect")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {workEnvironmentItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{fieldError("workEnvironment")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("learningStyle")) || undefined}>
                    <FieldLabel htmlFor="careerlens-learning-style">{t("form.learningStyle")}</FieldLabel>
                    <Select
                      items={learningStyleItems}
                      name="learningStyle"
                      value={learningStyle}
                      onValueChange={setLearningStyle}
                    >
                      <SelectTrigger id="careerlens-learning-style" className="w-full" aria-invalid={Boolean(fieldError("learningStyle")) || undefined}>
                        <SelectValue placeholder={t("form.optionalSelect")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {learningStyleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{fieldError("learningStyle")}</FieldError>
                  </Field>

                  <Field className="md:col-span-2" data-invalid={Boolean(fieldError("familyConstraints")) || undefined}>
                    <FieldLabel htmlFor="careerlens-constraints">{t("form.constraints")}</FieldLabel>
                    <Textarea
                      id="careerlens-constraints"
                      name="familyConstraints"
                      rows={3}
                      defaultValue={defaults?.familyConstraints}
                      placeholder={t("form.constraintsPlaceholder")}
                      aria-invalid={Boolean(fieldError("familyConstraints")) || undefined}
                    />
                    <FieldError>{fieldError("familyConstraints")}</FieldError>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet hidden={step !== 4}>
                <FieldLegend>{t("wizard.goal.title")}</FieldLegend>
                <FieldDescription>{t("wizard.goal.hint")}</FieldDescription>
                <FieldGroup className="mt-5">
                  <Field data-invalid={Boolean(fieldError("intent")) || undefined}>
                    <FieldLabel htmlFor="careerlens-intent">{t("form.intent")}</FieldLabel>
                    <Select
                      items={intentItems}
                      name="intent"
                      value={intent}
                      onValueChange={setIntent}
                    >
                      <SelectTrigger id="careerlens-intent" className="w-full" aria-invalid={Boolean(fieldError("intent")) || undefined}>
                        <SelectValue placeholder={t("form.optionalSelect")} />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {intentItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldError>{fieldError("intent")}</FieldError>
                  </Field>

                  <Field data-invalid={Boolean(fieldError("question")) || undefined}>
                    <FieldLabel htmlFor="careerlens-question">{t("form.question")}</FieldLabel>
                    <Textarea
                      id="careerlens-question"
                      name="question"
                      rows={5}
                      defaultValue={defaults?.question}
                      placeholder={t("form.questionPlaceholder")}
                      aria-invalid={Boolean(fieldError("question")) || undefined}
                    />
                    <FieldError>{fieldError("question")}</FieldError>
                  </Field>
                </FieldGroup>
              </FieldSet>
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-h-6" aria-live="polite">
                {state.status === "error" && errorMessages.length === 0 ? (
                  <p className="text-sm text-destructive">{state.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("form.footerHint")}</p>
                )}
              </div>
              <div className="flex gap-2">
                {state.status === "error" &&
                firstErrorStep !== undefined &&
                firstErrorStep !== step ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(firstErrorStep)}
                  >
                    {t("wizard.reviewErrors")}
                  </Button>
                ) : null}
                {step > 0 ? (
                  <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>
                    <ArrowLeft data-icon="inline-start" />
                    {t("wizard.back")}
                  </Button>
                ) : null}
                {step < stepItems.length - 1 ? (
                  <Button
                    key="wizard-next"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setStep((current) => current + 1);
                    }}
                  >
                    {t("wizard.next")}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                ) : (
                  <Button
                    key="wizard-submit"
                    type="submit"
                    name="submitAction"
                    value="generate"
                    disabled={pending}
                  >
                    {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                    {pending ? t("form.submitting") : t("form.submit")}
                  </Button>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-8">
          <Card>
            <CardHeader>
              <Database aria-hidden="true" />
              <CardTitle>{t("market.title")}</CardTitle>
              <CardDescription>{t("market.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <p className="font-mono text-4xl font-semibold">{format.number(marketOverview.postingCount)}</p>
                <p className="text-sm text-muted-foreground">{t("market.postings")}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                {[
                  [marketOverview.regionCount, t("market.regions")],
                  [marketOverview.roleCountPerRegion, t("market.roles")],
                  [marketOverview.industryCount, t("market.industries")],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-mono text-xl font-semibold">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileSearch aria-hidden="true" />
                {t("market.sourceDate", { date: marketOverview.sourceDate })}
              </p>
            </CardContent>
          </Card>

          <Alert>
            <LockKeyhole aria-hidden="true" />
            <AlertTitle>{t("privacy.title")}</AlertTitle>
            <AlertDescription>{t("privacy.description")}</AlertDescription>
          </Alert>
        </aside>
      </div>

      {pending ? <PlanSkeleton /> : null}
    </div>
  );
}

function FollowRoadmapDialog({
  disabled,
  hasActiveRoadmap,
  roadmapId,
}: {
  disabled: boolean;
  hasActiveRoadmap: boolean;
  roadmapId: string;
}) {
  const t = useTranslations("Roadmap.follow");

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button disabled={disabled} />}>
        <Route data-icon="inline-start" />
        {disabled ? t("following") : t("start")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveRoadmap ? t("confirmReplace") : t("confirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={followCareerRoadmapAction}>
            <input type="hidden" name="roadmapId" value={roadmapId} />
            <AlertDialogAction type="submit">{t("confirmAction")}</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StopFollowingDialog() {
  const t = useTranslations("Roadmap.follow");

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        {t("stop")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("stopTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("stopDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={stopFollowingCareerRoadmapAction}>
            <AlertDialogAction type="submit" variant="destructive">
              {t("stopAction")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FollowCurrentRoadmapCard({
  activePlan,
  hasActiveRoadmap,
  isFollowingThisRoadmap,
}: {
  activePlan: ActivePlan;
  hasActiveRoadmap: boolean;
  isFollowingThisRoadmap: boolean;
}) {
  const t = useTranslations("Roadmap.follow");

  return (
    <Alert className="sm:pr-52">
      <Route aria-hidden="true" />
      <AlertTitle>
        {isFollowingThisRoadmap ? t("alreadyTitle") : t("cardTitle")}
      </AlertTitle>
      <AlertDescription>
        {isFollowingThisRoadmap ? t("alreadyDescription") : t("cardDescription")}
      </AlertDescription>
      <AlertAction className="static col-start-2 mt-3 sm:absolute sm:mt-0">
        <FollowRoadmapDialog
          disabled={isFollowingThisRoadmap}
          hasActiveRoadmap={hasActiveRoadmap}
          roadmapId={activePlan.id}
        />
      </AlertAction>
    </Alert>
  );
}

function FollowedRoadmapPanel({
  followedRoadmap,
  history,
}: {
  followedRoadmap: SavedCareerRoadmap | null;
  history: FollowedCareerRoadmapSummary[];
}) {
  const format = useFormatter();
  const t = useTranslations("Roadmap.follow");
  const recommendation = followedRoadmap
    ? followedRoadmap.guidanceOutput.recommendations[followedRoadmap.selectedRecommendationIndex] ??
      followedRoadmap.guidanceOutput.recommendations[0]
    : null;
  const tasks = recommendation ? recommendationTasks(recommendation) : [];
  const done = new Set(followedRoadmap?.followProgress ?? []);
  const completedCount = tasks.filter((task) => done.has(task.id)).length;
  const progress =
    tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
  const resources = recommendation ? recommendationResources(recommendation) : [];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <div className="flex flex-col gap-6">
        {followedRoadmap && recommendation ? (
          <>
            <Card>
              <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge>{t("activeBadge")}</Badge>
                    <CardTitle className="mt-3 text-2xl">{recommendation.path_title}</CardTitle>
                    <CardDescription className="mt-2">
                      {t("startedAt", {
                        date: followedRoadmap.followedAt
                          ? format.dateTime(new Date(followedRoadmap.followedAt), {
                              dateStyle: "medium",
                            })
                          : t("unknownDate"),
                      })}
                    </CardDescription>
                  </div>
                  <StopFollowingDialog />
                </div>
                <Progress value={progress}>
                  <ProgressLabel>{t("progress")}</ProgressLabel>
                  <ProgressValue>{() => `${progress}%`}</ProgressValue>
                </Progress>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("tasksTitle")}</CardTitle>
                <CardDescription>{t("tasksDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {tasks.map((task) => {
                  const completed = done.has(task.id);

                  return (
                    <article key={task.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{task.stage}</p>
                        <h3 className="mt-1 font-medium">{task.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{task.detail}</p>
                      </div>
                      <form action={toggleCareerRoadmapTaskAction}>
                        <input type="hidden" name="roadmapId" value={followedRoadmap.id} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="done" value={completed ? "false" : "true"} />
                        <Button type="submit" variant={completed ? "secondary" : "outline"} size="sm">
                          <SquareCheckBig data-icon="inline-start" />
                          {completed ? t("done") : t("markDone")}
                        </Button>
                      </form>
                    </article>
                  );
                })}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <Badge variant="secondary">{t("emptyBadge")}</Badge>
              <CardTitle>{t("emptyTitle")}</CardTitle>
              <CardDescription>{t("emptyDescription")}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck aria-hidden="true" className="size-4" />
              {t("resourcesTitle")}
            </CardTitle>
            <CardDescription>{t("resourcesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {resources.length > 0 ? (
              resources.map((resource) => (
                <a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink data-icon="inline-start" />
                  {resource.title}
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("noResources")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("historyTitle")}</CardTitle>
            <CardDescription>{t("historyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history.length > 0 ? (
              history.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/careerlens?roadmap=${item.id}`}
                  className="rounded-xl border p-4 text-sm hover:bg-muted/60"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {item.isFollowing
                      ? t("historyActive")
                      : item.stoppedFollowingAt
                        ? t("historyStopped", {
                            date: format.dateTime(new Date(item.stoppedFollowingAt), {
                              dateStyle: "medium",
                            }),
                          })
                        : t("historyStarted", {
                            date: item.followedAt
                              ? format.dateTime(new Date(item.followedAt), {
                                  dateStyle: "medium",
                                })
                              : t("unknownDate"),
                          })}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export function CareerWorkspace({
  followedRoadmap,
  followedRoadmapHistory,
  marketOverview,
  newRoadmapDefaults,
  provinces,
  reuseLatestRoadmapData,
  savedRoadmap,
  savedRoadmaps,
  startingPoint,
}: CareerWorkspaceProps) {
  const format = useFormatter();
  const t = useTranslations("Roadmap");
  const [mode, setMode] = useState<"view" | "new" | "edit">(
    savedRoadmap ? "view" : "new",
  );
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleSaved = useCallback((plan: GeneratedPlan) => {
    setGeneratedPlan(plan);
    setMode("view");
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const activePlan: ActivePlan | null = generatedPlan
    ? {
        id: generatedPlan.id,
        location: generatedPlan.formValues.targetRegion || generatedPlan.formValues.currentRegion,
        title:
          generatedPlan.output.recommendations[
            generatedPlan.selectedRecommendationIndex
          ]?.path_title ?? t("saved.defaultTitle"),
        output: generatedPlan.output,
        selectedRecommendationIndex: generatedPlan.selectedRecommendationIndex,
        updatedAt: new Date().toISOString(),
      }
    : savedRoadmap
      ? {
          id: savedRoadmap.id,
          location: savedRoadmap.formValues.targetRegion || savedRoadmap.formValues.currentRegion,
          title: savedRoadmap.title,
          output: savedRoadmap.guidanceOutput,
          selectedRecommendationIndex: savedRoadmap.selectedRecommendationIndex,
          updatedAt: savedRoadmap.updatedAt,
        }
      : null;
  const isFollowingActivePlan = Boolean(
    activePlan && followedRoadmap?.id === activePlan.id,
  );

  if (mode === "new" || mode === "edit") {
    return (
      <RoadmapWizard
        key={mode}
        mode={mode}
        roadmapId={
          mode === "edit"
            ? generatedPlan?.id ?? savedRoadmap?.id
            : undefined
        }
        defaults={
          mode === "edit"
            ? generatedPlan?.formValues ?? savedRoadmap?.formValues ?? null
            : reuseLatestRoadmapData
              ? generatedPlan?.formValues ?? newRoadmapDefaults
              : null
        }
        startingPoint={startingPoint}
        marketOverview={marketOverview}
        provinces={provinces}
        onCancel={activePlan ? () => setMode("view") : undefined}
        onSaved={handleSaved}
      />
    );
  }

  if (!activePlan) {
    return (
      <RoadmapWizard
        mode="new"
        defaults={newRoadmapDefaults}
        startingPoint={startingPoint}
        marketOverview={marketOverview}
        provinces={provinces}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div ref={resultRef} className="flex scroll-mt-6 flex-col gap-10">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex max-w-3xl flex-col gap-2">
              <Badge variant="secondary">{t("saved.badge")}</Badge>
              <CardTitle className="text-2xl sm:text-3xl">{activePlan.title}</CardTitle>
              <CardDescription>
                {t("saved.updatedAt", {
                  date: format.dateTime(new Date(activePlan.updatedAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setMode("edit")}>
                <Pencil data-icon="inline-start" />
                {t("saved.edit")}
              </Button>
              <Button type="button" onClick={() => setMode("new")}>
                <Plus data-icon="inline-start" />
                {t("saved.createNew")}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="roadmap" className="gap-6">
        <TabsList
          aria-label={t("tabs.label")}
          className="w-full justify-start overflow-x-auto sm:w-fit"
        >
          <TabsTrigger value="roadmap">{t("tabs.roadmap")}</TabsTrigger>
          <TabsTrigger value="following">{t("tabs.following")}</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="flex flex-col gap-10">
          {savedRoadmaps.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("saved.listTitle")}</CardTitle>
                <CardDescription>{t("saved.listDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {savedRoadmaps.map((roadmap) => {
                  const selected = roadmap.id === activePlan.id;

                  return (
                    <Link
                      key={roadmap.id}
                      href={`/dashboard/careerlens?roadmap=${roadmap.id}`}
                      aria-current={selected ? "page" : undefined}
                      className={buttonVariants({
                        variant: selected ? "secondary" : "outline",
                        className:
                          "h-auto min-w-0 items-start justify-between gap-4 whitespace-normal px-4 py-3 text-left",
                      })}
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-2 block font-medium">
                          {roadmap.title}
                        </span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          {format.dateTime(new Date(roadmap.updatedAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      {selected ? (
                        <Badge variant="secondary">{t("saved.current")}</Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <BriefcaseBusiness aria-hidden="true" />
                <div>
                  <CardTitle>{t("startingPoint.title")}</CardTitle>
                  <CardDescription>{t("startingPoint.description")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <StartingPointSummary snapshot={startingPoint} />
            </CardContent>
          </Card>

          <CareerPlanResults
            location={activePlan.location}
            output={activePlan.output}
            roadmapId={activePlan.id}
            selectedRecommendationIndex={activePlan.selectedRecommendationIndex}
          />

          <FollowCurrentRoadmapCard
            activePlan={activePlan}
            hasActiveRoadmap={Boolean(followedRoadmap)}
            isFollowingThisRoadmap={isFollowingActivePlan}
          />
        </TabsContent>

        <TabsContent value="following">
          <FollowedRoadmapPanel
            followedRoadmap={followedRoadmap}
            history={followedRoadmapHistory}
          />
        </TabsContent>
      </Tabs>

      <Alert className="sm:pr-52">
        <Route aria-hidden="true" />
        <AlertTitle>{t("saved.newTitle")}</AlertTitle>
        <AlertDescription>{t("saved.newDescription")}</AlertDescription>
        <AlertAction className="static col-start-2 mt-3 sm:absolute sm:mt-0">
          <Button type="button" size="sm" onClick={() => setMode("new")}>
            <Plus data-icon="inline-start" />
            {t("saved.createNew")}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
