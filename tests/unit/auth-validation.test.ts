import { describe, expect, it } from "vitest";

import { PERMISSION_CATALOG } from "@/lib/auth/permissions";
import { profileSchema, signupSchema } from "@/lib/auth/validation";

describe("signup validation", () => {
  it("normalizes email and strips a client-supplied role", () => {
    const result = signupSchema.parse({
      email: "  USER@Example.COM ",
      fullName: "Example User",
      birthDay: "14",
      birthMonth: "7",
      birthYear: "2000",
      password: "correct horse battery staple",
      passwordConfirmation: "correct horse battery staple",
      dataConsent: "true",
      role: "BUILTIN_SUPERADMIN",
    });

    expect(result.email).toBe("user@example.com");
    expect(result.birthDate).toBe("2000-07-14");
    expect(result).not.toHaveProperty("role");
  });

  it("rejects short passwords and mismatched confirmation", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      fullName: "Example User",
      birthDay: 14,
      birthMonth: 7,
      birthYear: 2000,
      password: "short",
      passwordConfirmation: "different",
      dataConsent: "true",
    });

    expect(result.success).toBe(false);
  });

  it("accepts passwords with eight characters", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      fullName: "Example User",
      birthDay: 14,
      birthMonth: 7,
      birthYear: 2000,
      password: "12345678",
      passwordConfirmation: "12345678",
      dataConsent: "true",
    });

    expect(result.success).toBe(true);
  });

  it("requires data consent", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      fullName: "Example User",
      birthDay: 14,
      birthMonth: 7,
      birthYear: 2000,
      password: "12345678",
      passwordConfirmation: "12345678",
      dataConsent: "false",
    });

    expect(result.success).toBe(false);
  });
});

describe("permission catalog", () => {
  it("contains unique permission keys", () => {
    const keys = PERMISSION_CATALOG.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("profile validation", () => {
  it("normalizes editable profile values", () => {
    const result = profileSchema.parse({
      email: "  LEARNER@Example.COM ",
      fullName: "  Nguyen Minh Anh  ",
      birthDay: "9",
      birthMonth: "4",
      birthYear: "2001",
    });

    expect(result).toEqual({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthDate: "2001-04-09",
    });
  });

  it("accepts a valid leap day", () => {
    const result = profileSchema.parse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthDay: 29,
      birthMonth: 2,
      birthYear: 2024,
    });

    expect(result.birthDate).toBe("2024-02-29");
  });

  it.each([
    { birthDay: 29, birthMonth: 2, birthYear: 2023 },
    { birthDay: 31, birthMonth: 4, birthYear: 2001 },
  ])("rejects impossible calendar dates", (birthDate) => {
    const result = profileSchema.safeParse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      ...birthDate,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.birthDate).toBeDefined();
    }
  });

  it("rejects out-of-range date parts", () => {
    const result = profileSchema.safeParse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthDay: 32,
      birthMonth: 13,
      birthYear: 2001,
    });

    expect(result.success).toBe(false);
  });

  it("rejects dates before 1900", () => {
    const result = profileSchema.safeParse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthDay: 31,
      birthMonth: 12,
      birthYear: 1899,
    });

    expect(result.success).toBe(false);
  });

  it("rejects future dates", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const result = profileSchema.safeParse({
      email: "learner@example.com",
      fullName: "Nguyen Minh Anh",
      birthDay: tomorrow.getUTCDate(),
      birthMonth: tomorrow.getUTCMonth() + 1,
      birthYear: tomorrow.getUTCFullYear(),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.birthDate).toBeDefined();
    }
  });
});
