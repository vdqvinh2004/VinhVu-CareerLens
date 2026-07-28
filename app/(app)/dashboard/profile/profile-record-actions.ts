"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/auth/audit";
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import {
  certificateAttachments,
  certificates,
  competitions,
  educationRecords,
  profileActivities,
  transcriptEntries,
  workExperiences,
} from "@/lib/db/schema";
import type {
  ProfileRecordActionState,
  ProfileRecordKind,
} from "@/lib/profile-records";
import {
  activitySchema,
  certificateSchema,
  competitionSchema,
  educationRecordSchema,
  hasValidEvidenceSignature,
  validateEvidenceFile,
  workExperienceSchema,
} from "@/lib/profile-record-validation";
import {
  parseTranscriptFile,
  TranscriptImportError,
  type TranscriptEntryInput,
} from "@/lib/transcript-import";

const idleState: ProfileRecordActionState = { status: "idle" };
const recordKindSchema = z.enum([
  "education",
  "certificate",
  "competition",
  "activity",
  "workExperience",
]);
const recordIdSchema = z.string().uuid();

function getProfileRecordTranslations() {
  return getTranslations("Profile.extended");
}

type Translation = Awaited<ReturnType<typeof getProfileRecordTranslations>>;

async function getUserContext() {
  const [viewer, t] = await Promise.all([
    requireViewer(),
    getProfileRecordTranslations(),
  ]);

  if (viewer.actor.kind !== "user") {
    return { error: t("actions.unavailable") } as const;
  }

  return { actor: viewer.actor, t, userId: viewer.actor.userId } as const;
}

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

