import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  auditEvents,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/lib/db/schema";

import { DEFAULT_USER_ROLE, PERMISSIONS } from "./permissions";
import { requirePermission } from "./dal";

export async function createRole(input: {
  key: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  const viewer = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const db = getDb();

  return db.transaction(async (tx) => {
    const permissionRows = input.permissionKeys.length
      ? await tx
          .select({ id: permissions.id, key: permissions.key })
          .from(permissions)
          .where(inArray(permissions.key, input.permissionKeys))
      : [];

    if (permissionRows.length !== new Set(input.permissionKeys).size) {
      throw new Error("One or more permissions do not exist");
    }

    const [role] = await tx
      .insert(roles)
      .values({
        key: input.key,
        name: input.name,
        description: input.description,
      })
      .returning({ id: roles.id, key: roles.key });

    if (permissionRows.length) {
      await tx.insert(rolePermissions).values(
        permissionRows.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      );
    }

    await tx.insert(auditEvents).values({
      actorKind:
        viewer.actor.kind === "user" ? "USER" : "BUILTIN_SUPERADMIN",
      actorSubject:
        viewer.actor.kind === "user" ? viewer.actor.userId : viewer.actor.subject,
      action: "role.created",
      targetType: "role",
      targetId: role.id,
      metadata: { key: role.key, permissionKeys: input.permissionKeys },
    });

    return role;
  });
}

export async function replaceUserRoles(userId: string, roleKeys: string[]) {
  const viewer = await requirePermission(PERMISSIONS.ACCOUNT_ROLES_ASSIGN);
  const db = getDb();
  const requestedKeys = Array.from(new Set([DEFAULT_USER_ROLE, ...roleKeys]));

  const result = await db.transaction(async (tx) => {
    const roleRows = await tx
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(inArray(roles.key, requestedKeys));

    if (roleRows.length !== requestedKeys.length) {
      throw new Error("One or more roles do not exist");
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(
      roleRows.map((role) => ({ userId, roleId: role.id })),
    );
    const [user] = await tx
      .update(users)
      .set({
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id, sessionVersion: users.sessionVersion });

    if (!user) {
      throw new Error("Account does not exist");
    }

    await tx.insert(auditEvents).values({
      actorKind:
        viewer.actor.kind === "user" ? "USER" : "BUILTIN_SUPERADMIN",
      actorSubject:
        viewer.actor.kind === "user" ? viewer.actor.userId : viewer.actor.subject,
      action: "account.roles_replaced",
      targetType: "user",
      targetId: userId,
      metadata: { roleKeys: requestedKeys },
    });

    return user;
  });

  return result;
}

export async function updateRolePermissions(
  roleKey: string,
  permissionKeys: string[],
) {
  const viewer = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const db = getDb();

  return db.transaction(async (tx) => {
    const [role] = await tx
      .select({ id: roles.id, key: roles.key, system: roles.system })
      .from(roles)
      .where(eq(roles.key, roleKey))
      .limit(1);

    if (!role) {
      throw new Error("Role does not exist");
    }

    if (role.system) {
      throw new Error("System roles cannot be modified");
    }

    const permissionRows = permissionKeys.length
      ? await tx
          .select({ id: permissions.id, key: permissions.key })
          .from(permissions)
          .where(inArray(permissions.key, permissionKeys))
      : [];

    if (permissionRows.length !== new Set(permissionKeys).size) {
      throw new Error("One or more permissions do not exist");
    }

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));

    if (permissionRows.length) {
      await tx.insert(rolePermissions).values(
        permissionRows.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      );
    }

    await tx.insert(auditEvents).values({
      actorKind:
        viewer.actor.kind === "user" ? "USER" : "BUILTIN_SUPERADMIN",
      actorSubject:
        viewer.actor.kind === "user" ? viewer.actor.userId : viewer.actor.subject,
      action: "role.permissions_replaced",
      targetType: "role",
      targetId: role.id,
      metadata: { permissionKeys },
    });

    return role;
  });
}

export async function listAccountsAndRoles() {
  await requirePermission(PERMISSIONS.ACCOUNTS_READ);
  const db = getDb();

  return db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      roleKey: roles.key,
    })
    .from(users)
    .leftJoin(userRoles, eq(users.id, userRoles.userId))
    .leftJoin(roles, eq(userRoles.roleId, roles.id));
}
