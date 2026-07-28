export const PERMISSIONS = {
  DASHBOARD_ACCESS: "dashboard.access",
  ACCOUNTS_READ: "accounts.read",
  ACCOUNT_ROLES_ASSIGN: "accounts.roles.assign",
  ROLES_READ: "roles.read",
  ROLES_MANAGE: "roles.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: ReadonlyArray<{
  key: Permission;
  description: string;
}> = [
  { key: PERMISSIONS.DASHBOARD_ACCESS, description: "Access the dashboard" },
  { key: PERMISSIONS.ACCOUNTS_READ, description: "Read account information" },
  {
    key: PERMISSIONS.ACCOUNT_ROLES_ASSIGN,
    description: "Assign roles to accounts",
  },
  { key: PERMISSIONS.ROLES_READ, description: "Read roles and permissions" },
  { key: PERMISSIONS.ROLES_MANAGE, description: "Create and update roles" },
];

export const DEFAULT_USER_ROLE = "USER";
