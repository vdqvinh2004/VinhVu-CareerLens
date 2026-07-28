import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { personalityTestResults } from "@/lib/db/schema";
import type { PersonalityType } from "@/lib/personality-test";

import { PersonalityTest } from "./_components/personality-test";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PersonalityTest");
  return { title: t("metadataTitle") };
}

export default async function PersonalityTestPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [viewer, t, query] = await Promise.all([
    requireViewer(),
    getTranslations("PersonalityTest"),
    searchParams,
  ]);

  if (viewer.actor.kind !== "user") {
    redirect("/dashboard");
  }

  const [currentResult] = await getDb()
    .select({ resultType: personalityTestResults.resultType })
    .from(personalityTestResults)
    .where(eq(personalityTestResults.userId, viewer.actor.userId))
    .limit(1);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/dashboard/starting-point"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft data-icon="inline-start" />
        {t("backToProfile")}
      </Link>

      <header className="mt-6 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <div className="mt-8">
        <PersonalityTest
          currentResult={
            currentResult?.resultType as PersonalityType | undefined
          }
          initialView={query.view === "result" ? "result" : "intro"}
        />
      </div>
    </section>
  );
}
