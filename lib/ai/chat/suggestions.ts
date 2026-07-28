import "server-only";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import {
  certificates,
  competitions,
  educationRecords,
  personalityTestResults,
  profileActivities,
  transcriptEntries,
  workExperiences,
} from "@/lib/db/schema";

import { FptResponsesProvider } from "../fpt";

const suggestionsSchema = z.object({
  suggestions: z.array(z.string().trim().min(8).max(240)).length(5),
});

const TOPICS = [
  "choosing a major or career direction",
  "programming and technical learning",
  "university and admissions preparation",
  "skills and career development",
  "scholarships and study abroad",
] as const;

function parseJson(text: string): unknown {
  return JSON.parse(
    text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim(),
  );
}

async function loadSuggestionContext(userId: string) {
  const db = getDb();
  const [personality, education, subjects, certificateRows, competitionRows, activities, work] =
    await Promise.all([
      db
        .select({ type: personalityTestResults.resultType })
        .from(personalityTestResults)
        .where(eq(personalityTestResults.userId, userId))
        .limit(1),
      db
        .select({
          level: educationRecords.level,
          fieldOfStudy: educationRecords.fieldOfStudy,
          researchTitle: educationRecords.researchTitle,
        })
        .from(educationRecords)
        .where(eq(educationRecords.userId, userId))
        .orderBy(desc(educationRecords.updatedAt))
        .limit(3),
      db
        .select({
          subject: transcriptEntries.subjectName,
          score: transcriptEntries.score,
          stage: transcriptEntries.stage,
        })
        .from(transcriptEntries)
        .innerJoin(
          educationRecords,
          eq(transcriptEntries.educationRecordId, educationRecords.id),
        )
        .where(eq(educationRecords.userId, userId))
        .orderBy(desc(transcriptEntries.score))
        .limit(8),
      db
        .select({ name: certificates.name })
        .from(certificates)
        .where(eq(certificates.userId, userId))
        .orderBy(desc(certificates.updatedAt))
        .limit(5),
      db
        .select({ name: competitions.name, award: competitions.awardName })
        .from(competitions)
        .where(eq(competitions.userId, userId))
        .orderBy(desc(competitions.updatedAt))
        .limit(5),
      db
        .select({ name: profileActivities.name })
        .from(profileActivities)
        .where(eq(profileActivities.userId, userId))
        .orderBy(desc(profileActivities.updatedAt))
        .limit(5),
      db
        .select({
          position: workExperiences.position,
          skills: workExperiences.skills,
          learnings: workExperiences.learnings,
        })
        .from(workExperiences)
        .where(eq(workExperiences.userId, userId))
        .orderBy(desc(workExperiences.updatedAt))
        .limit(3),
    ]);

  return {
    personality: personality[0]?.type ?? null,
    education,
    strongestSubjects: subjects,
    certificates: certificateRows,
    competitions: competitionRows,
    activities,
    workExperience: work,
  };
}

export async function generateChatSuggestions(input: {
  userId: string;
  model: string;
  locale: "en" | "vi";
}): Promise<string[]> {
  const apiKey = process.env.FPT_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("FPT_AI_API_KEY is required");

  const context = await loadSuggestionContext(input.userId);
  const language = input.locale === "vi" ? "Vietnamese" : "English";
  const provider = new FptResponsesProvider({ apiKey });
  const response = await provider.generate({
    model: input.model,
    input: [
      {
        type: "message",
        id: "suggestion-system",
        role: "system",
        text: [
          `Generate exactly five concise chat-starter questions in ${language}.`,
          "Return JSON only as {\"suggestions\":[\"...\"]}.",
          "Create one question for each topic, in the exact order provided.",
          "Personalize with saved context only when it makes the question more useful.",
          "Never mention that a profile or database exists. Do not invent user facts.",
          "Each item must be a self-contained question the user can send directly to an education and career assistant.",
        ].join(" "),
      },
      {
        type: "message",
        id: "suggestion-input",
        role: "user",
        text: JSON.stringify({ topics: TOPICS, savedContext: context }),
      },
    ],
    tools: [],
    toolChoice: "none",
    maxOutputTokens: 2_500,
    signal: AbortSignal.timeout(30_000),
    timeoutMs: 30_000,
  });
  const text = response.items
    .flatMap((item) =>
      item.type === "message" && item.role === "assistant" ? [item.text] : [],
    )
    .join("");

  return suggestionsSchema.parse(parseJson(text)).suggestions;
}
