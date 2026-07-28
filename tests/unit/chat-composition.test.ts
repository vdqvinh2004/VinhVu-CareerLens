import { describe, expect, it } from "vitest";

import {
  buildCanonicalChatHistory,
  classifyChatText,
  isPrivateChatClassification,
} from "@/lib/ai/chat";
import type { PersistedAgentMessage } from "@/lib/ai/agent/lifecycle";

function message(index: number): PersistedAgentMessage {
  return {
    id: `message-${String(index).padStart(2, "0")}`,
    sessionId: "session-1",
    role: index % 2 === 0 ? "user" : "assistant",
    content: `content-${index}`,
    model: index % 2 === 0 ? null : "model-1",
    status: "completed",
    dataClasses: ["public"],
    clientRequestId: index % 2 === 0 ? `request-${index}` : null,
    createdAt: new Date(`2026-07-19T00:${String(index).padStart(2, "0")}:00.000Z`),
    run: null,
    sources: [],
    citations: [],
  };
}

describe("chat data classification", () => {
  it.each([
    "Liên hệ tôi qua student@example.com",
    "Số điện thoại của tôi là 0912 345 678",
    "CCCD: 001203004567",
    "My full name is Jane Marie Doe",
    "Tên tôi là Nguyễn Văn An",
    "I am Jane Doe.",
    "Tôi là Nguyễn Văn An.",
    "I live at 123 Main Street",
    "Tôi sống tại 42 đường Lê Lợi",
    "Send it to 18 Phố Huế",
    "Address: 77 Nguyen Hue",
  ])("classifies personal identifiers conservatively", (text) => {
    const classification = classifyChatText(text);
    expect(classification.has("personal_data")).toBe(true);
    expect(isPrivateChatClassification(classification)).toBe(true);
  });

  it.each([
    "What is the outlook for the Ho Chi Minh City property market?",
    "Compare the job markets in Hanoi and Da Nang",
    "2026 Wall Street market outlook",
    "Retail trends near Nguyen Hue Street",
    "Best restaurants on 5th Avenue in New York",
    "Find scholarships for engineering students",
    "Compare university scholarship deadlines in 2026",
    "What is the outlook for the employer branding market?",
    "How should a student improve a LinkedIn profile?",
    "Find scholarships received by Jane Marie Doe",
    "What is the date of birth of Jane Marie Doe?",
    "When was Jane Marie Doe born?",
    "Find the LinkedIn profile for Jane Marie Doe",
    "Who is the employer of Jane Marie Doe?",
  ])("keeps ordinary market and location queries public", (text) => {
    expect(classifyChatText(text)).toEqual(new Set(["public"]));
  });

  it("classifies pasted or user-owned CV content without blocking general CV questions", () => {
    expect(classifyChatText("Hãy đánh giá CV của tôi bên dưới").has("private_document")).toBe(
      true,
    );
    expect(
      classifyChatText("WORK EXPERIENCE\nDeveloper\nEDUCATION\nUniversity").has(
        "private_document",
      ),
    ).toBe(true);
    expect(classifyChatText("Cách viết CV tốt là gì?").has("private_document")).toBe(false);
  });
});

describe("canonical chat composition", () => {
  it("maps the deterministic latest 20 and excludes pending/current assistant messages", () => {
    const messages = Array.from({ length: 25 }, (_, index) => message(index));
    messages.push({
      ...message(25),
      id: "current-assistant",
      content: "must not be sent",
      status: "pending",
    });
    messages.push({
      ...message(26),
      id: "other-pending-assistant",
      content: "must not be sent either",
      role: "assistant",
      status: "streaming",
    });

    const items = buildCanonicalChatHistory(messages, "current-assistant");

    expect(items).toHaveLength(21);
    expect(items[0]).toMatchObject({ role: "system", id: "meshmind-system-v1" });
    expect(items.slice(1).map((item) => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `message-${String(index + 5).padStart(2, "0")}`),
    );
    expect(JSON.stringify(items)).not.toContain("must not be sent");
  });
});
