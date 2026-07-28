"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, Save } from "lucide-react";

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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import {
  resetRoadmapPrefillDataAction,
  saveRoadmapDataSettingsAction,
  type CareerSettingsActionState,
} from "../actions";

const initialState: CareerSettingsActionState = { status: "idle" };

function ActionMessage({
  fallback,
  state,
}: {
  fallback: string;
  state: CareerSettingsActionState;
}) {
  return (
    <p
      className={
        state.status === "error"
          ? "text-sm text-destructive"
          : "text-sm text-muted-foreground"
      }
      aria-live="polite"
    >
      {state.message ?? fallback}
    </p>
  );
}

export function RoadmapDataSettingsForm({
  reuseLatestRoadmapData,
}: {
  reuseLatestRoadmapData: boolean;
}) {
  const t = useTranslations("Settings");
  const [reuseLatest, setReuseLatest] = useState(reuseLatestRoadmapData);
  const [saveState, saveAction, savePending] = useActionState(
    saveRoadmapDataSettingsAction,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetRoadmapPrefillDataAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form action={saveAction}>
          <CardHeader>
            <CardTitle>{t("roadmapData.title")}</CardTitle>
            <CardDescription>{t("roadmapData.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="settings-reuse-roadmap-data">
                    {t("roadmapData.reuseLabel")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("roadmapData.reuseHint")}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="settings-reuse-roadmap-data"
                  name="reuseLatestRoadmapData"
                  checked={reuseLatest}
                  onCheckedChange={setReuseLatest}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-4">
            <ActionMessage
              fallback={t("roadmapData.footerHint")}
              state={saveState}
            />
            <Button type="submit" disabled={savePending}>
              {savePending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {savePending
                ? t("roadmapData.saving")
                : t("roadmapData.save")}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form action={resetAction}>
          <CardHeader>
            <CardTitle>{t("roadmapData.resetTitle")}</CardTitle>
            <CardDescription>
              {t("roadmapData.resetDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              {t("roadmapData.resetHint")}
            </p>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-4">
            <ActionMessage
              fallback={t("roadmapData.resetFooterHint")}
              state={resetState}
            />
            <Button type="submit" variant="outline" disabled={resetPending}>
              {resetPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              {resetPending
                ? t("roadmapData.resetting")
                : t("roadmapData.reset")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
