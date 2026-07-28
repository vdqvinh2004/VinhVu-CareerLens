import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    env: {
      FPT_AI_MODEL: process.env.FPT_AI_MODEL ?? "Qwen3.6-27B",
    },
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
