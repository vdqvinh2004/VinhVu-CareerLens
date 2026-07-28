import { describe, expect, it } from "vitest";

import { isUniqueEmailError } from "@/lib/db/errors";

describe("database error detection", () => {
  it("detects a direct unique email violation", () => {
    expect(
      isUniqueEmailError({
        code: "23505",
        constraint: "users_email_unique",
      }),
    ).toBe(true);
  });

  it("detects a unique email violation wrapped by Drizzle", () => {
    expect(
      isUniqueEmailError({
        cause: {
          code: "23505",
          constraint: "users_email_unique",
        },
      }),
    ).toBe(true);
  });

  it("ignores unrelated unique violations", () => {
    expect(
      isUniqueEmailError({
        code: "23505",
        constraint: "roles_key_unique",
      }),
    ).toBe(false);
  });
});
