import { describe, expect, it, vi } from "vitest";

import { createTavilyClient, TavilyError } from "@/lib/ai/tavily";

const signal = new AbortController().signal;

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Tavily raw-fetch client", () => {
  it("sends a bounded search request and normalizes metadata", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      jsonResponse({
        results: [
          {
            title: " Example report ",
            url: "https://example.com/report",
            content: "snippet",
            score: 1.2,
            published_date: "2026-07-01",
          },
        ],
      }),
    );
    const client = createTavilyClient({
      apiKey: "test-key",
      endpoint: "https://tavily.test/api/",
      fetch,
    });

    await expect(
      client.search(" jobs in Vietnam ", { signal, timeoutMs: 1_000 }),
    ).resolves.toEqual([
      {
        title: "Example report",
        url: "https://example.com/report",
        content: "snippet",
        score: 1,
        publishedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    if (!init) throw new Error("Expected fetch request options");
    expect(url).toBe("https://tavily.test/api/search");
    expect(init.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      query: "jobs in Vietnam",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    });
  });

  it("preserves multi-URL Extract partial failures", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      jsonResponse({
        results: [
          { url: "https://a.example.com/report", raw_content: "Report content" },
        ],
        failed_results: [
          { url: "https://b.example.com/report", error: "Could not extract" },
        ],
      }),
    );
    const client = createTavilyClient({ apiKey: "key", fetch });

    await expect(
      client.extract(
        ["https://a.example.com/report", "https://b.example.com/report"],
        "employment",
        { signal, timeoutMs: 1_000 },
      ),
    ).resolves.toEqual({
      results: [{ url: "https://a.example.com/report", content: "Report content" }],
      failures: [{ url: "https://b.example.com/report", error: "Could not extract" }],
    });
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({
      urls: ["https://a.example.com/report", "https://b.example.com/report"],
      query: "employment",
      chunks_per_source: 3,
      format: "markdown",
      include_images: false,
    });
  });

  it("propagates caller cancellation and rejects HTTP failures", async () => {
    const fetch = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      }),
    );
    const controller = new AbortController();
    const client = createTavilyClient({ apiKey: "key", fetch });
    const pending = client.search("query", {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort(new Error("cancelled"));
    await expect(pending).rejects.toThrow("cancelled");

    const failed = createTavilyClient({
      apiKey: "key",
      fetch: vi.fn(async () => jsonResponse({}, 429)),
    });
    await expect(
      failed.search("query", { signal, timeoutMs: 1_000 }),
    ).rejects.toBeInstanceOf(TavilyError);
  });

  it("rejects an oversized response body before parsing JSON", async () => {
    const oversized = `{"results":[],"padding":"${"x".repeat(1_024 * 1_024)}"}`;
    const client = createTavilyClient({
      apiKey: "key",
      fetch: vi.fn(async () => new Response(oversized)),
    });

    await expect(
      client.search("query", { signal, timeoutMs: 1_000 }),
    ).rejects.toThrow(/response exceeds the allowed size/);
  });

  it("bounds provider-controlled request and response strings", async () => {
    const client = createTavilyClient({
      apiKey: "key",
      fetch: vi.fn(async () =>
        jsonResponse({
          results: [
            {
              title: "x".repeat(501),
              url: "https://example.com",
              content: "",
              score: 1,
            },
          ],
        }),
      ),
    });

    await expect(
      client.search("q".repeat(501), { signal, timeoutMs: 1_000 }),
    ).rejects.toThrow(/query exceeds/);
    await expect(
      client.search("query", { signal, timeoutMs: 1_000 }),
    ).rejects.toThrow(/title exceeds/);
  });
});
