import "server-only";

import { createAgentRunRequestSchema } from "../agent/schemas";
import type { AgentRunRequest } from "../agent/schemas";
import type { ChatService } from "./service";

const MAX_BODY_BYTES = 100_000;

export type ChatHttpViewer = {
  userId: string;
  permissions: readonly string[];
};

export type ChatHttpDependencies = {
  allowedModels: readonly string[];
  authenticate(): Promise<ChatHttpViewer | null>;
  isRetry(userId: string, input: AgentRunRequest): Promise<boolean>;
  rateLimit(userId: string): Promise<{
    allowed: boolean;
    retryAfterMs: number;
  }>;
  service(): ChatService;
};

type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; tooLarge: boolean };

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

async function readBoundedBody(request: Request): Promise<BodyReadResult> {
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel("Request body is too large").catch(() => undefined);
        return { ok: false, tooLarge: true };
      }
      chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(body) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

export function createChatHttpHandler(dependencies: ChatHttpDependencies) {
  const schema = createAgentRunRequestSchema(dependencies.allowedModels);

  return async function POST(request: Request): Promise<Response> {
    if (request.signal.aborted) {
      return errorResponse(499, "request_cancelled", "Request was cancelled");
    }
    const viewer = await dependencies.authenticate();
    if (!viewer) return errorResponse(401, "unauthorized", "Unauthorized");
    if (!viewer.permissions.includes("dashboard.access")) {
      return errorResponse(403, "forbidden", "Forbidden");
    }

    const mediaType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (mediaType !== "application/json") {
      return errorResponse(
        415,
        "unsupported_media_type",
        "Content-Type must be application/json",
      );
    }

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      await request.body?.cancel("Request body is too large").catch(() => undefined);
      return errorResponse(413, "body_too_large", "Request body is too large");
    }

    const raw = await readBoundedBody(request);
    if (!raw.ok) {
      if (raw.tooLarge) {
        return errorResponse(413, "body_too_large", "Request body is too large");
      }
      return errorResponse(400, "invalid_body", "Request body could not be read");
    }

    let body: unknown;
    try {
      body = JSON.parse(raw.text) as unknown;
    } catch {
      return errorResponse(400, "invalid_json", "Request body must be valid JSON");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, "invalid_request", "Request body is invalid");
    }

    let retry = false;
    try {
      retry = await dependencies.isRetry(viewer.userId, parsed.data);
    } catch {
      // A failed lookup must not let a new request bypass the token bucket.
    }
    if (!retry) {
      let limit: Awaited<ReturnType<ChatHttpDependencies["rateLimit"]>>;
      try {
        limit = await dependencies.rateLimit(viewer.userId);
      } catch {
        return errorResponse(
          503,
          "rate_limit_unavailable",
          "Service is temporarily unavailable",
        );
      }
      if (!limit.allowed) {
        return errorResponse(429, "rate_limited", "Too many requests", {
          "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1_000))),
        });
      }
    }

    try {
      return await dependencies.service().stream(parsed.data, {
        userId: viewer.userId,
        signal: request.signal,
      });
    } catch {
      return errorResponse(503, "ai_unavailable", "AI service is not configured");
    }
  };
}
