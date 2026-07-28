"use server";

import {
  createRole,
  replaceUserRoles,
  updateRolePermissions,
} from "@/lib/auth/rbac";
import { roleAssignmentSchema, roleSchema } from "@/lib/auth/validation";

type RbacActionResult = {
  success: boolean;
  message?: string;
};

export async function createRoleAction(input: unknown): Promise<RbacActionResult> {
  const parsed = roleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Invalid role details." };
  }

  await createRole(parsed.data);
  return { success: true };
}

export async function updateRolePermissionsAction(
  input: unknown,
): Promise<RbacActionResult> {
  const parsed = roleSchema
    .pick({ permissionKeys: true })
    .extend({ roleKey: roleSchema.shape.key })
    .safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Invalid role or permissions." };
  }

  await updateRolePermissions(parsed.data.roleKey, parsed.data.permissionKeys);
  return { success: true };
}

export async function replaceUserRolesAction(
  input: unknown,
): Promise<RbacActionResult> {
  const parsed = roleAssignmentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Invalid account or roles." };
  }

  await replaceUserRoles(parsed.data.userId, parsed.data.roleKeys);
  return { success: true };
}
