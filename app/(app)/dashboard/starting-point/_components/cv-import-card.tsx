"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  FileUp,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  importCvAction,
  type CvImportActionState,
} from "@/app/(app)/dashboard/starting-point/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const initialState: CvImportActionState = { status: "idle" };

const countKeys = [
  "education",
  "transcriptEntries",
  "certificates",
  "competitions",
  "activities",
  "workExperiences",
] as const;

export function CvImportDialog() {
  const t = useTranslations("StartingPoint.cvImport");
  const [state, formAction, pending] = useActionState(
    importCvAction,
    initialState,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger render={<Button size="lg" />}>
        <FileUp data-icon="inline-start" />
        {t("title")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-10">
            <DialogTitle>{t("title")}</DialogTitle>
            <Badge variant="secondary">{t("badge")}</Badge>
          </div>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5">
          <FieldGroup className="gap-5">
            <Field
              data-invalid={
                state.status === "error" && Boolean(state.fieldError)
              }
            >
              <FieldLabel htmlFor="cv-file">{t("fileLabel")}</FieldLabel>
              <Input
                id="cv-file"
                name="cvFile"
                type="file"
                accept=".pdf,application/pdf"
                aria-invalid={state.status === "error" && Boolean(state.fieldError)}
                aria-describedby="cv-file-description"
                disabled={pending}
                required
                onChange={(event) =>
                  setFileName(event.currentTarget.files?.[0]?.name ?? null)
                }
              />
              <FieldDescription id="cv-file-description">
                {fileName ? t("selectedFile", { name: fileName }) : t("fileHint")}
              </FieldDescription>
              {state.status === "error" && state.fieldError ? (
                <FieldError>{state.fieldError}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>

          <Alert>
            <ShieldCheck aria-hidden="true" />
            <AlertDescription>{t("privacy")}</AlertDescription>
          </Alert>

          {state.status === "error" ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t("errorTitle")}</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          {state.status === "success" ? (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>{t("successTitle")}</AlertTitle>
              <AlertDescription>
                <p>{state.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {countKeys.flatMap((key) =>
                    state.imported[key] > 0 ? (
                      <Badge key={key} variant="secondary">
                        {t(`counts.${key}`, { count: state.imported[key] })}
                      </Badge>
                    ) : (
                      []
                    ),
                  )}
                  {state.skippedDuplicates > 0 ? (
                    <Badge variant="outline">
                      {t("counts.duplicates", {
                        count: state.skippedDuplicates,
                      })}
                    </Badge>
                  ) : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <FileUp data-icon="inline-start" />
              )}
              {pending ? t("processing") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
