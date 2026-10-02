import { z } from "zod";

type BirthDateParts = {
  birthDay: number;
  birthMonth: number;
  birthYear: number;
};

function formatBirthDate({ birthDay, birthMonth, birthYear }: BirthDateParts) {
  return [
    String(birthYear).padStart(4, "0"),
    String(birthMonth).padStart(2, "0"),
    String(birthDay).padStart(2, "0"),
  ].join("-");
}

const birthDateSchema = z
  .object({
    birthDay: z.coerce
      .number()
      .int()
      .min(1, "Enter a valid day of birth.")
      .max(31, "Enter a valid day of birth."),
    birthMonth: z.coerce
      .number()
      .int()
      .min(1, "Enter a valid birth month.")
      .max(12, "Enter a valid birth month."),
    birthYear: z.coerce
      .number()
      .int()
      .min(1900, "Enter a valid birth year."),
  })
  .superRefine(({ birthDay, birthMonth, birthYear }, context) => {
    if (
      birthDay < 1 ||
      birthDay > 31 ||
      birthMonth < 1 ||
      birthMonth > 12 ||
      birthYear < 1900
    ) {
      return;
    }

    const candidate = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));

    if (
      candidate.getUTCFullYear() !== birthYear ||
      candidate.getUTCMonth() !== birthMonth - 1 ||
      candidate.getUTCDate() !== birthDay
    ) {
      context.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: "Enter a valid date of birth.",
      });
      return;
    }

    const birthDate = formatBirthDate({ birthDay, birthMonth, birthYear });

    if (birthDate > new Date().toISOString().slice(0, 10)) {
      context.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: "Date of birth cannot be in the future.",
      });
    }
  })
  .transform((parts) => ({ birthDate: formatBirthDate(parts) }));

export const profileSchema = z.intersection(
  z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  }),
  birthDateSchema,
);

