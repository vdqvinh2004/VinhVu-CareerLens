import { NextResponse } from "next/server";
import Langfuse from "langfuse";

// Temporary debug endpoint — remove before production
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const userId = searchParams.get("userId") ?? undefined;

  if (
    !process.env.LANGFUSE_PUBLIC_KEY ||
    !process.env.LANGFUSE_SECRET_KEY
  ) {
    return NextResponse.json({ error: "Langfuse not configured" }, { status: 503 });
  }

  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl:
      process.env.LANGFUSE_BASE_URL ??
      process.env.LANGFUSE_HOST ??
      "https://cloud.langfuse.com",
  });

  const [traces, generations] = await Promise.all([
    langfuse.fetchTraces({ limit, userId }),
    langfuse.fetchObservations({ limit, type: "GENERATION" }),
  ]);

  return NextResponse.json({
    traces: traces.data,
    generations: generations.data,
  });
}
