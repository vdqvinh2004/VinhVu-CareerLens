import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.forgot");
  return { title: t("metadataTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth.forgot");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
