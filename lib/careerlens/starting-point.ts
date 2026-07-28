import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  certificateAttachments,
  certificates,
  competitions,
  educationRecords,
  personalityTestResults,
  profileActivities,
  transcriptEntries,
  workExperiences,
} from "@/lib/db/schema";

import {
  careerStartingPointSnapshotSchema,
  type CareerStartingPointSnapshot,
} from "./schemas";
export { hasCareerStartingPointData } from "./starting-point-data";

export async function getCareerStartingPointSnapshot(
  userId: string,
): Promise<CareerStartingPointSnapshot> {
  const db = getDb();
  const [
    [personality],
    education,
    transcriptRows,
    certificateRows,
    competitionRows,
    activityRows,
    workExperienceRows,
  ] = await Promise.all([
    db
      .select({
        resultType: personalityTestResults.resultType,
        scores: personalityTestResults.scores,
        completedAt: personalityTestResults.completedAt,
      })
      .from(personalityTestResults)
      .where(eq(personalityTestResults.userId, userId))
      .limit(1),
    db
      .select({
        id: educationRecords.id,
        level: educationRecords.level,
        institutionName: educationRecords.institutionName,
        fieldOfStudy: educationRecords.fieldOfStudy,
        startMonth: educationRecords.startMonth,
        startYear: educationRecords.startYear,
        endMonth: educationRecords.endMonth,
        endYear: educationRecords.endYear,
        scoreScale: educationRecords.scoreScale,
        researchTitle: educationRecords.researchTitle,
        researchDescription: educationRecords.researchDescription,
      })
      .from(educationRecords)
      .where(eq(educationRecords.userId, userId))
      .orderBy(
        asc(sql`case ${educationRecords.level}
          when 'HIGH_SCHOOL' then 1
          when 'UNDERGRADUATE' then 2
          when 'GRADUATE' then 3
          else 4 end`),
        asc(educationRecords.startYear),
        asc(educationRecords.startMonth),
      ),
    db
      .select({
        educationRecordId: transcriptEntries.educationRecordId,
        stage: transcriptEntries.stage,
        subjectName: transcriptEntries.subjectName,
        credits: transcriptEntries.credits,
        score: transcriptEntries.score,
      })
      .from(transcriptEntries)
      .innerJoin(
        educationRecords,
        eq(educationRecords.id, transcriptEntries.educationRecordId),
      )
      .where(eq(educationRecords.userId, userId)),
    db
      .select({
        name: certificates.name,
        issuedYear: certificates.issuedYear,
        startMonth: certificates.startMonth,
        startYear: certificates.startYear,
        endMonth: certificates.endMonth,
        endYear: certificates.endYear,
        attachmentId: certificateAttachments.certificateId,
      })
      .from(certificates)
      .leftJoin(
        certificateAttachments,
        eq(certificateAttachments.certificateId, certificates.id),
      )
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.endYear), desc(certificates.endMonth)),
    db
      .select({
        name: competitions.name,
        awardName: competitions.awardName,
        year: competitions.year,
        startMonth: competitions.startMonth,
        startYear: competitions.startYear,
        endMonth: competitions.endMonth,
        endYear: competitions.endYear,
      })
      .from(competitions)
      .where(eq(competitions.userId, userId))
      .orderBy(desc(competitions.endYear), desc(competitions.endMonth)),
    db
      .select({
        name: profileActivities.name,
        startMonth: profileActivities.startMonth,
        startYear: profileActivities.startYear,
        endMonth: profileActivities.endMonth,
        endYear: profileActivities.endYear,
      })
      .from(profileActivities)
      .where(eq(profileActivities.userId, userId))
      .orderBy(desc(profileActivities.endYear), desc(profileActivities.endMonth)),
    db
      .select({
        workplaceName: workExperiences.workplaceName,
        position: workExperiences.position,
        startMonth: workExperiences.startMonth,
        startYear: workExperiences.startYear,
        endMonth: workExperiences.endMonth,
        endYear: workExperiences.endYear,
        isCurrent: workExperiences.isCurrent,
        learnings: workExperiences.learnings,
        skills: workExperiences.skills,
      })
      .from(workExperiences)
      .where(eq(workExperiences.userId, userId))
      .orderBy(
        desc(workExperiences.isCurrent),
        desc(workExperiences.startYear),
        desc(workExperiences.startMonth),
      ),
  ]);

  const transcriptsByEducation = new Map<
    string,
    CareerStartingPointSnapshot["education"][number]["transcriptEntries"]
  >();
  for (const row of transcriptRows) {
    const entries = transcriptsByEducation.get(row.educationRecordId) ?? [];
    entries.push({
      stage: row.stage,
      subjectName: row.subjectName,
      credits: row.credits,
      score: row.score,
    });
    transcriptsByEducation.set(row.educationRecordId, entries);
  }

  return careerStartingPointSnapshotSchema.parse({
    personality: personality
      ? {
          resultType: personality.resultType,
          scores: personality.scores,
          completedAt: personality.completedAt.toISOString(),
        }
      : null,
    education: education.map((record) => ({
      ...record,
      scoreScale: record.scoreScale as 4 | 10,
      transcriptEntries: transcriptsByEducation.get(record.id) ?? [],
    })),
    certificates: certificateRows.map(({ attachmentId, ...certificate }) => ({
      ...certificate,
      hasAttachment: Boolean(attachmentId),
    })),
    competitions: competitionRows,
    activities: activityRows,
    workExperiences: workExperienceRows,
  });
}