async function auditBestEffort(
  event: Parameters<typeof recordAuditEvent>[0],
) {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    console.error("Could not write profile record audit event", {
      action: event.action,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function finishMutation(
  actor: Parameters<typeof recordAuditEvent>[0]["actor"],
  action: string,
  targetType: string,
  targetId: string,
  t: Translation,
) {
  await auditBestEffort({ actor, action, targetType, targetId });
  revalidatePath("/dashboard/starting-point");
  return { status: "success", message: t("actions.saved") } as const;
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
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };

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

  if (parsed.data.id && files.length === 0) {
    const [existingRecord] = await getDb()
      .select({
        level: educationRecords.level,
        scoreScale: educationRecords.scoreScale,
      })
      .from(educationRecords)
      .where(
        and(
          eq(educationRecords.id, parsed.data.id),
          eq(educationRecords.userId, context.userId),
        ),
      )
      .limit(1);
    if (!existingRecord) {
      return { status: "error", message: context.t("actions.notFound") };
    }
    if (
      existingRecord.level !== "HIGH_SCHOOL" &&
      parsed.data.level !== "HIGH_SCHOOL" &&
      existingRecord.scoreScale !== parsed.data.scoreScale
    ) {
      return transcriptErrorState(
        context.t,
        "transcriptFile",
        new TranscriptImportError("reimportRequired"),
      );
    }
  }

  try {
    const record = await getDb().transaction(async (transaction) => {
      const { id, ...recordValues } = parsed.data;
      const values = { ...recordValues, updatedAt: new Date() };
      const [savedRecord] = id
        ? await transaction
            .update(educationRecords)
            .set(values)
            .where(
              and(
                eq(educationRecords.id, id),
                eq(educationRecords.userId, context.userId),
              ),
            )
            .returning({ id: educationRecords.id })
        : await transaction
            .insert(educationRecords)
            .values({ ...values, userId: context.userId })
            .returning({ id: educationRecords.id });

      if (!savedRecord) return null;

      const incompatibleStages =
        parsed.data.level === "HIGH_SCHOOL"
          ? (["CUMULATIVE"] as const)
          : (["GRADE_10", "GRADE_11", "GRADE_12"] as const);
      await transaction
        .delete(transcriptEntries)
        .where(
          and(
            eq(transcriptEntries.educationRecordId, savedRecord.id),
            inArray(transcriptEntries.stage, incompatibleStages),
          ),
        );

      for (const imported of imports) {
        const stage = imported.entries[0]?.stage;
        if (!stage) continue;
        await transaction
          .delete(transcriptEntries)
          .where(
            and(
              eq(transcriptEntries.educationRecordId, savedRecord.id),
              eq(transcriptEntries.stage, stage),
            ),
          );
        await transaction.insert(transcriptEntries).values(
          imported.entries.map((entry) => ({
            educationRecordId: savedRecord.id,
            ...entry,
          })),
        );
      }

      return savedRecord;
    });

    if (!record) return { status: "error", message: context.t("actions.notFound") };
    return finishMutation(
      context.actor,
      parsed.data.id ? "profile.education.updated" : "profile.education.created",
      "education_record",
      record.id,
      context.t,
    );
  } catch (error) {
    console.error("Education record save failed", error);
    return { status: "error", message: context.t("actions.failed") };
  }
}

export async function saveCertificateAction(
  _previousState: ProfileRecordActionState = idleState,
  formData: FormData,
): Promise<ProfileRecordActionState> {
  void _previousState;
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };

  const parsed = certificateSchema.safeParse(
    formValues(formData, ["id", "name", "issuedYear", ...periodFields]),
  );
  if (!parsed.success) return invalidState(context.t, parsed.error);

  const fileValue = formData.get("evidence");
  const file = fileValue instanceof File ? fileValue : null;
  const fileError = validateEvidenceFile(file, !parsed.data.id);
  if (fileError) {
    return {
      status: "error",
      message: context.t("actions.checkFields"),
      fieldErrors: { evidence: [context.t(`validation.evidence.${fileError}`)] },
    };
  }

  let attachment:
    | { byteSize: number; data: Buffer; fileName: string; mimeType: string }
    | undefined;
  if (file && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidEvidenceSignature(file.type, bytes)) {
      return {
        status: "error",
        message: context.t("actions.checkFields"),
        fieldErrors: {
          evidence: [context.t("validation.evidence.invalidContent")],
        },
      };
    }
    attachment = {
      byteSize: file.size,
      data: Buffer.from(bytes),
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
    };
  }

  try {
    const recordId = await getDb().transaction(async (transaction) => {
      const values = {
        name: parsed.data.name,
        issuedYear: parsed.data.issuedYear,
        startMonth: parsed.data.startMonth,
        startYear: parsed.data.startYear,
        endMonth: parsed.data.endMonth,
        endYear: parsed.data.endYear,
        updatedAt: new Date(),
      };
      const [record] = parsed.data.id
        ? await transaction
            .update(certificates)
            .set(values)
            .where(
              and(
                eq(certificates.id, parsed.data.id),
                eq(certificates.userId, context.userId),
              ),
            )
            .returning({ id: certificates.id })
        : await transaction
            .insert(certificates)
            .values({ ...values, userId: context.userId })
            .returning({ id: certificates.id });

      if (!record) return null;

      if (attachment) {
        await transaction
          .insert(certificateAttachments)
          .values({ certificateId: record.id, ...attachment })
          .onConflictDoUpdate({
            target: certificateAttachments.certificateId,
            set: { ...attachment, updatedAt: new Date() },
          });
      }

      return record.id;
    });

    if (!recordId) return { status: "error", message: context.t("actions.notFound") };
    return finishMutation(
      context.actor,
      parsed.data.id ? "profile.certificate.updated" : "profile.certificate.created",
      "certificate",
      recordId,
      context.t,
    );
  } catch (error) {
    console.error("Certificate save failed", error);
    return { status: "error", message: context.t("actions.failed") };
  }
}

export async function saveCompetitionAction(
  _previousState: ProfileRecordActionState = idleState,
  formData: FormData,
): Promise<ProfileRecordActionState> {
  void _previousState;
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };
  const parsed = competitionSchema.safeParse(
    formValues(formData, ["id", "name", "awardName", "year", ...periodFields]),
  );
  if (!parsed.success) return invalidState(context.t, parsed.error);

  try {
    const { id, ...recordValues } = parsed.data;
    const values = { ...recordValues, updatedAt: new Date() };
    const [record] = id
      ? await getDb()
          .update(competitions)
          .set(values)
          .where(and(eq(competitions.id, id), eq(competitions.userId, context.userId)))
          .returning({ id: competitions.id })
      : await getDb()
          .insert(competitions)
          .values({ ...values, userId: context.userId })
          .returning({ id: competitions.id });
    if (!record) return { status: "error", message: context.t("actions.notFound") };
    return finishMutation(context.actor, id ? "profile.competition.updated" : "profile.competition.created", "competition", record.id, context.t);
  } catch (error) {
    console.error("Competition save failed", error);
    return { status: "error", message: context.t("actions.failed") };
  }
}

