import "server-only";

import { and, eq, ne, notExists } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { agentRuns, chatMessages, chatSessions } from "@/lib/db/schema";

export type UpdateFirstSessionTitleInput = {
  userId: string;
  sessionId: string;
  runId: string;
  title: string;
  now: Date;
};

export type ChatDataStore = {
  updateFirstSessionTitle(input: UpdateFirstSessionTitleInput): Promise<void>;
};

export function safeChatTitle(message: string): string {
  const normalized = message.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return [...normalized].slice(0, 60).join("") || "Cuộc trò chuyện mới";
}

export async function isPersistedChatRequest(
  userId: string,
  input: {
    clientRequestId: string;
    sessionId: string;
    message: string;
    model: string;
    forceWeb: boolean;
  },
): Promise<boolean> {
  const [run] = await getDb()
    .select({
      sessionId: agentRuns.sessionId,
      model: agentRuns.model,
      forceWeb: agentRuns.forceWeb,
      message: chatMessages.content,
    })
    .from(agentRuns)
    .innerJoin(chatMessages, eq(chatMessages.id, agentRuns.userMessageId))
    .where(
      and(
        eq(agentRuns.userId, userId),
        eq(agentRuns.clientRequestId, input.clientRequestId),
      ),
    )
    .limit(1);
  return Boolean(
    run &&
      run.sessionId === input.sessionId &&
      run.model === input.model &&
      run.forceWeb === input.forceWeb &&
      run.message === input.message.trim(),
  );
}

export function createChatDataStore(): ChatDataStore {
  return {
    async updateFirstSessionTitle(input) {
      const db = getDb();
      await db
        .update(chatSessions)
        .set({ title: safeChatTitle(input.title), updatedAt: input.now })
        .where(
          and(
            eq(chatSessions.id, input.sessionId),
            eq(chatSessions.userId, input.userId),
            notExists(
              db
                .select({ id: agentRuns.id })
                .from(agentRuns)
                .where(
                  and(
                    eq(agentRuns.sessionId, input.sessionId),
                    eq(agentRuns.status, "completed"),
                    ne(agentRuns.id, input.runId),
                  ),
                ),
            ),
          ),
        );
    },
  };
}
