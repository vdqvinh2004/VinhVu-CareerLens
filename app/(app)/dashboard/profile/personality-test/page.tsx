"use client";
import { useWorkspace } from "@/lib/browser-storage";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import type { PersonalityType } from "@/lib/personality-test";

import { PersonalityTest } from "./_components/personality-test";


export default function PersonalityTestPage() {
  const { personality: currentResult } = useWorkspace();
  const t = useTranslations("PersonalityTest");
  const query = { view: new URLSearchParams(window.location.search).get("view") };
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
