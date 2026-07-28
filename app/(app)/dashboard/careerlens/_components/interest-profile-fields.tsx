"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getInterestSuggestions } from "@/lib/careerlens/interest-suggestions";

type InterestProfileFieldsProps = {
  defaultInterests?: string;
  defaultScore?: number | null;
  defaultSubject?: string;
  showInterests?: boolean;
  showSubject?: boolean;
  subjectError?: string;
  scoreError?: string;
  interestsError?: string;
};

function splitInterests(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function InterestProfileFields({
  defaultInterests = "",
  defaultScore = null,
  defaultSubject = "",
  showInterests = true,
  showSubject = true,
  subjectError,
  scoreError,
  interestsError,
}: InterestProfileFieldsProps) {
  const locale = useLocale() === "en" ? "en" : "vi";
  const t = useTranslations("Roadmap.form");
  const [subject, setSubject] = useState(defaultSubject);
  const [interests, setInterests] = useState(defaultInterests);
  const suggestions = useMemo(() => getInterestSuggestions(subject, locale), [locale, subject]);

  function addSuggestion(suggestion: string) {
    const current = splitInterests(interests);
    const exists = current.some(
      (item) => item.toLocaleLowerCase("vi") === suggestion.toLocaleLowerCase("vi"),
    );

    if (!exists) setInterests([...current, suggestion].join(", "));
  }

  return (
    <>
      {showSubject ? (
        <FieldGroup className="grid gap-5 md:grid-cols-[minmax(0,1fr)_9rem]">
        <Field data-invalid={Boolean(subjectError) || undefined}>
          <FieldLabel htmlFor="careerlens-subject">{t("subject")}</FieldLabel>
          <Input
            id="careerlens-subject"
            name="strongSubject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder={t("subjectPlaceholder")}
            aria-invalid={Boolean(subjectError) || undefined}
          />
          <FieldError>{subjectError}</FieldError>
        </Field>

        <Field data-invalid={Boolean(scoreError) || undefined}>
          <FieldLabel htmlFor="careerlens-score">{t("score")}</FieldLabel>
          <Input
            id="careerlens-score"
            name="subjectScore"
            type="number"
            inputMode="decimal"
            min="0"
            max="10"
            step="0.1"
            defaultValue={defaultScore ?? undefined}
            aria-invalid={Boolean(scoreError) || undefined}
          />
          <FieldError>{scoreError}</FieldError>
        </Field>
        </FieldGroup>
      ) : null}

      {showInterests ? (
        <Field data-invalid={Boolean(interestsError) || undefined}>
        <FieldLabel htmlFor="careerlens-interests">{t("interests")}</FieldLabel>
        <Input
          id="careerlens-interests"
          name="interests"
          value={interests}
          onChange={(event) => setInterests(event.target.value)}
          placeholder={t("interestsPlaceholder")}
          aria-invalid={Boolean(interestsError) || undefined}
        />
        <FieldDescription>{t("interestsHint")}</FieldDescription>
        <div className="flex flex-wrap gap-2" aria-label={t("suggestionsLabel")}>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addSuggestion(suggestion)}
            >
              <Plus aria-hidden="true" />
              {suggestion}
            </Button>
          ))}
        </div>
        <FieldError>{interestsError}</FieldError>
        </Field>
      ) : null}
    </>
  );
}
