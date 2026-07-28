import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignupFlow } from "../_components/signup-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signup");
  return { title: t("metadataTitle") };
}

export default function SignupPage() {
  return <SignupFlow currentYear={new Date().getUTCFullYear()} />;
}
