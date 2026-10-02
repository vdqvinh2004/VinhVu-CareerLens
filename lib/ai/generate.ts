import { readWorkspace } from "@/lib/browser-storage";
import { resolveAIModel, validateAISettings } from "./client";
import { AIServiceError } from "./errors";
export type MessageRole = "system" | "user" | "assistant";
export interface AIMessage { role: MessageRole; content: string }
export interface AIGenerateOptions {
  systemPrompt: string; userPrompt: string; rawInput?: unknown; model?: string;
}
export interface FPTRawResponse {
  choices: Array<{ message: { content: string | null } }>;
  model?: string;
}
export interface AIGenerateResult { text: string; messages: AIMessage[]; rawResponse: FPTRawResponse }
export async function completeChat(messages: AIMessage[], model?: string, signal?: AbortSignal): Promise<string> {
  const settings = validateAISettings(readWorkspace().ai);
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({ model: resolveAIModel(model), messages }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AIServiceError("AI request failed. Check API URL, network, and provider browser (CORS) support.");
  }
  if (!response.ok) throw new AIServiceError(`AI provider returned HTTP ${response.status}. Check your key, model, and quota.`);
  const data: unknown = await response.json();
  const content = (data as FPTRawResponse)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new AIServiceError("AI provider returned no text.");
  return content;
}
export async function generateAIResponse(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const messages: AIMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userPrompt + (options.rawInput === undefined ? "" : `\n<data>\n${JSON.stringify(options.rawInput)}\n</data>`) },
  ];
  const text = await completeChat(messages, options.model);
  return { text, messages, rawResponse: { choices: [{ message: { content: text } }] } };
}
export async function generateAIJson<T = unknown>(options: AIGenerateOptions) {
  const result = await generateAIResponse(options);
  const text = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return { ...result, data: JSON.parse(text) as T }; }
  catch { throw new AIServiceError("AI provider returned invalid JSON. Try again or choose another model."); }
}
