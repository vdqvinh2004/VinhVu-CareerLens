"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  ListChecks,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import {
  personalityQuestions,
  type PersonalityAnswer,
  type PersonalityType,
} from "@/lib/personality-test";
import type { PersonalityScores } from "@/lib/db/schema";

import {
  submitPersonalityTestAction,
  type PersonalityTestActionState,
} from "../actions";

const initialActionState: PersonalityTestActionState = { status: "idle" };
const questionKeys = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
] as const;

type PersonalityTestProps = {
  currentResult?: PersonalityType;
  initialView?: "intro" | "result";
};

function PersonalityResult({
  result,
  onRetake,
}: {
  result: PersonalityType;
  onRetake: () => void;
}) {
  const t = useTranslations("PersonalityTest");
  const traits = result.split("") as Array<keyof PersonalityScores>;

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </div>
        <CardTitle>{t("result.title")}</CardTitle>
        <CardDescription>{t("result.description")}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="rounded-xl bg-muted/60 p-5">
          <p className="text-4xl font-semibold tracking-tight">{result}</p>
          <p className="mt-1 text-base font-medium">
            {t(`types.${result}.title`)}
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold">{t("result.traitsTitle")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {traits.map((trait) => (
              <div key={trait} className="rounded-xl border border-border/80 p-4">
                <p className="font-medium">
                  {trait} - {t(`traits.${trait}.title`)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t(`traits.${trait}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Alert>
          <BrainCircuit aria-hidden="true" />
          <AlertTitle>{t("result.noteTitle")}</AlertTitle>
          <AlertDescription>{t("result.note")}</AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter className="flex-col-reverse items-stretch gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onRetake}>
          <RotateCcw data-icon="inline-start" />
          {t("result.retake")}
        </Button>
        <Link
          href="/dashboard/starting-point"
          className={buttonVariants({ size: "default" })}
        >
          {t("result.backToProfile")}
          <ArrowRight data-icon="inline-end" />
        </Link>
      </CardFooter>
    </Card>
  );
}

export function PersonalityTest({
  currentResult,
  initialView = "intro",
}: PersonalityTestProps) {
  const t = useTranslations("PersonalityTest");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Array<PersonalityAnswer | null>>(() =>
    personalityQuestions.map(() => null),
  );
  const [showValidation, setShowValidation] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitPersonalityTestAction,
    initialActionState,
  );
  const [dismissedResultState, setDismissedResultState] =
    useState<PersonalityTestActionState | null>(null);
  const [dismissedInitialResult, setDismissedInitialResult] = useState(false);
  const visibleResult =
    initialView === "result" && currentResult && !dismissedInitialResult
      ? currentResult
      : state.status === "success" && state !== dismissedResultState
        ? state.result
        : undefined;

  useEffect(() => {
    if (started) {
      headingRef.current?.focus();
    }
  }, [currentQuestion, started]);

  function resetTest() {
    setAnswers(personalityQuestions.map(() => null));
    setCurrentQuestion(0);
    setShowValidation(false);
    setDismissedResultState(state);
    setDismissedInitialResult(true);
    setStarted(true);
  }

  function updateAnswer(value: unknown) {
    if (value !== "a" && value !== "b") {
      return;
    }

    setAnswers((currentAnswers) => {
      const nextAnswers = [...currentAnswers];
      nextAnswers[currentQuestion] = value;
      return nextAnswers;
    });
    setShowValidation(false);
  }

  function goToNextQuestion() {
    if (!answers[currentQuestion]) {
      setShowValidation(true);
      return;
    }

    setCurrentQuestion((question) => question + 1);
    setShowValidation(false);
  }

  if (visibleResult) {
    return <PersonalityResult result={visibleResult} onRetake={resetTest} />;
  }

  if (!started) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit aria-hidden="true" className="size-6" />
          </div>
          <CardTitle>{t("intro.title")}</CardTitle>
          <CardDescription>{t("intro.description")}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {currentResult ? (
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">
                {t("intro.currentResult")}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {currentResult} - {t(`types.${currentResult}.title`)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border/80 p-4">
              <Clock3 aria-hidden="true" className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium">{t("intro.timeTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("intro.timeDescription")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border/80 p-4">
              <ListChecks
                aria-hidden="true"
                className="mt-0.5 size-5 text-primary"
              />
              <div>
                <p className="font-medium">{t("intro.answerTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("intro.answerDescription")}
                </p>
              </div>
            </div>
          </div>

          <Alert>
            <BrainCircuit aria-hidden="true" />
            <AlertTitle>{t("intro.noteTitle")}</AlertTitle>
            <AlertDescription>{t("intro.note")}</AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="button" size="lg" onClick={() => setStarted(true)}>
            {currentResult ? t("intro.retake") : t("intro.start")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const selectedAnswer = answers[currentQuestion];
  const questionKey = questionKeys[currentQuestion];
  const isLastQuestion = currentQuestion === personalityQuestions.length - 1;
  const progress = Math.round(
    ((currentQuestion + 1) / personalityQuestions.length) * 100,
  );

  return (
    <Card>
      <form action={formAction}>
        {answers.map((answer, index) =>
          answer ? (
            <input
              key={index}
              type="hidden"
              name={`answer-${index}`}
              value={answer}
            />
          ) : null,
        )}

        <CardHeader>
          <Progress value={progress}>
            <ProgressLabel>
              {t("question.progress", {
                current: currentQuestion + 1,
                total: personalityQuestions.length,
              })}
            </ProgressLabel>
            <ProgressValue>
              {(_formattedValue, value) => `${value ?? 0}%`}
            </ProgressValue>
          </Progress>
          <CardTitle
            ref={headingRef}
            tabIndex={-1}
            className="pt-5 text-xl outline-none sm:text-2xl"
          >
            {t(`questions.${questionKey}.prompt`)}
          </CardTitle>
          <CardDescription>{t("question.guidance")}</CardDescription>
        </CardHeader>

        <CardContent>
          <RadioGroup
            aria-label={t(`questions.${questionKey}.prompt`)}
            value={selectedAnswer ?? ""}
            onValueChange={updateAnswer}
          >
            {(["a", "b"] as const).map((answer) => {
              const id = `question-${currentQuestion}-${answer}`;

              return (
                <FieldLabel key={answer} htmlFor={id}>
                  <Field
                    orientation="horizontal"
                    data-invalid={showValidation || undefined}
                  >
                    <RadioGroupItem
                      id={id}
                      value={answer}
                      aria-invalid={showValidation || undefined}
                    />
                    <FieldContent>
                      <FieldTitle>
                        {t(`questions.${questionKey}.${answer}`)}
                      </FieldTitle>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              );
            })}
          </RadioGroup>

          <p
            aria-live="polite"
            className="mt-4 min-h-5 text-sm text-destructive"
          >
            {showValidation
              ? t("question.required")
              : state.status === "error"
                ? state.message
                : null}
          </p>
        </CardContent>

        <CardFooter className="justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={currentQuestion === 0 || pending}
            onClick={() => {
              setCurrentQuestion((question) => question - 1);
              setShowValidation(false);
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("question.back")}
          </Button>

          {isLastQuestion ? (
            <Button
              type="submit"
              disabled={pending}
              onClick={(event) => {
                if (!selectedAnswer) {
                  event.preventDefault();
                  setShowValidation(true);
                }
              }}
            >
              {pending ? (
                <Spinner
                  data-icon="inline-start"
                  aria-label={t("question.submitting")}
                />
              ) : (
                <CheckCircle2 data-icon="inline-start" />
              )}
              {pending ? t("question.submitting") : t("question.finish")}
            </Button>
          ) : (
            <Button type="button" onClick={goToNextQuestion}>
              {t("question.next")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
