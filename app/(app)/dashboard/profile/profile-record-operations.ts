import { z } from "zod";
import { getTranslations } from "@/i18n/client";
import { readWorkspace, updateWorkspace, fileDataUrl } from "@/lib/browser-storage";
import type { ProfileRecordActionState, ProfileRecordKind } from "@/lib/profile-records";
import { activitySchema, certificateSchema, competitionSchema, educationRecordSchema, hasValidEvidenceSignature, validateEvidenceFile, workExperienceSchema } from "@/lib/profile-record-validation";
import { parseTranscriptFile, TranscriptImportError, type TranscriptEntryInput } from "@/lib/transcript-import";
const idleState: ProfileRecordActionState = { status: "idle" };
function getProfileRecordTranslations() { return getTranslations("Profile.extended"); }
type Translation = ReturnType<typeof getProfileRecordTranslations>;
function failure(error: unknown): ProfileRecordActionState { return { status: "error", message: error instanceof Error ? error.message : "Save failed." }; }
function invalidState(
  t: Translation,
  error: z.ZodError,
): ProfileRecordActionState {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "id");
    const message =
      issue.message === "endDateRequired"
        ? t("validation.endDateRequired")
        : issue.message === "endDateBeforeStart"
          ? t("validation.endDateBeforeStart")
          : issue.message === "researchIncomplete"
            ? t("validation.research")
          : t(`validation.${field}` as never);
    (errors[field] ??= []).push(message);
  }
  return {
    status: "error",
    message: t("actions.checkFields"),
    fieldErrors: errors,
  };
}

function formValues(formData: FormData, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, formData.get(field)]));
}

const periodFields = ["startMonth", "startYear", "endMonth", "endYear"];

