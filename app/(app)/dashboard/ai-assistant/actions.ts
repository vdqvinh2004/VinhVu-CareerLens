"use server";

import { and, desc, eq, inArray, notExists } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { agentRuns, chatSessions, type ChatSession } from "@/lib/db/schema";
import { AVAILABLE_MODELS, resolveAIModel } from "@/lib/ai";
import { createAgentLifecycleRepository } from "@/lib/ai/agent/lifecycle";
import { generateChatSuggestions } from "@/lib/ai/chat/suggestions";
import {
  mapPersistedMessagesToPublic,
  type PublicMessage,
} from "./_components/chat-state";

async function requireDashboardUser() {
  const { actor } = await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  if (actor.kind !== "user") throw new Error("Forbidden");
  return actor;
}

export async function getAvailableModelsAction() {
  await requireDashboardUser();
  return AVAILABLE_MODELS;
}

export async function getSuggestedPromptsAction(
  locale: string,
  model: string,
): Promise<string[]> {
  const actor = await requireDashboardUser();
  if (!AVAILABLE_MODELS.includes(model)) throw new TypeError("Unsupported AI model");

  return generateChatSuggestions({
    userId: actor.userId,
    model,
    locale: locale.toLowerCase().startsWith("vi") ? "vi" : "en",
  });
}

export async function getSessionsAction(): Promise<ChatSession[]> {
  const actor = await requireDashboardUser();

  const db = getDb();
  const sessions = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, actor.userId))
    .orderBy(desc(chatSessions.createdAt))
    .limit(50);

  return sessions.reverse();
}

export async function createSessionAction(model: string): Promise<ChatSession> {
  const actor = await requireDashboardUser();
  if (!AVAILABLE_MODELS.includes(model)) throw new TypeError("Unsupported AI model");
  const t = await getTranslations("Assistant");

  const db = getDb();
  const resolvedModel = resolveAIModel(model);
  const [session] = await db
    .insert(chatSessions)
    .values({
      userId: actor.userId,
      title: t("newChat"),
      model: resolvedModel,
    })
    .returning();

  return session;
}

export async function updateSessionModelAction(
  sessionId: string,
  model: string,
): Promise<ChatSession> {
  const actor = await requireDashboardUser();
  if (!AVAILABLE_MODELS.includes(model)) throw new TypeError("Unsupported AI model");

  const db = getDb();
  const [session] = await db
    .update(chatSessions)
    .set({ model, updatedAt: new Date() })
    .where(
      and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.userId, actor.userId),
        notExists(
          db
            .select({ id: agentRuns.id })
            .from(agentRuns)
            .where(
              and(
                eq(agentRuns.sessionId, sessionId),
                inArray(agentRuns.status, ["pending", "running"]),
              ),
            ),
        ),
      ),
    )
    .returning();

  if (!session) throw new Error("Chat session model could not be updated");
  return session;
}

export async function loadMessagesAction(sessionId: string): Promise<PublicMessage[]> {
  const actor = await requireDashboardUser();

  const messages = await createAgentLifecycleRepository().loadMessages(
    actor.userId,
    sessionId,
  );
  return mapPersistedMessagesToPublic(messages);
}

export async function deleteSessionAction(sessionId: string): Promise<void> {
  const actor = await requireDashboardUser();

  const db = getDb();
  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, actor.userId)),
    );
}
