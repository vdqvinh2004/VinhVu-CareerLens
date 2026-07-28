import { z } from "zod";

import type { PersonalityScores } from "@/lib/db/schema";

export const PERSONALITY_TEST_VERSION = 1;

export const personalityAnswersSchema = z
  .array(z.enum(["a", "b"]))
  .length(12);

export type PersonalityAnswer = z.infer<
  typeof personalityAnswersSchema
>[number];

export const personalityTypes = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export type PersonalityType = (typeof personalityTypes)[number];

type PersonalityLetter = keyof PersonalityScores;

type PersonalityQuestion = {
  dimension: readonly [PersonalityLetter, PersonalityLetter];
};

export const personalityQuestions = [
  { dimension: ["E", "I"] },
  { dimension: ["E", "I"] },
  { dimension: ["E", "I"] },
  { dimension: ["S", "N"] },
  { dimension: ["S", "N"] },
  { dimension: ["S", "N"] },
  { dimension: ["T", "F"] },
  { dimension: ["T", "F"] },
  { dimension: ["T", "F"] },
  { dimension: ["J", "P"] },
  { dimension: ["J", "P"] },
  { dimension: ["J", "P"] },
] as const satisfies readonly PersonalityQuestion[];

export function scorePersonalityTest(answers: readonly PersonalityAnswer[]) {
  const parsedAnswers = personalityAnswersSchema.parse(answers);
  const scores: PersonalityScores = {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0,
  };

  parsedAnswers.forEach((answer, index) => {
    const question = personalityQuestions[index];
    const letter = answer === "a" ? question.dimension[0] : question.dimension[1];
    scores[letter] += 1;
  });

  const result = [
    scores.E > scores.I ? "E" : "I",
    scores.S > scores.N ? "S" : "N",
    scores.T > scores.F ? "T" : "F",
    scores.J > scores.P ? "J" : "P",
  ].join("") as PersonalityType;

  return { result, scores };
}
