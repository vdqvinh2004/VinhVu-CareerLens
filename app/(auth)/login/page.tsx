import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "../_components/auth-card";
import { LoginForm } from "../_components/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  return { title: t("metadataTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("Auth.login");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <LoginForm />
    </AuthCard>
  );
}
