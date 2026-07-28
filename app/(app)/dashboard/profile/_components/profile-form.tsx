"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import {
  updateProfileAction,
  type ProfileActionState,
} from "../actions";

const monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const initialState: ProfileActionState = { status: "idle" };

type ProfileFormProps = {
  currentYear: number;
  profile: {
    birthDay: number;
    birthMonth: number;
    birthYear: number;
    email: string;
    fullName: string;
  };
};

function ProfileForm({ currentYear, profile }: ProfileFormProps) {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  function fieldError(field: string) {
    return state.fieldErrors?.[field]?.[0];
  }

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>{t("form.title")}</CardTitle>
          <CardDescription>{t("form.description")}</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(fieldError("fullName")) || undefined}>
              <FieldLabel htmlFor="profile-full-name">
                {t("form.fullName")}
              </FieldLabel>
              <Input
                id="profile-full-name"
                name="fullName"
                autoComplete="name"
                defaultValue={profile.fullName}
                aria-invalid={Boolean(fieldError("fullName")) || undefined}
                required
              />
              <FieldDescription>{t("form.fullNameHint")}</FieldDescription>
              <FieldError>{fieldError("fullName")}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldError("email")) || undefined}>
              <FieldLabel htmlFor="profile-email">{t("form.email")}</FieldLabel>
              <Input
                id="profile-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={profile.email}
                aria-invalid={Boolean(fieldError("email")) || undefined}
                required
              />
              <FieldDescription>{t("form.emailHint")}</FieldDescription>
              <FieldError>{fieldError("email")}</FieldError>
            </Field>

            <FieldSet>
              <FieldLegend variant="label">{t("form.dateOfBirth")}</FieldLegend>
              <FieldDescription>{t("form.dateOfBirthHint")}</FieldDescription>
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field
                  data-invalid={
                    Boolean(
                      fieldError("birthYear") || fieldError("birthDate"),
                    ) || undefined
                  }
                >
                  <FieldLabel htmlFor="profile-birth-year">
                    {t("form.birthYear")}
                  </FieldLabel>
                  <Input
                    id="profile-birth-year"
                    name="birthYear"
                    type="number"
                    inputMode="numeric"
                    autoComplete="bday-year"
                    min={1900}
                    max={currentYear}
                    defaultValue={profile.birthYear}
                    aria-invalid={
                      Boolean(
                        fieldError("birthYear") || fieldError("birthDate"),
                      ) || undefined
                    }
                    required
                  />
                  <FieldError>{fieldError("birthYear")}</FieldError>
                </Field>

                <Field
                  data-invalid={
                    Boolean(
                      fieldError("birthMonth") || fieldError("birthDate"),
                    ) || undefined
                  }
                >
                  <FieldLabel htmlFor="profile-birth-month">
                    {t("form.birthMonth")}
                  </FieldLabel>
                  <NativeSelect
                    id="profile-birth-month"
                    name="birthMonth"
                    autoComplete="bday-month"
                    defaultValue={profile.birthMonth}
                    aria-invalid={
                      Boolean(
                        fieldError("birthMonth") || fieldError("birthDate"),
                      ) || undefined
                    }
                    required
                  >
                    {monthNumbers.map((month) => (
                      <option key={month} value={month}>
                        {t(`months.${month}`)}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError>{fieldError("birthMonth")}</FieldError>
                </Field>

                <Field
                  data-invalid={
                    Boolean(
                      fieldError("birthDay") || fieldError("birthDate"),
                    ) || undefined
                  }
                >
                  <FieldLabel htmlFor="profile-birth-day">
                    {t("form.birthDay")}
                  </FieldLabel>
                  <Input
                    id="profile-birth-day"
                    name="birthDay"
                    type="number"
                    inputMode="numeric"
                    autoComplete="bday-day"
                    min={1}
                    max={31}
                    defaultValue={profile.birthDay}
                    aria-invalid={
                      Boolean(
                        fieldError("birthDay") || fieldError("birthDate"),
                      ) || undefined
                    }
                    required
                  />
                  <FieldError>{fieldError("birthDay")}</FieldError>
                </Field>
              </FieldGroup>
              <FieldError>{fieldError("birthDate")}</FieldError>
            </FieldSet>
          </FieldGroup>
        </CardContent>

        <CardFooter className="flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            aria-live="polite"
            className={cn(
              "min-h-5 text-sm",
              state.status === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {state.message && (
              <p className="flex items-center gap-2">
                {state.status === "success" && (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                )}
                {state.message}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <Spinner data-icon="inline-start" aria-label={t("form.saving")} />
            ) : (
              <Save data-icon="inline-start" />
            )}
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export { ProfileForm };
