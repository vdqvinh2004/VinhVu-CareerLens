import { describe, expect, it, vi } from "vitest";

import { createChatHttpHandler } from "@/lib/ai/chat/http";
import type { ChatService } from "@/lib/ai/chat/service";

const validBody = {
  clientRequestId: "request-1",
  sessionId: "session-1",
  message: "Tư vấn ngành học",
  model: "model-1",
  forceWeb: false,
};

function request(body: unknown = validBody) {
  return new Request("http://localhost/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setup(overrides: {
  authenticate?: () => Promise<{ userId: string; permissions: string[] } | null>;
  isRetry?: () => Promise<boolean>;
  rateLimit?: () => Promise<{ allowed: boolean; retryAfterMs: number }>;
  stream?: ChatService["stream"];
} = {}) {
  const stream = vi.fn(
    overrides.stream ?? (async () => new Response("streamed", { status: 200 })),
  );
  const handler = createChatHttpHandler({
    allowedModels: ["model-1"],
    authenticate:
      overrides.authenticate ??
      (async () => ({ userId: "user-1", permissions: ["dashboard.access"] })),
    isRetry: overrides.isRetry ?? (async () => false),
    rateLimit:
      overrides.rateLimit ?? (async () => ({ allowed: true, retryAfterMs: 0 })),
    service: () => ({ stream }),
  });
  return { handler, stream };
}

describe("chat HTTP boundary", () => {
  it("requires a normal authorized dashboard user", async () => {
    const anonymous = setup({ authenticate: async () => null });
    expect((await anonymous.handler(request())).status).toBe(401);

    const forbidden = setup({
      authenticate: async () => ({ userId: "user-1", permissions: [] }),
    });
    expect((await forbidden.handler(request())).status).toBe(403);
  });

  it("rejects a pre-aborted request before authentication or service work", async () => {
    const authenticate = vi.fn(async () => ({
      userId: "user-1",
      permissions: ["dashboard.access"],
    }));
    const runtime = setup({ authenticate });
    const controller = new AbortController();
    controller.abort("user");
    const input = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
      signal: controller.signal,
    });

    expect((await runtime.handler(input)).status).toBe(499);
    expect(authenticate).not.toHaveBeenCalled();
    expect(runtime.stream).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies, unknown keys, and models outside the allow-list", async () => {
    const { handler, stream } = setup();
    const malformed = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });

    expect((await handler(malformed)).status).toBe(400);
    expect((await handler(request({ ...validBody, extra: true }))).status).toBe(400);
    expect((await handler(request({ ...validBody, model: "unknown" }))).status).toBe(400);
    expect(stream).not.toHaveBeenCalled();
  });

  it("requires application/json while allowing charset parameters", async () => {
    const { handler, stream } = setup();
    const missing = new Request("http://localhost/api/chat/stream", {
      method: "POST",
    });
    const wrong = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(validBody),
    });
    const charset = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(validBody),
    });

    expect((await handler(missing)).status).toBe(415);
    expect((await handler(wrong)).status).toBe(415);
    expect((await handler(charset)).status).toBe(200);
    expect(stream).toHaveBeenCalledOnce();
  });

  it("rejects declared and chunked bodies over 100KB and cancels overflow reads", async () => {
    const { handler, stream } = setup();
    const declared = new Request("http://localhost/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "100001",
      },
      body: "{}",
    });
    const cancelled = vi.fn();
    let chunk = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunk += 1;
        controller.enqueue(new Uint8Array(60_000));
        if (chunk === 3) controller.close();
      },
      cancel: cancelled,
    });
    const chunked = new Request(
      "http://localhost/api/chat/stream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        duplex: "half",
      } as RequestInit,
    );

    expect((await handler(declared)).status).toBe(413);
    expect((await handler(chunked)).status).toBe(413);
    expect(cancelled).toHaveBeenCalledOnce();
    expect(stream).not.toHaveBeenCalled();
  });

  it("fails closed when Redis is unavailable and returns a bounded retry hint", async () => {
    const unavailable = setup({
      rateLimit: async () => {
        throw new Error("redis unavailable");
      },
    });
    expect((await unavailable.handler(request())).status).toBe(503);

    const denied = setup({
      rateLimit: async () => ({ allowed: false, retryAfterMs: 1_250 }),
    });
    const response = await denied.handler(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
  });

  it("delegates only the parsed request and user-scoped signal", async () => {
    const { handler, stream } = setup();
    const input = request();

    expect((await handler(input)).status).toBe(200);
    expect(stream).toHaveBeenCalledWith(validBody, {
      userId: "user-1",
      signal: input.signal,
    });
  });

  it("bypasses chat token consumption only for a persisted retry", async () => {
    const rateLimit = vi.fn(async () => ({ allowed: false, retryAfterMs: 60_000 }));
    const isRetry = vi.fn(async () => true);
    const { handler, stream } = setup({
      isRetry,
      rateLimit,
    });

    expect((await handler(request())).status).toBe(200);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(stream).toHaveBeenCalledOnce();
    expect(isRetry).toHaveBeenCalledWith("user-1", validBody);
  });

  it("keeps an identity mismatch rate limited before service lifecycle work", async () => {
    const isRetry = vi.fn(async () => false);
    const rateLimit = vi.fn(async () => ({ allowed: false, retryAfterMs: 60_000 }));
    const { handler, stream } = setup({ isRetry, rateLimit });

    expect((await handler(request({ ...validBody, message: "Different payload" }))).status).toBe(
      429,
    );
    expect(isRetry).toHaveBeenCalledWith("user-1", {
      ...validBody,
      message: "Different payload",
    });
    expect(stream).not.toHaveBeenCalled();
  });
});
