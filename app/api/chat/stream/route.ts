import { AVAILABLE_MODELS } from "@/lib/ai/client";
import { createChatHttpHandler } from "@/lib/ai/chat/http";
import {
  checkChatRateLimit,
  getProductionChatService,
  isChatRetry,
} from "@/lib/ai/chat/production";
import { getViewer } from "@/lib/auth/dal";

export const runtime = "nodejs";

export const POST = createChatHttpHandler({
  allowedModels: AVAILABLE_MODELS,
  async authenticate() {
    const viewer = await getViewer();
    if (!viewer || viewer.actor.kind !== "user") return null;
    return {
      userId: viewer.actor.userId,
      permissions: viewer.permissions,
    };
  },
  isRetry: isChatRetry,
  rateLimit: checkChatRateLimit,
  service: getProductionChatService,
});
