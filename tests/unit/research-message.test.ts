import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ModelMarkdown,
  type MessageLabels,
} from "@/app/(app)/dashboard/ai-assistant/_components/research-message";
import type { UIMessage } from "@/app/(app)/dashboard/ai-assistant/_components/chat-state";

const labels: MessageLabels = {
  accessed: "Accessed",
  cancelled: "Cancelled",
  citation: (ordinal, title) => `${ordinal}: ${title}`,
  evidence: "Evidence",
  errorMessage: () => "Failed",
  external: "External",
  failed: "Failed",
  phase: {
    thinking: "Thinking",
    searching: "Searching",
    reading: "Reading",
    synthesizing: "Synthesizing",
  },
  published: "Published",
  retry: "Retry",
  sourceCount: (count) => `${count} sources`,
  sources: "Sources",
  unknownDate: "Unknown",
};

describe("AI assistant model Markdown", () => {
  it("renders no model-authored resource URLs while retaining registered citations", () => {
    const message: UIMessage = {
      id: "assistant-1",
      localId: "assistant-1",
      role: "assistant",
      content: [
        "![tracking pixel](https://attacker.example/pixel.gif)",
        "[untrusted link](https://attacker.example/phishing)",
        "Registered evidence [1].",
      ].join("\n\n"),
      model: "allowed-model",
      clientRequestId: "request-1",
      status: "completed",
      failureKind: null,
      run: null,
      sources: [{
        id: "W1",
        title: "Verified source",
        url: "https://example.com/report",
        publishedAt: null,
        accessedAt: "2026-07-19T10:00:00.000Z",
      }],
      citations: [{ ordinal: 1, sourceId: "W1", quote: "Evidence" }],
    };

    const markup = renderToStaticMarkup(createElement(ModelMarkdown, { message, labels }));

    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("attacker.example");
    expect(markup).toContain("tracking pixel");
    expect(markup).toContain("untrusted link");
    expect(markup).toContain('href="https://example.com/report"');
  });
});
