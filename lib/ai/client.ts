import { readWorkspace } from "@/lib/browser-storage";
export const DEFAULT_MODEL = "Qwen3.6-27B";
export function resolveAIModel(model?: string | null) {
  return model?.trim() || readWorkspace().ai.model || DEFAULT_MODEL;
}
export function validateAISettings(input: { apiKey: string; baseUrl: string; model: string }) {
  const url = new URL(input.baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Use an HTTPS API URL, or HTTP for a local provider.");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("API URL cannot contain credentials, query parameters, or fragments.");
  if (!input.model.trim() || input.model.length > 120) throw new Error("Enter a valid model name.");
  if (!input.apiKey.trim()) throw new Error("Enter your API key in Settings.");
  return { apiKey: input.apiKey.trim(), baseUrl: url.href.replace(/\/$/, ""), model: input.model.trim() };
}
