import "server-only";

import Langfuse from "langfuse";

// Singleton — reused across requests in the same Node.js process
let client: Langfuse | null = null;

export function getLangfuse(): Langfuse | null {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    return null;
  }

  if (!client) {
    const baseUrl = process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
    console.log("[langfuse] init baseUrl:", baseUrl);
    client = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl,
      flushAt: 1,
    });
  }

  return client;
}
