"use client";

import {
  useEffect,
  useActionState,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { AuthCard } from "./auth-card";
import { PasswordField } from "./password-field";
import { PresencePanel } from "./presence-panel";
import { signupAction, type AuthActionState } from "../actions";

const monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type SignupValues = {
  email: string;
  fullName: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  password: string;
  passwordConfirmation: string;
  dataConsent: boolean;
};

const initialValues: SignupValues = {
  email: "",
  fullName: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  password: "",
  passwordConfirmation: "",
  dataConsent: false,
};

const initialActionState: AuthActionState = { status: "idle" };

const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 12 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -8 }),
};

type SignupFlowProps = {
  currentYear: number;
};

function SignupFlow({ currentYear }: SignupFlowProps) {
  const t = useTranslations("Auth");
  const steps = [
    t("signup.steps.account"),
    t("signup.steps.about"),
    t("signup.steps.security"),
  ];
  const stepTitles = [
    t("signup.stepTitles.email"),
    t("signup.stepTitles.about"),
    t("signup.stepTitles.password"),
  ];
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState(initialValues);
  const [passwordError, setPasswordError] = useState("");

  async function submitSignup(
    previousState: AuthActionState,
    formData: FormData,
  ) {
    const nextState = await signupAction(previousState, formData);

    if (nextState.fieldErrors?.email?.length) {
      setDirection(-1);
      setStep(0);
    }

    return nextState;
  }

  const [actionState, action, pending] = useActionState(
    submitSignup,
    initialActionState,
  );
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      stepHeadingRef.current?.focus();
      previousStepRef.current = step;
    }
  }, [step]);

  function updateValue(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name } = event.target;
    const value =
      event.target instanceof HTMLInputElement &&
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "password" || name === "passwordConfirmation") {
      setPasswordError("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (step < steps.length - 1) {
      event.preventDefault();
      setDirection(1);
      setStep((current) => current + 1);
      return;
    }

    if (values.password !== values.passwordConfirmation) {
      event.preventDefault();
      setPasswordError(t("common.passwordMismatch"));
    }
  }

  function goBack() {
    setPasswordError("");
    setDirection(-1);
    setStep((current) => Math.max(0, current - 1));
  }

  return (
    <AuthCard
      title={t("signup.title")}
      description={t("signup.description")}
    >
      <div className="mb-7 space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span className="text-muted-foreground">
            {t("signup.stepCount", {
              current: step + 1,
              total: steps.length,
            })}
          </span>
          <span>{steps[step]}</span>
        </div>
        <div
          role="progressbar"
          aria-label={t("signup.progress")}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          className="grid grid-cols-3 gap-2"
        >
          {steps.map((stepLabel, index) => (
            <span
              key={stepLabel}
              aria-hidden="true"
              className="relative h-1 overflow-hidden rounded-full bg-muted"
            >
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-foreground"
                initial={false}
                animate={{ scaleX: index <= step ? 1 : 0 }}
                transition={{ duration: 0.18 }}
              />
            </span>
          ))}
        </div>
      </div>

      <form action={action} onSubmit={handleSubmit} className="space-y-5">
        {step === steps.length - 1 && (
          <>
            <input type="hidden" name="email" value={values.email} />
            <input type="hidden" name="fullName" value={values.fullName} />
            <input type="hidden" name="birthDay" value={values.birthDay} />
            <input type="hidden" name="birthMonth" value={values.birthMonth} />
            <input type="hidden" name="birthYear" value={values.birthYear} />
          </>
        )}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          {stepTitles[step]}
        </h2>

        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <PresencePanel
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18 }}
            className="space-y-5"
          >
            {step === 0 && (
              <div className="grid gap-2">
                <Label htmlFor="signup-email">{t("common.email")}</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={values.email}
                  onChange={updateValue}
                  aria-invalid={Boolean(actionState.fieldErrors?.email)}
                  required
                  autoFocus
                />
                <AnimatePresence initial={false}>
                  {actionState.fieldErrors?.email?.[0] && (
                    <motion.p
                      key={actionState.fieldErrors.email[0]}
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.14 }}
                      className="text-sm text-destructive"
                    >
                      {actionState.fieldErrors.email[0]}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

            {step === 1 && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="signup-name">{t("signup.fullName")}</Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    autoComplete="name"
                    placeholder={t("signup.fullNamePlaceholder")}
                    value={values.fullName}
                    onChange={updateValue}
                    aria-invalid={Boolean(actionState.fieldErrors?.fullName)}
                    required
                  />
                  <AnimatePresence initial={false}>
                    {actionState.fieldErrors?.fullName?.[0] && (
                      <motion.p
                        key={actionState.fieldErrors.fullName[0]}
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -2 }}
                        transition={{ duration: 0.14 }}
                        className="text-sm text-destructive"
                      >
                        {actionState.fieldErrors.fullName[0]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium mb-1">
                    {t("signup.dateOfBirth")}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.8fr)]">
                    <div className="grid gap-2">
                      <Label htmlFor="signup-birth-year" className="sr-only">
                        {t("signup.birthYear")}
                      </Label>
                      <Input
                        id="signup-birth-year"
                        name="birthYear"
                        type="number"
                        inputMode="numeric"
                        autoComplete="bday-year"
                        min={1900}
                        max={currentYear}
                        placeholder={t("signup.year")}
                        value={values.birthYear}
                        onChange={updateValue}
                        aria-invalid={
                          Boolean(
                            actionState.fieldErrors?.birthYear ||
                              actionState.fieldErrors?.birthDate,
                          )
                        }
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="signup-birth-month" className="sr-only">
                        {t("signup.birthMonth")}
                      </Label>
                      <NativeSelect
                        id="signup-birth-month"
                        name="birthMonth"
                        autoComplete="bday-month"
                        value={values.birthMonth}
                        onChange={updateValue}
                        aria-invalid={
                          Boolean(
                            actionState.fieldErrors?.birthMonth ||
                              actionState.fieldErrors?.birthDate,
                          )
                        }
                        required
                      >
                        <option value="" disabled>
                          {t("signup.month")}
                        </option>
                        {monthNumbers.map((month) => (
                          <option key={month} value={month}>
                            {t(`signup.months.${month}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="signup-birth-day" className="sr-only">
                        {t("signup.birthDay")}
                      </Label>
                      <Input
                        id="signup-birth-day"
                        name="birthDay"
                        type="number"
                        inputMode="numeric"
                        autoComplete="bday-day"
                        min={1}
                        max={31}
                        placeholder={t("signup.day")}
                        value={values.birthDay}
                        onChange={updateValue}
                        aria-invalid={
                          Boolean(
                            actionState.fieldErrors?.birthDay ||
                              actionState.fieldErrors?.birthDate,
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                  {actionState.fieldErrors?.birthDate?.[0] && (
                    <p role="alert" className="text-sm text-destructive">
                      {actionState.fieldErrors.birthDate[0]}
                    </p>
                  )}
                </fieldset>
              </>
            )}

            {step === 2 && (
              <>
                <PasswordField
                  id="signup-password"
                  name="password"
                  label={t("common.password")}
                  autoComplete="new-password"
                  minLength={8}
                  value={values.password}
                  onChange={updateValue}
                  aria-invalid={
                    passwordError || actionState.fieldErrors?.password ? true : undefined
                  }
                  aria-describedby={passwordError ? "signup-password-error" : undefined}
                  required
                />
                <PasswordField
                  id="signup-password-confirmation"
                  name="passwordConfirmation"
                  label={t("signup.confirmPassword")}
                  autoComplete="new-password"
                  minLength={8}
                  value={values.passwordConfirmation}
                  onChange={updateValue}
                  aria-invalid={passwordError ? true : undefined}
                  aria-describedby={passwordError ? "signup-password-error" : undefined}
                  required
                />
                <AnimatePresence initial={false}>
                  {(passwordError ||
                    actionState.fieldErrors?.password?.[0] ||
                    actionState.fieldErrors?.passwordConfirmation?.[0]) && (
                    <motion.p
                      key={
                        passwordError ||
                        actionState.fieldErrors?.password?.[0] ||
                        actionState.fieldErrors?.passwordConfirmation?.[0]
                      }
                      id="signup-password-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.14 }}
                      className="text-sm text-destructive"
                    >
                      {passwordError ||
                        actionState.fieldErrors?.password?.[0] ||
                        actionState.fieldErrors?.passwordConfirmation?.[0]}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("signup.passwordHint")}
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-3">
                  <input
                    id="signup-data-consent"
                    name="dataConsent"
                    type="checkbox"
                    value="true"
                    checked={values.dataConsent}
                    onChange={updateValue}
                    required
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <label
                    htmlFor="signup-data-consent"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {t.rich("signup.consent", {
                      terms: (chunks) => (
                        <Link
                          href="/terms"
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link
                          href="/privacy"
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </label>
                </div>
              </>
            )}
          </PresencePanel>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {actionState.message && (
            <motion.p
              key={`${actionState.status}:${actionState.message}`}
              role={actionState.status === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.14 }}
              className={cn(
                "text-sm",
                actionState.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {actionState.message}
            </motion.p>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {actionState.status === "error" && actionState.fieldErrors && (
            <motion.ul
              key="signup-field-errors"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.14 }}
              className="space-y-1 text-sm text-destructive"
            >
              {Array.from(new Set(Object.values(actionState.fieldErrors).flat())).map(
                (message) => (
                  <li key={message}>{message}</li>
                ),
              )}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="flex gap-3 pt-1">
          <AnimatePresence initial={false} mode="popLayout">
            {step > 0 && (
              <motion.div
                key="signup-back"
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.16 }}
                className="flex-1"
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={goBack}
                >
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  {t("signup.back")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div layout transition={{ duration: 0.16 }} className="flex-1">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending
                ? t("signup.submitting")
                : step === steps.length - 1
                  ? (
                    <>
                      <UserPlus data-icon="inline-start" aria-hidden="true" />
                      {t("signup.submit")}
                    </>
                  ) : (
                    <>
                      {t("signup.continue")}
                      <ArrowRight data-icon="inline-end" aria-hidden="true" />
                    </>
                  )}
            </Button>
          </motion.div>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("signup.existingUser")} {" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("signup.login")}
        </Link>
      </p>
    </AuthCard>
  );
}

export { SignupFlow };
