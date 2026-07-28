import { describe, expect, it } from "vitest";

import { createOpaqueToken, hmacSha256, sha256 } from "@/lib/auth/crypto";

describe("authentication token primitives", () => {
  it("creates URL-safe high-entropy tokens", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(first).not.toBe(second);
  });

  it("uses purpose-specific keyed digests", () => {
    const secret = Buffer.alloc(32, 7);
    expect(hmacSha256("session:value", secret)).not.toBe(
      hmacSha256("rate-limit:value", secret),
    );
    expect(sha256("value")).toBe(sha256("value"));
  });
});
