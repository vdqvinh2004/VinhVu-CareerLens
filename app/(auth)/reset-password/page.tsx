import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "../_components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.reset");
  return { title: t("metadataTitle"), referrer: "no-referrer" };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const t = await getTranslations("Auth.reset");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
