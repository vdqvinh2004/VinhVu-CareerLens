import { updateWorkspace } from "@/lib/browser-storage";
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

export async function persistCvImport(data: CvImportData): Promise<CvImportResult> {
  const imported = emptyCounts();
  let skippedDuplicates = 0;
  updateWorkspace(state => {
    const educationByKey = new Map(state.education.map(row => [educationKey(row), row]));
    for (const item of data.education) {
      let row = educationByKey.get(educationKey(item.record));
      if (row) skippedDuplicates++;
      else {
        row = { ...item.record, id: crypto.randomUUID(), transcriptEntries: [] };
        state.education.push(row); educationByKey.set(educationKey(item.record), row); imported.education++;
      }
      if (row.scoreScale !== item.record.scoreScale) { skippedDuplicates += item.transcriptEntries.length; continue; }
      const keys = new Set(row.transcriptEntries.map(transcriptKey));
      for (const entry of item.transcriptEntries) {
        const key = transcriptKey(entry);
        if (keys.has(key)) { skippedDuplicates++; continue; }
        row.transcriptEntries.push(entry); keys.add(key); imported.transcriptEntries++;
      }
    }
    const certificateKeys = new Set(state.certificates.map(certificateKey));
    for (const row of data.certificates) {
      const key = certificateKey(row);
      if (certificateKeys.has(key)) { skippedDuplicates++; continue; }
      state.certificates.push({ ...row, id: crypto.randomUUID(), attachment: null });
      certificateKeys.add(key); imported.certificates++;
    }
    const competitionKeys = new Set(state.competitions.map(competitionKey));
    for (const row of data.competitions) {
      const key = competitionKey(row);
      if (competitionKeys.has(key)) { skippedDuplicates++; continue; }
      state.competitions.push({ ...row, id: crypto.randomUUID() }); competitionKeys.add(key); imported.competitions++;
    }
    const activityKeys = new Set(state.activities.map(activityKey));
    for (const row of data.activities) {
      const key = activityKey(row);
      if (activityKeys.has(key)) { skippedDuplicates++; continue; }
      state.activities.push({ ...row, id: crypto.randomUUID() }); activityKeys.add(key); imported.activities++;
    }
    const workKeys = new Set(state.workExperiences.map(workKey));
    for (const row of data.workExperiences) {
      const key = workKey(row);
      if (workKeys.has(key)) { skippedDuplicates++; continue; }
      state.workExperiences.push({ ...row, id: crypto.randomUUID() }); workKeys.add(key); imported.workExperiences++;
    }
  });
  return { imported, skippedDuplicates };
}
