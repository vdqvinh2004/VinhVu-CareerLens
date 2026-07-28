"use server";

import Langfuse from "langfuse";

import { getViewer } from "@/lib/auth/dal";

export type LangfuseTrace = {
  id: string;
  name: string | null;
  timestamp: string;
  userId: string | null;
  input: unknown;
  output: unknown;
  latency?: number;
};

export type LangfuseGeneration = {
  id: string;
  name: string | null;
  model: string | null;
  startTime: string;
  endTime: string | null;
  input: unknown;
  output: unknown;
  level: string;
  statusMessage: string | null;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
};

export async function getLangfuseLogsAction(limit = 20) {
  const viewer = await getViewer();
  if (!viewer?.roles.includes("ADMIN")) {
    return { traces: [], generations: [], error: "Forbidden" };
  }

  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return { traces: [], generations: [], error: "Langfuse not configured" };
  }

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl:
      process.env.LANGFUSE_BASE_URL ??
      process.env.LANGFUSE_HOST ??
      "https://cloud.langfuse.com",
  });

  try {
    const [tracesRes, generationsRes] = await Promise.all([
      langfuse.fetchTraces({ limit }),
      langfuse.fetchObservations({ limit, type: "GENERATION" }),
    ]);

    return {
      traces: tracesRes.data as LangfuseTrace[],
      generations: generationsRes.data as LangfuseGeneration[],
      error: null,
    };
  } catch (err) {
    console.error("[admin] Langfuse fetch failed", err);
    return { traces: [], generations: [], error: "Failed to fetch logs" };
  }
}
