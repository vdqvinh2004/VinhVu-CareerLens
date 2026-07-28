import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requirePermission, requireViewer } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";

import { DashboardShell } from "./_components/dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: t("metadataTitle") };
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await requireViewer();
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);

  return (
    <DashboardShell
      viewer={{
        canEditProfile: viewer.actor.kind === "user",
        displayName: viewer.displayName,
        email: viewer.email,
        isAdmin: viewer.roles.includes("ADMIN"),
      }}
    >
      {children}
    </DashboardShell>
  );
}