function transcriptFile(formData: FormData, field: string) {
  const value = formData.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

function transcriptErrorState(
  t: Translation,
  field: string,
  error: unknown,
): ProfileRecordActionState {
  const code =
    error instanceof TranscriptImportError ? error.code : "invalidFile";
  const row = error instanceof TranscriptImportError ? error.row : undefined;
  const message = (() => {
    switch (code) {
      case "fileTooLarge":
        return t("validation.transcriptFile.fileTooLarge");
      case "missingHeaders":
        return t("validation.transcriptFile.missingHeaders");
      case "empty":
        return t("validation.transcriptFile.empty");
      case "tooManyRows":
        return t("validation.transcriptFile.tooManyRows");
      case "invalidRow":
        return t("validation.transcriptFile.invalidRow", { row: row ?? "" });
      case "duplicateSubject":
        return t("validation.transcriptFile.duplicateSubject", {
          row: row ?? "",
        });
      case "reimportRequired":
        return t("validation.transcriptFile.reimportRequired");
      default:
        return t("validation.transcriptFile.invalidFile");
    }
  })();
  return {
    status: "error",
    message: t("actions.checkFields"),
    fieldErrors: { [field]: [message] },
  };
}

export async function saveEducationAction(
  _previousState: ProfileRecordActionState = idleState,
  formData: FormData,
): Promise<ProfileRecordActionState> {
  void _previousState;
  const context = { t: getProfileRecordTranslations() };

  const parsed = educationRecordSchema.safeParse(
    formValues(formData, [
      "id",
      "level",
      "institutionName",
      "fieldOfStudy",
      "scoreScale",
      "researchTitle",
      "researchDescription",
      ...periodFields,
    ]),
  );
  if (!parsed.success) return invalidState(context.t, parsed.error);

  const fileDefinitions =
    parsed.data.level === "HIGH_SCHOOL"
      ? [
          { field: "grade10File", stage: "GRADE_10" as const },
          { field: "grade11File", stage: "GRADE_11" as const },
          { field: "grade12File", stage: "GRADE_12" as const },
        ]
      : [{ field: "transcriptFile", stage: "CUMULATIVE" as const }];
  const files = fileDefinitions.flatMap((definition) => {
    const file = transcriptFile(formData, definition.field);
    return file ? [{ ...definition, file }] : [];
  });

  const importResults = await Promise.all(
    files.map(async ({ field, file, stage }) => {
      try {
        return {
          field,
          entries: await parseTranscriptFile(
            file,
            parsed.data.level,
            stage,
            parsed.data.scoreScale,
          ),
        } as const;
      } catch (error) {
        return { field, error } as const;
      }
    }),
  );
  const failedImport = importResults.find((result) => "error" in result);
  if (failedImport && "error" in failedImport) {
    return transcriptErrorState(
      context.t,
      failedImport.field,
      failedImport.error,
    );
  }
  const imports: Array<{ field: string; entries: TranscriptEntryInput[] }> =
    importResults.flatMap((result) =>
      "entries" in result && result.entries
        ? [{ field: result.field, entries: result.entries }]
        : [],
    );

  const existing = readWorkspace().education.find(row => row.id === parsed.data.id);
  if (parsed.data.id && !existing) return { status: "error", message: context.t("actions.notFound") };
  if (existing && existing.level !== "HIGH_SCHOOL" && parsed.data.level !== "HIGH_SCHOOL" && existing.scoreScale !== parsed.data.scoreScale && !files.length) {
    return transcriptErrorState(context.t, "transcriptFile", new TranscriptImportError("reimportRequired"));
  }
  try {
    const { id, ...fields } = parsed.data;
    const compatible = existing?.transcriptEntries.filter(entry => fields.level === "HIGH_SCHOOL" ? entry.stage !== "CUMULATIVE" : entry.stage === "CUMULATIVE") ?? [];
    const replacedStages = new Set(imports.flatMap(item => item.entries.map(entry => entry.stage)));
    const entries = [...compatible.filter(entry => !replacedStages.has(entry.stage)), ...imports.flatMap(item => item.entries)];
    updateWorkspace(state => {
      const record = { ...fields, id: id ?? crypto.randomUUID(), transcriptEntries: entries };
      state.education = [record, ...state.education.filter(row => row.id !== id)];
    });
    return { status: "success", message: context.t("actions.saved") };
  } catch (error) { return failure(error); }
}

export async function saveCertificateAction(_previousState: ProfileRecordActionState = idleState, formData: FormData): Promise<ProfileRecordActionState> {
  void _previousState;
  const t = getProfileRecordTranslations();
  const parsed = certificateSchema.safeParse(formValues(formData, ["id", "name", "issuedYear", ...periodFields]));
  if (!parsed.success) return invalidState(t, parsed.error);
  const existing = readWorkspace().certificates.find(row => row.id === parsed.data.id);
  if (parsed.data.id && !existing) return { status: "error", message: t("actions.notFound") };
  const value = formData.get("evidence");
  const file = value instanceof File && value.size ? value : null;
  const error = validateEvidenceFile(file, !existing?.attachment);
  if (error) return { status: "error", message: t("actions.checkFields"), fieldErrors: { evidence: [t(`validation.evidence.${error}`)] } };
  try {
    if (file && !hasValidEvidenceSignature(file.type, new Uint8Array(await file.arrayBuffer()))) return { status: "error", message: t("validation.evidence.invalidContent") };
    const dataUrl = file ? await fileDataUrl(file) : existing?.dataUrl;
    const { id, ...fields } = parsed.data;
    updateWorkspace(state => {
      const row = { ...fields, id: id ?? crypto.randomUUID(), attachment: file ? { fileName: file.name, mimeType: file.type } : existing?.attachment ?? null, dataUrl };
      state.certificates = [row, ...state.certificates.filter(row => row.id !== id)];
    });
    return { status: "success", message: t("actions.saved") };
  } catch (error) { return failure(error); }
}

export async function saveCompetitionAction(_previousState: ProfileRecordActionState = idleState, formData: FormData): Promise<ProfileRecordActionState> {
  void _previousState;
  const t = getProfileRecordTranslations();
  const parsed = competitionSchema.safeParse(formValues(formData, ['id', 'name', 'awardName', 'year', 'startMonth', 'startYear', 'endMonth', 'endYear']));
  if (!parsed.success) return invalidState(t, parsed.error);
  const { id, ...fields } = parsed.data;
  if (id && !readWorkspace().competitions.some(row => row.id === id)) return { status: "error", message: t("actions.notFound") };
  try {
    updateWorkspace(state => { state.competitions = [{ ...fields, id: id ?? crypto.randomUUID() }, ...state.competitions.filter(row => row.id !== id)]; });
    return { status: "success", message: t("actions.saved") };
  } catch (error) { return failure(error); }
}

export async function saveActivityAction(_previousState: ProfileRecordActionState = idleState, formData: FormData): Promise<ProfileRecordActionState> {
  void _previousState;
  const t = getProfileRecordTranslations();
  const parsed = activitySchema.safeParse(formValues(formData, ['id', 'name', 'startMonth', 'startYear', 'endMonth', 'endYear']));
  if (!parsed.success) return invalidState(t, parsed.error);
  const { id, ...fields } = parsed.data;
  if (id && !readWorkspace().activities.some(row => row.id === id)) return { status: "error", message: t("actions.notFound") };
  try {
    updateWorkspace(state => { state.activities = [{ ...fields, id: id ?? crypto.randomUUID() }, ...state.activities.filter(row => row.id !== id)]; });
    return { status: "success", message: t("actions.saved") };
  } catch (error) { return failure(error); }
}

export async function saveWorkExperienceAction(_previousState: ProfileRecordActionState = idleState, formData: FormData): Promise<ProfileRecordActionState> {
  void _previousState;
  const t = getProfileRecordTranslations();
  const parsed = workExperienceSchema.safeParse(formValues(formData, ['id', 'workplaceName', 'position', 'startMonth', 'startYear', 'endMonth', 'endYear', 'isCurrent', 'learnings', 'skills']));
  if (!parsed.success) return invalidState(t, parsed.error);
  const { id, ...fields } = parsed.data;
  if (id && !readWorkspace().workExperiences.some(row => row.id === id)) return { status: "error", message: t("actions.notFound") };
  try {
    updateWorkspace(state => { state.workExperiences = [{ ...fields, id: id ?? crypto.randomUUID() }, ...state.workExperiences.filter(row => row.id !== id)]; });
    return { status: "success", message: t("actions.saved") };
  } catch (error) { return failure(error); }
}

export async function deleteProfileRecordAction(kind: ProfileRecordKind, idInput: string): Promise<ProfileRecordActionState> {
  const t = getProfileRecordTranslations();
  const id = z.string().uuid().safeParse(idInput);
  const collections = { education: "education", certificate: "certificates", competition: "competitions", activity: "activities", workExperience: "workExperiences" } as const;
  if (!id.success || !Object.hasOwn(collections, kind)) return { status: "error", message: t("actions.notFound") };
  try {
    updateWorkspace(state => { const key = collections[kind]; Object.assign(state, { [key]: state[key].filter(row => row.id !== id.data) }); });
    return { status: "success", message: t("actions.deleted") };
  } catch (error) { return failure(error); }
}
