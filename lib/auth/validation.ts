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

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= 256,
    "Password is too long.",
  );

export const signupSchema = z
  .intersection(
    z.object({
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
      fullName: z.string().trim().min(2, "Enter your full name.").max(120),
      password: passwordSchema,
      passwordConfirmation: z.string(),
      dataConsent: z
        .string()
        .refine((value) => value === "true", "Consent is required."),
    }),
    birthDateSchema,
  )
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(256),
});

export const profileSchema = z.intersection(
  z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  }),
  birthDateSchema,
);

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(512),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

export const superadminCredentialsSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
});

export const superadminTotpSchema = z.object({
  challengeToken: z.string().min(32).max(512),
  token: z.string().regex(/^\d{6}$/, "Enter the six-digit authentication code."),
});

export const roleSchema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,31}$/, "Use 2-32 uppercase letters, numbers, or underscores."),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  permissionKeys: z.array(z.string().min(1)).max(100),
});

export const roleAssignmentSchema = z.object({
  userId: z.string().uuid(),
  roleKeys: z.array(z.string().min(1)).max(20),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
