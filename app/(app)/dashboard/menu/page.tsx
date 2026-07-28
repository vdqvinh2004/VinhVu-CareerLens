import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/lib/auth/dal";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: t("menuMetadataTitle") };
}

export default async function DashboardMenuPage() {
  await requirePermission(PERMISSIONS.DASHBOARD_ACCESS);
  const t = await getTranslations("Dashboard");
  return <h1 className="sr-only">{t("menuHeading")}</h1>;
}
