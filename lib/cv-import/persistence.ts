import "server-only";

import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  certificates,
  competitions,
  educationRecords,
  profileActivities,
  transcriptEntries,
  workExperiences,
} from "@/lib/db/schema";

import type { CvImportData } from "./schema";

export type CvImportCounts = {
  education: number;
  transcriptEntries: number;
  certificates: number;
  competitions: number;
  activities: number;
  workExperiences: number;
};

export type CvImportResult = {
  imported: CvImportCounts;
  skippedDuplicates: number;
};

const emptyCounts = (): CvImportCounts => ({
  education: 0,
  transcriptEntries: 0,
  certificates: 0,
  competitions: 0,
  activities: 0,
  workExperiences: 0,
});

export function normalizeCvImportKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function educationKey(value: {
  level: string;
  institutionName: string;
  startYear: number;
}) {
  return [
    value.level,
    normalizeCvImportKey(value.institutionName),
    value.startYear,
  ].join("|");
}

function certificateKey(value: { name: string; issuedYear: number }) {
  return `${normalizeCvImportKey(value.name)}|${value.issuedYear}`;
}

function competitionKey(value: { name: string; year: number }) {
  return `${normalizeCvImportKey(value.name)}|${value.year}`;
}

function activityKey(value: { name: string; startMonth: number; startYear: number }) {
  return `${normalizeCvImportKey(value.name)}|${value.startYear}`;
}

function workKey(value: {
  workplaceName: string;
  startYear: number;
}) {
  return [
    normalizeCvImportKey(value.workplaceName),
    value.startYear,
  ].join("|");
}

function transcriptKey(value: { stage: string; subjectName: string }) {
  return `${value.stage}|${normalizeCvImportKey(value.subjectName)}`;
}

export async function persistCvImport(
  userId: string,
  data: CvImportData,
): Promise<CvImportResult> {
  return getDb().transaction(async (transaction) => {
    const [education, certificateRows, competitionRows, activityRows, workRows] =
      await Promise.all([
        transaction
          .select({
            id: educationRecords.id,
            level: educationRecords.level,
            institutionName: educationRecords.institutionName,
            fieldOfStudy: educationRecords.fieldOfStudy,
            startMonth: educationRecords.startMonth,
            startYear: educationRecords.startYear,
            scoreScale: educationRecords.scoreScale,
          })
          .from(educationRecords)
          .where(eq(educationRecords.userId, userId)),
        transaction
          .select({ name: certificates.name, issuedYear: certificates.issuedYear })
          .from(certificates)
          .where(eq(certificates.userId, userId)),
        transaction
          .select({ name: competitions.name, year: competitions.year })
          .from(competitions)
          .where(eq(competitions.userId, userId)),
        transaction
          .select({
            name: profileActivities.name,
            startMonth: profileActivities.startMonth,
            startYear: profileActivities.startYear,
          })
          .from(profileActivities)
          .where(eq(profileActivities.userId, userId)),
        transaction
          .select({
            workplaceName: workExperiences.workplaceName,
            position: workExperiences.position,
            startMonth: workExperiences.startMonth,
            startYear: workExperiences.startYear,
          })
          .from(workExperiences)
          .where(eq(workExperiences.userId, userId)),
      ]);

    const educationByKey = new Map(
      education.map((record) => [
        educationKey(record),
        { id: record.id, scoreScale: record.scoreScale },
      ]),
    );
    const existingEducationIds = education.map((record) => record.id);
    const existingTranscriptRows = existingEducationIds.length
      ? await transaction
          .select({
            educationRecordId: transcriptEntries.educationRecordId,
            stage: transcriptEntries.stage,
            subjectName: transcriptEntries.subjectName,
          })
          .from(transcriptEntries)
          .where(inArray(transcriptEntries.educationRecordId, existingEducationIds))
      : [];
    const transcriptKeysByEducation = new Map<string, Set<string>>();
    for (const entry of existingTranscriptRows) {
      const keys = transcriptKeysByEducation.get(entry.educationRecordId) ?? new Set();
      keys.add(transcriptKey(entry));
      transcriptKeysByEducation.set(entry.educationRecordId, keys);
    }

    const imported = emptyCounts();
    let skippedDuplicates = 0;

    for (const item of data.education) {
      const key = educationKey(item.record);
      const existingEducation = educationByKey.get(key);
      let educationRecordId: string;
      if (existingEducation) {
        educationRecordId = existingEducation.id;
        skippedDuplicates += 1;
      } else {
        const [created] = await transaction
          .insert(educationRecords)
          .values({ userId, ...item.record })
          .returning({ id: educationRecords.id });
        educationRecordId = created.id;
        educationByKey.set(key, {
          id: created.id,
          scoreScale: item.record.scoreScale,
        });
        imported.education += 1;
      }

      if (
        existingEducation &&
        existingEducation.scoreScale !== item.record.scoreScale
      ) {
        skippedDuplicates += item.transcriptEntries.length;
        continue;
      }

      const transcriptKeys =
        transcriptKeysByEducation.get(educationRecordId) ?? new Set<string>();
      for (const entry of item.transcriptEntries) {
        const key = transcriptKey(entry);
        if (transcriptKeys.has(key)) {
          skippedDuplicates += 1;
          continue;
        }

        const [created] = await transaction
          .insert(transcriptEntries)
          .values({ educationRecordId, ...entry })
          .onConflictDoNothing()
          .returning({ id: transcriptEntries.id });
        if (created) {
          imported.transcriptEntries += 1;
        } else {
          skippedDuplicates += 1;
        }
        transcriptKeys.add(key);
      }
      transcriptKeysByEducation.set(educationRecordId, transcriptKeys);
    }

    const certificateKeys = new Set(certificateRows.map(certificateKey));
    for (const record of data.certificates) {
      const key = certificateKey(record);
      if (certificateKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      await transaction.insert(certificates).values({ userId, ...record });
      certificateKeys.add(key);
      imported.certificates += 1;
    }

    const competitionKeys = new Set(competitionRows.map(competitionKey));
    for (const record of data.competitions) {
      const key = competitionKey(record);
      if (competitionKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      await transaction.insert(competitions).values({ userId, ...record });
      competitionKeys.add(key);
      imported.competitions += 1;
    }

    const activityKeys = new Set(activityRows.map(activityKey));
    for (const record of data.activities) {
      const key = activityKey(record);
      if (activityKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      await transaction.insert(profileActivities).values({ userId, ...record });
      activityKeys.add(key);
      imported.activities += 1;
    }

    const workKeys = new Set(workRows.map(workKey));
    for (const record of data.workExperiences) {
      const key = workKey(record);
      if (workKeys.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      await transaction.insert(workExperiences).values({ userId, ...record });
      workKeys.add(key);
      imported.workExperiences += 1;
    }

    return { imported, skippedDuplicates };
  });
}
