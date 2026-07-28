"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";

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
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import {
  saveCareerSettingsAction,
  type CareerSettingsActionState,
} from "../actions";

const initialState: CareerSettingsActionState = { status: "idle" };

export function CareerSettingsForm({
  models,
  preferredModel,
}: {
  models: string[];
  preferredModel: string;
}) {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState(
    saveCareerSettingsAction,
    initialState,
  );
  const [model, setModel] = useState<string | null>(preferredModel);
  const items = models.map((model) => ({ label: model, value: model }));
  const modelError = state.fieldErrors?.model?.[0];

  return (
    <Card>
      <form action={formAction}>
        <CardHeader>
          <CardTitle>{t("career.title")}</CardTitle>
          <CardDescription>{t("career.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={Boolean(modelError) || undefined}>
              <FieldLabel htmlFor="settings-career-model">{t("career.model")}</FieldLabel>
              <Select
                items={items}
                name="model"
                value={model}
                onValueChange={setModel}
                required
              >
                <SelectTrigger
                  id="settings-career-model"
                  className="w-full"
                  aria-invalid={Boolean(modelError) || undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>{t("career.modelHint")}</FieldDescription>
              <FieldError>{modelError}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-4">
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"} aria-live="polite">
            {state.message ?? t("career.footerHint")}
          </p>
          <Button type="submit" disabled={pending || models.length === 0}>
            {pending ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {pending ? t("career.saving") : t("career.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