export async function saveActivityAction(
  _previousState: ProfileRecordActionState = idleState,
  formData: FormData,
): Promise<ProfileRecordActionState> {
  void _previousState;
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };
  const parsed = activitySchema.safeParse(
    formValues(formData, ["id", "name", ...periodFields]),
  );
  if (!parsed.success) return invalidState(context.t, parsed.error);

  try {
    const { id, ...recordValues } = parsed.data;
    const values = { ...recordValues, updatedAt: new Date() };
    const [record] = id
      ? await getDb()
          .update(profileActivities)
          .set(values)
          .where(and(eq(profileActivities.id, id), eq(profileActivities.userId, context.userId)))
          .returning({ id: profileActivities.id })
      : await getDb()
          .insert(profileActivities)
          .values({ ...values, userId: context.userId })
          .returning({ id: profileActivities.id });
    if (!record) return { status: "error", message: context.t("actions.notFound") };
    return finishMutation(context.actor, id ? "profile.activity.updated" : "profile.activity.created", "profile_activity", record.id, context.t);
  } catch (error) {
    console.error("Activity save failed", error);
    return { status: "error", message: context.t("actions.failed") };
  }
}

export async function saveWorkExperienceAction(
  _previousState: ProfileRecordActionState = idleState,
  formData: FormData,
): Promise<ProfileRecordActionState> {
  void _previousState;
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };
  const parsed = workExperienceSchema.safeParse(
    formValues(formData, [
      "id", "workplaceName", "position", "startMonth", "startYear",
      "endMonth", "endYear", "isCurrent", "learnings", "skills",
    ]),
  );
  if (!parsed.success) return invalidState(context.t, parsed.error);

  try {
    const { id, ...recordValues } = parsed.data;
    const values = { ...recordValues, updatedAt: new Date() };
    const [record] = id
      ? await getDb()
          .update(workExperiences)
          .set(values)
          .where(and(eq(workExperiences.id, id), eq(workExperiences.userId, context.userId)))
          .returning({ id: workExperiences.id })
      : await getDb()
          .insert(workExperiences)
          .values({ ...values, userId: context.userId })
          .returning({ id: workExperiences.id });
    if (!record) return { status: "error", message: context.t("actions.notFound") };
    return finishMutation(context.actor, id ? "profile.work_experience.updated" : "profile.work_experience.created", "work_experience", record.id, context.t);
  } catch (error) {
    console.error("Work experience save failed", error);
    return { status: "error", message: context.t("actions.failed") };
  }
}

export async function deleteProfileRecordAction(
  kindInput: ProfileRecordKind,
  idInput: string,
): Promise<ProfileRecordActionState> {
  const context = await getUserContext();
  if ("error" in context) return { status: "error", message: context.error };
  const kind = recordKindSchema.safeParse(kindInput);
  const id = recordIdSchema.safeParse(idInput);
  if (!kind.success || !id.success) {
    return { status: "error", message: context.t("actions.notFound") };
  }

  try {
    let deleted: { id: string }[] = [];
    switch (kind.data) {
      case "education":
        deleted = await getDb().delete(educationRecords).where(and(eq(educationRecords.id, id.data), eq(educationRecords.userId, context.userId))).returning({ id: educationRecords.id });
        break;
      case "certificate":
        deleted = await getDb().delete(certificates).where(and(eq(certificates.id, id.data), eq(certificates.userId, context.userId))).returning({ id: certificates.id });
        break;
      case "competition":
        deleted = await getDb().delete(competitions).where(and(eq(competitions.id, id.data), eq(competitions.userId, context.userId))).returning({ id: competitions.id });
        break;
      case "activity":
        deleted = await getDb().delete(profileActivities).where(and(eq(profileActivities.id, id.data), eq(profileActivities.userId, context.userId))).returning({ id: profileActivities.id });
        break;
      case "workExperience":
        deleted = await getDb().delete(workExperiences).where(and(eq(workExperiences.id, id.data), eq(workExperiences.userId, context.userId))).returning({ id: workExperiences.id });
        break;
    }

    if (!deleted[0]) return { status: "error", message: context.t("actions.notFound") };
    await auditBestEffort({
      actor: context.actor,
      action: `profile.${kind.data}.deleted`,
      targetType: kind.data,
      targetId: id.data,
    });
    revalidatePath("/dashboard/starting-point");
    return { status: "success", message: context.t("actions.deleted") };
  } catch (error) {
    console.error("Profile record deletion failed", error);
    return { status: "error", message: context.t("actions.deleteFailed") };
  }
}
