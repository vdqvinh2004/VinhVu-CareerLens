import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/lib/db/schema";

import type { Actor } from "./actor";
import { getSuperadminConfig } from "./config";
import type { Permission } from "./permissions";
import { getSession, revokeAllSessions } from "./session";

export type Viewer = {
  actor: Actor;
  displayName: string;
  email: string | null;
  roles: string[];
  permissions: string[];
};

export class ForbiddenError extends Error {
  constructor() {
    super("You do not have permission to perform this action.");
    this.name = "ForbiddenError";
  }
}

async function revokeInvalidSession(actor: Actor) {
  try {
    await revokeAllSessions(actor);
  } catch {
    // PostgreSQL state remains authoritative even if Redis cleanup is unavailable.
  }
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (session.actor.kind === "builtin-superadmin") {
    const config = getSuperadminConfig();

    if (session.actor.credentialVersion !== config.credentialVersion) {
      await revokeInvalidSession(session.actor);
      return null;
    }

    return {
      actor: session.actor,
      displayName: "Superadmin",
      email: null,
      roles: ["BUILTIN_SUPERADMIN"],
      permissions: ["*"],
    };
  }

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, session.actor.userId))
    .limit(1);

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !== session.actor.authVersion
  ) {
    await revokeInvalidSession(session.actor);
    return null;
  }

  const [roleRows, permissionRows] = await Promise.all([
    db
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id)),
    db
      .selectDistinct({ key: permissions.key })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, user.id)),
  ]);

  return {
    actor: session.actor,
    displayName: user.fullName,
    email: user.email,
    roles: roleRows.map((role) => role.key),
    permissions: permissionRows.map((permission) => permission.key),
  };
});

export async function requireViewer() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/login");
  }

  return viewer;
}

export async function requirePermission(permission: Permission) {
  const viewer = await getViewer();

  if (!viewer) {
    throw new ForbiddenError();
  }

  if (
    viewer.actor.kind !== "builtin-superadmin" &&
    !viewer.permissions.includes(permission)
  ) {
    throw new ForbiddenError();
  }

  return viewer;
}
