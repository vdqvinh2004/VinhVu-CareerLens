import "server-only";

import { getDb } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

import type { Actor } from "./actor";
import { getActorSubject } from "./actor";

type AuditEvent = {
  actor?: Actor;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditEvent(event: AuditEvent) {
  await getDb().insert(auditEvents).values({
    actorKind:
      event.actor?.kind === "user"
        ? "USER"
        : event.actor?.kind === "builtin-superadmin"
          ? "BUILTIN_SUPERADMIN"
          : "SYSTEM",
    actorSubject: event.actor ? getActorSubject(event.actor) : "system",
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    metadata: event.metadata,
  });
}
