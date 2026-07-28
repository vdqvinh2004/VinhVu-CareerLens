"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useActionState,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileBadge,
  GraduationCap,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  EDUCATION_LEVELS,
  type ActivityDto,
  type CertificateDto,
  type CompetitionDto,
  type EducationRecordDto,
  type ProfileRecordActionState,
  type ProfileRecordKind,
  type WorkExperienceDto,
} from "@/lib/profile-records";
import { cn } from "@/lib/utils";

import {
  deleteProfileRecordAction,
  saveActivityAction,
  saveCertificateAction,
  saveCompetitionAction,
  saveEducationAction,
  saveWorkExperienceAction,
} from "../profile-record-actions";

const initialState: ProfileRecordActionState = { status: "idle" };
const monthNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const xlsxAccept =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type SaveAction = (
  state: ProfileRecordActionState,
  formData: FormData,
) => Promise<ProfileRecordActionState>;

type PeriodValue = {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
};

const FormStateContext = createContext<ProfileRecordActionState>(initialState);

function useFieldError(field: string) {
  return useContext(FormStateContext).fieldErrors?.[field]?.[0];
}

function FormFieldError({ field }: { field: string }) {
  return <FieldError>{useFieldError(field)}</FieldError>;
}

function FormField({
  children,
  description,
  field,
  label,
}: {
  children: ReactNode;
  description?: string;
  field: string;
  label: string;
}) {
  const error = useFieldError(field);
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={`profile-record-${field}`}>{label}</FieldLabel>
      {isValidElement<Record<string, unknown>>(children)
        ? cloneElement(children, { "aria-invalid": Boolean(error) || undefined })
        : children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function RecordDialogForm({
  action,
  children,
  description,
  onClose,
  title,
}: {
  action: SaveAction;
  children: ReactNode;
  description: string;
  onClose: () => void;
  title: string;
}) {
  const t = useTranslations("Profile.extended");
  const [state, formAction, pending] = useActionState(
    async (previousState: ProfileRecordActionState, formData: FormData) => {
      const result = await action(previousState, formData);
      if (result.status === "success") onClose();
      return result;
    },
    initialState,
  );

  return (
    <DialogContent>
      <form action={formAction} className="flex flex-col gap-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FormStateContext.Provider value={state}>{children}</FormStateContext.Provider>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
      </form>
    </DialogContent>
  );
}

function RecordDialog({
  action,
  children,
  description,
  edit,
  title,
  triggerLabel,
}: {
  action: SaveAction;
  children: ReactNode;
  description: string;
  edit?: boolean;
  title: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={edit ? triggerLabel : undefined}
        className={buttonVariants({
          variant: edit ? "ghost" : "default",
          size: edit ? "icon-sm" : "default",
        })}
      >
        {edit ? <Pencil /> : <Plus data-icon="inline-start" />}
        {edit ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
      </DialogTrigger>
      {open ? (
        <RecordDialogForm
          action={action}
          description={description}
          onClose={() => setOpen(false)}
          title={title}
        >
          {children}
        </RecordDialogForm>
      ) : null}
    </Dialog>
  );
}

function DeleteRecordButton({ id, kind }: { id: string; kind: ProfileRecordKind }) {
  const t = useTranslations("Profile.extended");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function removeRecord() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteProfileRecordAction(kind, id);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        aria-label={t("common.delete")}
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <Trash2 />
        <span className="sr-only">{t("common.delete")}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={removeRecord}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {isPending ? t("common.deleting") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PeriodFields({ record, currentYear }: { record?: PeriodValue; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  const profileT = useTranslations("Profile");
  const yearMax = currentYear + 10;

  return (
    <FieldSet>
      <FieldLegend variant="label">{t("common.period")}</FieldLegend>
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldSet>
          <FieldLegend variant="label">{t("common.startDate")}</FieldLegend>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <FormField field="startMonth" label={t("common.month")}>
              <NativeSelect id="profile-record-startMonth" name="startMonth" defaultValue={record?.startMonth ?? 1} required>
                {monthNumbers.map((month) => <option key={month} value={month}>{profileT(`months.${month}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField field="startYear" label={t("common.year")}>
              <Input id="profile-record-startYear" name="startYear" type="number" min={1900} max={yearMax} defaultValue={record?.startYear ?? currentYear} required />
            </FormField>
          </FieldGroup>
        </FieldSet>
        <FieldSet>
          <FieldLegend variant="label">{t("common.endDate")}</FieldLegend>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <FormField field="endMonth" label={t("common.month")}>
              <NativeSelect id="profile-record-endMonth" name="endMonth" defaultValue={record?.endMonth ?? 12} required>
                {monthNumbers.map((month) => <option key={month} value={month}>{profileT(`months.${month}`)}</option>)}
              </NativeSelect>
            </FormField>
            <FormField field="endYear" label={t("common.year")}>
              <Input id="profile-record-endYear" name="endYear" type="number" min={1900} max={yearMax} defaultValue={record?.endYear ?? currentYear} required />
            </FormField>
          </FieldGroup>
          <FormFieldError field="endDate" />
        </FieldSet>
      </div>
    </FieldSet>
  );
}

function TranscriptFileField({ field, label, description }: { field: string; label: string; description: string }) {
  return (
    <FormField field={field} label={label} description={description}>
      <Input id={`profile-record-${field}`} name={field} type="file" accept={xlsxAccept} />
    </FormField>
  );
}

function EducationFields({ record, currentYear }: { record?: EducationRecordDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  const locale = useLocale();
  const [level, setLevel] = useState(record?.level ?? "HIGH_SCHOOL");
  const [scoreScale, setScoreScale] = useState<4 | 10>(
    record?.scoreScale ?? 4,
  );
  const templateHref = `/api/profile/transcript-template?level=${level}&scale=${level === "HIGH_SCHOOL" ? 10 : scoreScale}&locale=${locale === "en" ? "en" : "vi"}`;

  return (
    <FieldGroup>
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <FormField field="level" label={t("education.level")}>
        <NativeSelect id="profile-record-level" name="level" value={level} onChange={(event) => setLevel(event.target.value as typeof level)} required>
          {EDUCATION_LEVELS.map((educationLevel) => (
            <option key={educationLevel} value={educationLevel}>{t(`education.levels.${educationLevel}`)}</option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField field="institutionName" label={t("education.institutionName")}>
        <Input id="profile-record-institutionName" name="institutionName" defaultValue={record?.institutionName} maxLength={200} required />
      </FormField>
      <FormField field="fieldOfStudy" label={t(`education.fieldLabels.${level}`)} description={t(`education.fieldHints.${level}`)}>
        <Input id="profile-record-fieldOfStudy" name="fieldOfStudy" defaultValue={record?.fieldOfStudy ?? ""} maxLength={200} />
      </FormField>
      <PeriodFields record={record} currentYear={currentYear} />

      {level === "HIGH_SCHOOL" ? (
        <>
          <input type="hidden" name="scoreScale" value="10" />
          <FieldSet>
            <FieldLegend>{t("education.transcriptImport")}</FieldLegend>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <FieldDescription>{t("education.highSchoolTranscriptHint")}</FieldDescription>
              <a href={templateHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Download data-icon="inline-start" />
                {t("education.downloadTemplate")}
              </a>
            </div>
            <FieldGroup className="mt-3">
              <TranscriptFileField field="grade10File" label={t("education.grade10File")} description={t("education.optionalOnEdit")} />
              <TranscriptFileField field="grade11File" label={t("education.grade11File")} description={t("education.optionalOnEdit")} />
              <TranscriptFileField field="grade12File" label={t("education.grade12File")} description={t("education.optionalOnEdit")} />
            </FieldGroup>
          </FieldSet>
        </>
      ) : (
        <>
          <FormField field="scoreScale" label={t("education.scoreScale")} description={t("education.scoreScaleHint")}>
            <NativeSelect id="profile-record-scoreScale" name="scoreScale" value={scoreScale} onChange={(event) => setScoreScale(Number(event.target.value) as 4 | 10)} required>
              <option value="4">{t("education.scale4")}</option>
              <option value="10">{t("education.scale10")}</option>
            </NativeSelect>
          </FormField>
          <FieldSet>
            <FieldLegend>{t("education.transcriptImport")}</FieldLegend>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <FieldDescription>{t("education.higherEducationTranscriptHint")}</FieldDescription>
              <a href={templateHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Download data-icon="inline-start" />
                {t("education.downloadTemplate")}
              </a>
            </div>
            <FieldGroup className="mt-3">
              <TranscriptFileField field="transcriptFile" label={t("education.transcriptFile")} description={t("education.optionalOnEdit")} />
            </FieldGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>{t("education.research")}</FieldLegend>
            <FieldDescription>{t("education.researchHint")}</FieldDescription>
            <FieldGroup className="mt-3">
              <FormField field="researchTitle" label={t("education.researchTitle")}>
                <Input id="profile-record-researchTitle" name="researchTitle" defaultValue={record?.researchTitle ?? ""} maxLength={300} />
              </FormField>
              <FormField field="researchDescription" label={t("education.researchDescription")}>
                <Textarea id="profile-record-researchDescription" name="researchDescription" defaultValue={record?.researchDescription ?? ""} maxLength={4000} rows={4} />
              </FormField>
              <FormFieldError field="research" />
            </FieldGroup>
          </FieldSet>
        </>
      )}
    </FieldGroup>
  );
}

function EducationDialog({ record, currentYear }: { record?: EducationRecordDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  return (
    <RecordDialog action={saveEducationAction} edit={Boolean(record)} triggerLabel={record ? t("common.edit") : t("education.add")} title={record ? t("education.editTitle") : t("education.addTitle")} description={t("education.dialogDescription")}>
      <EducationFields record={record} currentYear={currentYear} />
    </RecordDialog>
  );
}

function CertificateDialog({ record, currentYear }: { record?: CertificateDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  return (
    <RecordDialog action={saveCertificateAction} edit={Boolean(record)} triggerLabel={record ? t("common.edit") : t("certificate.add")} title={record ? t("certificate.editTitle") : t("certificate.addTitle")} description={t("certificate.dialogDescription")}>
      <FieldGroup>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <FormField field="name" label={t("certificate.name")}><Input id="profile-record-name" name="name" defaultValue={record?.name} maxLength={200} required /></FormField>
        <PeriodFields record={record} currentYear={currentYear} />
        <FormField field="issuedYear" label={t("certificate.issuedYear")}><Input id="profile-record-issuedYear" name="issuedYear" type="number" min={1900} max={currentYear + 10} defaultValue={record?.issuedYear ?? currentYear} required /></FormField>
        <FormField field="evidence" label={t("certificate.evidence")} description={record?.attachment ? t("certificate.replaceEvidenceHint") : t("certificate.evidenceHint")}>
          <Input id="profile-record-evidence" name="evidence" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={!record?.attachment} />
        </FormField>
      </FieldGroup>
    </RecordDialog>
  );
}

function CompetitionDialog({ record, currentYear }: { record?: CompetitionDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  return (
    <RecordDialog action={saveCompetitionAction} edit={Boolean(record)} triggerLabel={record ? t("common.edit") : t("competition.add")} title={record ? t("competition.editTitle") : t("competition.addTitle")} description={t("competition.dialogDescription")}>
      <FieldGroup>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <FormField field="name" label={t("competition.name")}><Input id="profile-record-name" name="name" defaultValue={record?.name} maxLength={200} required /></FormField>
        <FormField field="awardName" label={t("competition.awardName")} description={t("competition.awardHint")}><Input id="profile-record-awardName" name="awardName" defaultValue={record?.awardName ?? ""} maxLength={200} /></FormField>
        <PeriodFields record={record} currentYear={currentYear} />
        <FormField field="year" label={t("competition.resultYear")}><Input id="profile-record-year" name="year" type="number" min={1900} max={currentYear + 10} defaultValue={record?.year ?? currentYear} required /></FormField>
      </FieldGroup>
    </RecordDialog>
  );
}

function ActivityDialog({ record, currentYear }: { record?: ActivityDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  return (
    <RecordDialog action={saveActivityAction} edit={Boolean(record)} triggerLabel={record ? t("common.edit") : t("activity.add")} title={record ? t("activity.editTitle") : t("activity.addTitle")} description={t("activity.dialogDescription")}>
      <FieldGroup>
        {record ? <input type="hidden" name="id" value={record.id} /> : null}
        <FormField field="name" label={t("activity.name")}><Input id="profile-record-name" name="name" defaultValue={record?.name} maxLength={300} required /></FormField>
        <PeriodFields record={record} currentYear={currentYear} />
      </FieldGroup>
    </RecordDialog>
  );
}

function WorkExperienceFields({ record, currentYear }: { record?: WorkExperienceDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  const profileT = useTranslations("Profile");
  const [isCurrent, setIsCurrent] = useState(record?.isCurrent ?? false);
  const yearMax = currentYear + 10;
  return (
    <FieldGroup>
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <input type="hidden" name="isCurrent" value={String(isCurrent)} />
      <FormField field="workplaceName" label={t("work.workplaceName")}><Input id="profile-record-workplaceName" name="workplaceName" defaultValue={record?.workplaceName} maxLength={200} required /></FormField>
      <FormField field="position" label={t("work.position")}><Input id="profile-record-position" name="position" defaultValue={record?.position ?? ""} maxLength={200} /></FormField>
      <FieldSet>
        <FieldLegend variant="label">{t("work.startDate")}</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <FormField field="startMonth" label={t("work.month")}><NativeSelect id="profile-record-startMonth" name="startMonth" defaultValue={record?.startMonth ?? 1} required>{monthNumbers.map((month) => <option key={month} value={month}>{profileT(`months.${month}`)}</option>)}</NativeSelect></FormField>
          <FormField field="startYear" label={t("work.year")}><Input id="profile-record-startYear" name="startYear" type="number" min={1900} max={yearMax} defaultValue={record?.startYear ?? currentYear} required /></FormField>
        </FieldGroup>
      </FieldSet>
      <Field orientation="horizontal">
        <Checkbox id="profile-record-isCurrent" checked={isCurrent} onCheckedChange={setIsCurrent} />
        <FieldLabel htmlFor="profile-record-isCurrent" className="font-normal">{t("work.isCurrent")}</FieldLabel>
      </Field>
      <FieldSet disabled={isCurrent}>
        <FieldLegend variant="label">{t("work.endDate")}</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <FormField field="endMonth" label={t("work.month")}><NativeSelect id="profile-record-endMonth" name="endMonth" defaultValue={record?.endMonth ?? ""} required={!isCurrent} disabled={isCurrent}><option value="">{t("common.optional")}</option>{monthNumbers.map((month) => <option key={month} value={month}>{profileT(`months.${month}`)}</option>)}</NativeSelect></FormField>
          <FormField field="endYear" label={t("work.year")}><Input id="profile-record-endYear" name="endYear" type="number" min={1900} max={yearMax} defaultValue={record?.endYear ?? ""} required={!isCurrent} disabled={isCurrent} /></FormField>
        </FieldGroup>
        <FormFieldError field="endDate" />
      </FieldSet>
      <FormField field="learnings" label={t("work.learnings")} description={t("work.learningsHint")}><Textarea id="profile-record-learnings" name="learnings" defaultValue={record?.learnings ?? ""} maxLength={4000} rows={4} /></FormField>
      <FormField field="skills" label={t("work.skills")} description={t("work.skillsHint")}><Textarea id="profile-record-skills" name="skills" defaultValue={record?.skills ?? ""} maxLength={2000} rows={3} /></FormField>
    </FieldGroup>
  );
}

function WorkExperienceDialog({ record, currentYear }: { record?: WorkExperienceDto; currentYear: number }) {
  const t = useTranslations("Profile.extended");
  return (
    <RecordDialog action={saveWorkExperienceAction} edit={Boolean(record)} triggerLabel={record ? t("common.edit") : t("work.add")} title={record ? t("work.editTitle") : t("work.addTitle")} description={t("work.dialogDescription")}>
      <WorkExperienceFields record={record} currentYear={currentYear} />
    </RecordDialog>
  );
}

function SectionCard({ action, children, description, icon: Icon, title }: { action: ReactNode; children: ReactNode; description: string; icon: typeof GraduationCap; title: string }) {
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon aria-hidden="true" className="size-5" /></div>
          <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1.5">{description}</CardDescription></div>
        </div>
        <div className="shrink-0">{action}</div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyRecords({ icon: Icon, text }: { icon: typeof GraduationCap; text: string }) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><Icon /></EmptyMedia><EmptyTitle>{text}</EmptyTitle></EmptyHeader></Empty>;
}

function RecordActions({ children, id, kind }: { children: ReactNode; id: string; kind: ProfileRecordKind }) {
  return <div className="flex shrink-0 items-center gap-1">{children}<DeleteRecordButton id={id} kind={kind} /></div>;
}

type ProfileRecordsProps = {
  activities: ActivityDto[];
  certificates: CertificateDto[];
  competitions: CompetitionDto[];
  currentYear: number;
  education: EducationRecordDto[];
  workExperiences: WorkExperienceDto[];
};

export function ProfileRecords({ activities, certificates, competitions, currentYear, education, workExperiences }: ProfileRecordsProps) {
  const t = useTranslations("Profile.extended");
  const profileT = useTranslations("Profile");
  const monthLabel = (month: number | null) => profileT(`months.${month ?? 1}` as "months.1");
  const formatPeriod = (record: PeriodValue) => `${monthLabel(record.startMonth)} ${record.startYear} – ${monthLabel(record.endMonth)} ${record.endYear}`;
  const formatWorkPeriod = (record: WorkExperienceDto) => `${monthLabel(record.startMonth)} ${record.startYear} – ${record.isCurrent ? t("work.present") : `${monthLabel(record.endMonth)} ${record.endYear}`}`;

  return (
    <section className="mt-10 flex flex-col gap-6" aria-labelledby="profile-records-title">
      <header className="max-w-2xl">
        <h2 id="profile-records-title" className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("description")}</p>
      </header>

      <SectionCard icon={GraduationCap} title={t("education.title")} description={t("education.description")} action={<EducationDialog currentYear={currentYear} />}>
        {education.length === 0 ? <EmptyRecords icon={GraduationCap} text={t("education.empty")} /> : (
          <div className="flex flex-col">{education.map((record, index) => (
            <div key={record.id}>{index > 0 ? <Separator /> : null}<article className="flex gap-4 py-5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Badge variant="secondary">{t(`education.levels.${record.level}`)}</Badge>
                <h3 className="mt-2 font-medium">{record.institutionName}</h3>
                {record.fieldOfStudy ? <p className="mt-1 text-sm text-muted-foreground">{record.fieldOfStudy}</p> : null}
                <p className="mt-1 text-sm text-muted-foreground">{formatPeriod(record)}</p>
                {record.transcriptSummaries.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {record.transcriptSummaries.map((summary) => (
                      <div key={summary.stage} className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground">{t(`education.transcriptStages.${summary.stage}`)}</p>
                        <p className="mt-1 text-lg font-semibold">{summary.average}/{record.scoreScale}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("education.subjectCount", { count: summary.subjectCount })}{summary.totalCredits !== null ? ` · ${t("education.creditCount", { count: summary.totalCredits })}` : ""}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-muted-foreground">{t("education.noTranscript")}</p>}
                {record.researchTitle ? (
                  <div className="mt-4 rounded-xl border p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t("education.research")}</p>
                    <p className="mt-1 font-medium">{record.researchTitle}</p>
                    {record.researchDescription ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.researchDescription}</p> : null}
                  </div>
                ) : null}
              </div>
              <RecordActions id={record.id} kind="education"><EducationDialog record={record} currentYear={currentYear} /></RecordActions>
            </article></div>
          ))}</div>
        )}
      </SectionCard>

      <SectionCard icon={BriefcaseBusiness} title={t("work.title")} description={t("work.description")} action={<WorkExperienceDialog currentYear={currentYear} />}>
        {workExperiences.length === 0 ? <EmptyRecords icon={BriefcaseBusiness} text={t("work.empty")} /> : <div className="flex flex-col">{workExperiences.map((record, index) => <div key={record.id}>{index > 0 ? <Separator /> : null}<article className="flex gap-4 py-5 first:pt-0 last:pb-0"><div className="min-w-0 flex-1"><h3 className="font-medium">{record.position || record.workplaceName}</h3>{record.position ? <p className="mt-1 text-sm text-muted-foreground">{record.workplaceName}</p> : null}<p className="mt-1 text-sm text-muted-foreground">{formatWorkPeriod(record)}</p>{record.learnings ? <p className="mt-3 text-sm leading-6"><span className="font-medium">{t("work.learnings")}:</span> {record.learnings}</p> : null}{record.skills ? <p className="mt-2 text-sm leading-6"><span className="font-medium">{t("work.skills")}:</span> {record.skills}</p> : null}</div><RecordActions id={record.id} kind="workExperience"><WorkExperienceDialog record={record} currentYear={currentYear} /></RecordActions></article></div>)}</div>}
      </SectionCard>

      <SectionCard icon={FileBadge} title={t("certificate.title")} description={t("certificate.description")} action={<CertificateDialog currentYear={currentYear} />}>
        {certificates.length === 0 ? <EmptyRecords icon={FileBadge} text={t("certificate.empty")} /> : <div className="grid gap-3 sm:grid-cols-2">{certificates.map((record) => <article key={record.id} className="flex min-w-0 gap-3 rounded-2xl border p-4"><div className="min-w-0 flex-1"><h3 className="font-medium">{record.name}</h3><p className="mt-1 text-sm text-muted-foreground">{formatPeriod(record)} · {t("certificate.issuedIn", { year: record.issuedYear })}</p>{record.attachment ? <a href={`/api/profile/certificates/${record.id}/attachment`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}><ExternalLink data-icon="inline-start" />{t("certificate.viewEvidence")}</a> : null}</div><RecordActions id={record.id} kind="certificate"><CertificateDialog record={record} currentYear={currentYear} /></RecordActions></article>)}</div>}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={Award} title={t("competition.title")} description={t("competition.description")} action={<CompetitionDialog currentYear={currentYear} />}>
          {competitions.length === 0 ? <EmptyRecords icon={Award} text={t("competition.empty")} /> : <div className="flex flex-col gap-3">{competitions.map((record) => <article key={record.id} className="flex gap-3 rounded-2xl border p-4"><div className="min-w-0 flex-1"><h3 className="font-medium">{record.name}</h3><p className="mt-1 text-sm text-muted-foreground">{record.awardName || t("competition.participated")} · {record.year}</p><p className="mt-1 text-xs text-muted-foreground">{formatPeriod(record)}</p></div><RecordActions id={record.id} kind="competition"><CompetitionDialog record={record} currentYear={currentYear} /></RecordActions></article>)}</div>}
        </SectionCard>
        <SectionCard icon={Sparkles} title={t("activity.title")} description={t("activity.description")} action={<ActivityDialog currentYear={currentYear} />}>
          {activities.length === 0 ? <EmptyRecords icon={BookOpen} text={t("activity.empty")} /> : <div className="flex flex-col gap-3">{activities.map((record) => <article key={record.id} className="flex items-start gap-3 rounded-2xl border p-4"><div className="min-w-0 flex-1"><h3 className="font-medium">{record.name}</h3><p className="mt-1 text-xs text-muted-foreground">{formatPeriod(record)}</p></div><RecordActions id={record.id} kind="activity"><ActivityDialog record={record} currentYear={currentYear} /></RecordActions></article>)}</div>}
        </SectionCard>
      </div>
    </section>
  );
}
