import "server-only";

export const TAVILY_API_ENDPOINT = "https://api.tavily.com";

const MAX_RESPONSE_BYTES = 1_024 * 1_024;
const MAX_QUERY_CHARS = 500;
const MAX_URL_CHARS = 2_048;
const MAX_TITLE_CHARS = 500;
const MAX_SEARCH_CONTENT_CHARS = 4_000;
const MAX_EXTRACT_CONTENT_CHARS = 256 * 1_024;
const MAX_FAILURE_CHARS = 1_000;

type Fetch = typeof fetch;
type JsonObject = Record<string, unknown>;

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedAt: string | null;
};

export type TavilyExtractResult = {
  url: string;
  content: string;
};

export type TavilyExtractFailure = {
  url: string;
  error: string;
};

export type TavilyExtractResponse = {
  results: TavilyExtractResult[];
  failures: TavilyExtractFailure[];
};

export type TavilyRequestOptions = {
  signal: AbortSignal;
  timeoutMs: number;
};

export interface TavilyClient {
  search(query: string, options: TavilyRequestOptions): Promise<TavilySearchResult[]>;
  extract(
    urls: readonly string[],
    query: string | undefined,
    options: TavilyRequestOptions,
  ): Promise<TavilyExtractResponse>;
}

export type TavilyClientOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: Fetch;
};

export class TavilyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TavilyError";
  }
}

function object(value: unknown, context: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TavilyError(`Malformed Tavily ${context}`);
  }
  return value as JsonObject;
}

function string(value: unknown, context: string, maxChars: number): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TavilyError(`Malformed Tavily ${context}`);
  }
  if (value.length > maxChars) {
    throw new TavilyError(`Tavily ${context} exceeds the allowed size`);
  }
  return value;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new TavilyError(`Malformed Tavily ${context}`);
  return value;
}

function optionalString(value: unknown, context: string, maxChars: number): string {
  if (typeof value !== "string") throw new TavilyError(`Malformed Tavily ${context}`);
  if (value.length > maxChars) {
    throw new TavilyError(`Tavily ${context} exceeds the allowed size`);
  }
  return value;
}

function responseUrl(endpoint: string, path: "search" | "extract"): string {
  let base: URL;
  try {
    base = new URL(endpoint);
  } catch (cause) {
    throw new TavilyError("Invalid Tavily endpoint", { cause });
  }
  return new URL(path, base.href.endsWith("/") ? base : `${base.href}/`).toString();
}

function parsePublishedAt(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const publishedAt = string(value, "search published_date", 100);
  const timestamp = Date.parse(publishedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function parseSearchResponse(value: unknown): TavilySearchResult[] {
  const response = object(value, "search response");
  return array(response.results, "search results").slice(0, 5).map((entry) => {
    const result = object(entry, "search result");
    const score = result.score;
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new TavilyError("Malformed Tavily search score");
    }
    return {
      title: string(result.title, "search title", MAX_TITLE_CHARS).trim(),
      url: string(result.url, "search URL", MAX_URL_CHARS).trim(),
      content:
        typeof result.content === "string"
          ? optionalString(
              result.content,
              "search content",
              MAX_SEARCH_CONTENT_CHARS,
            ).trim()
          : "",
      score: Math.max(0, Math.min(1, score)),
      publishedAt: parsePublishedAt(result.published_date),
    };
  });
}

function parseExtractResponse(value: unknown): TavilyExtractResponse {
  const response = object(value, "extract response");
  const results = array(response.results, "extract results").slice(0, 4).map((entry) => {
    const result = object(entry, "extract result");
    return {
      url: string(result.url, "extract URL", MAX_URL_CHARS).trim(),
      content: string(
        result.raw_content,
        "extract raw_content",
        MAX_EXTRACT_CONTENT_CHARS,
      ),
    };
  });
  const failures = array(response.failed_results ?? [], "failed extract results").slice(0, 4).map(
    (entry) => {
      const failure = object(entry, "failed extract result");
      return {
        url: string(failure.url, "failed extract URL", MAX_URL_CHARS).trim(),
        error: string(failure.error, "failed extract error", MAX_FAILURE_CHARS).trim(),
      };
    },
  );
  return { results, failures };
}

async function requestJson(
  fetchImplementation: Fetch,
  url: string,
  apiKey: string,
  body: JsonObject,
  options: TavilyRequestOptions,
): Promise<unknown> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new TavilyError("Tavily timeout must be a positive integer");
  }
  const timeoutController = new AbortController();
  const signal = AbortSignal.any([options.signal, timeoutController.signal]);
  const timeout = setTimeout(
    () => timeoutController.abort(new Error("Tavily request timed out")),
    options.timeoutMs,
  );
  timeout.unref?.();

  try {
    const response = await fetchImplementation(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new TavilyError(`Tavily request failed with status ${response.status}`);
    }
    try {
      if (!response.body) throw new Error("Response body is missing");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let bytesRead = 0;
      let serialized = "";
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          bytesRead += next.value.byteLength;
          if (bytesRead > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new TavilyError("Tavily response exceeds the allowed size");
          }
          serialized += decoder.decode(next.value, { stream: true });
        }
        serialized += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      return JSON.parse(serialized) as unknown;
    } catch (cause) {
      if (cause instanceof TavilyError) throw cause;
      throw new TavilyError("Tavily returned malformed JSON", { cause });
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function createTavilyClient(options: TavilyClientOptions): TavilyClient {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new TavilyError("Tavily API key is required");
  const endpoint = options.endpoint ?? TAVILY_API_ENDPOINT;
  const fetchImplementation = options.fetch ?? fetch;
  const searchEndpoint = responseUrl(endpoint, "search");
  const extractEndpoint = responseUrl(endpoint, "extract");

  return Object.freeze({
    async search(query: string, requestOptions: TavilyRequestOptions) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) throw new TavilyError("Tavily search query is required");
      if (normalizedQuery.length > MAX_QUERY_CHARS) {
        throw new TavilyError("Tavily search query exceeds the allowed size");
      }
      const response = await requestJson(
        fetchImplementation,
        searchEndpoint,
        apiKey,
        {
          query: normalizedQuery,
          search_depth: "basic",
          max_results: 5,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        },
        requestOptions,
      );
      return parseSearchResponse(response);
    },

    async extract(
      urls: readonly string[],
      query: string | undefined,
      requestOptions: TavilyRequestOptions,
    ) {
      if (urls.length === 0 || urls.length > 4) {
        throw new TavilyError("Tavily Extract requires 1-4 URLs");
      }
      if (urls.some((url) => url.length === 0 || url.length > MAX_URL_CHARS)) {
        throw new TavilyError("Tavily Extract URL exceeds the allowed size");
      }
      const body: JsonObject = {
        urls: [...urls],
        extract_depth: "basic",
        include_images: false,
        format: "markdown",
      };
      const normalizedQuery = query?.trim();
      if (normalizedQuery && normalizedQuery.length > MAX_QUERY_CHARS) {
        throw new TavilyError("Tavily Extract query exceeds the allowed size");
      }
      if (normalizedQuery) {
        body.query = normalizedQuery;
        body.chunks_per_source = 3;
      }
      const response = await requestJson(
        fetchImplementation,
        extractEndpoint,
        apiKey,
        body,
        requestOptions,
      );
      return parseExtractResponse(response);
    },
  });
}
