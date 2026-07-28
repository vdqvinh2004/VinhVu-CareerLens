import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "../../_components/auth-card";
import { SuperadminLoginForm } from "../../_components/superadmin-login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.superadmin");
  return {
    title: t("metadataTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SuperadminLoginPage() {
  const t = await getTranslations("Auth.superadmin");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <SuperadminLoginForm />
    </AuthCard>
  );
}
