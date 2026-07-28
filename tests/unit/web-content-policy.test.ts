import { describe, expect, it } from "vitest";

import {
  ExtractedContentPolicyError,
  validateExtractedContent,
} from "@/lib/ai/web/content-policy";

describe("extracted web content policy", () => {
  it.each([
    { text: "Article", contentType: "text/html; charset=utf-8" },
    { text: "# Article", metadata: { contentType: "text/markdown" } },
    { text: "{\"title\":\"Article\"}", metadata: { mimeType: "application/ld+json" } },
    { text: "<article />", contentType: "application/rss+xml" },
  ])("accepts bounded text-like content", (content) => {
    expect(validateExtractedContent(content)).toBe(content);
  });

  it.each(["", "   \n\t"])("rejects empty text", (text) => {
    expect(() =>
      validateExtractedContent({ text, contentType: "text/plain" }),
    ).toThrow(/non-empty/);
  });

  it("bounds content by UTF-8 bytes rather than characters", () => {
    expect(() =>
      validateExtractedContent(
        { text: "éé", contentType: "text/plain" },
        { maxContentBytes: 3 },
      ),
    ).toThrow(/allowed size/);
  });

  it("bounds provider-controlled metadata", () => {
    expect(() =>
      validateExtractedContent(
        {
          text: "Article",
          contentType: "text/plain",
          metadata: { description: "x".repeat(20) },
        },
        { maxMetadataBytes: 16 },
      ),
    ).toThrow(/metadata exceeds/);
  });

  it.each([
    { text: "binary", contentType: "application/pdf" },
    { text: "unknown" },
    {
      text: "conflicting metadata",
      contentType: "text/plain",
      metadata: { mimeType: "application/octet-stream" },
    },
  ])("rejects missing or non-text-like content types", (content) => {
    expect(() => validateExtractedContent(content)).toThrow(
      ExtractedContentPolicyError,
    );
  });

  it.each([
    "Login\nSign in to see this page",
    "Access denied. Please contact the administrator.",
    "Complete the CAPTCHA to continue.",
    "Please verify that you are human.",
  ])("rejects login and access-challenge pages", (text) => {
    expect(() => validateExtractedContent({ text, contentType: "text/markdown" })).toThrow(
      /access challenge or login page/,
    );
  });
});
