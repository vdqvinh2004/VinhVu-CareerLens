import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CircleDotDashed,
  Clock3,
  Compass,
  DatabaseZap,
  FileCheck2,
  Globe2,
  GraduationCap,
  Lightbulb,
  LineChart,
  Link2,
  MessageSquareText,
  Radar,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  Waypoints,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";

import { LandingReveal } from "./_components/landing-motion";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=2200&q=88";
const CV_IMAGE =
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1800&q=86";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Landing.meta");

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function LandingPage() {
  const [t, viewer] = await Promise.all([
    getTranslations("Landing"),
    getViewer().catch(() => null),
  ]);
  const isLearner = viewer?.actor.kind === "user";
  const primaryHref = viewer
    ? isLearner
      ? "/dashboard/careerlens"
      : "/dashboard"
    : "/signup";
  const primaryLabel = viewer ? t("hero.primaryAuthenticated") : t("hero.primary");

  const intelligenceLayers = [
    {
      icon: UserRoundCheck,
      index: "01",
      title: t("intelligence.profile.title"),
      description: t("intelligence.profile.description"),
    },
    {
      icon: Waypoints,
      index: "02",
      title: t("intelligence.growth.title"),
      description: t("intelligence.growth.description"),
    },
    {
      icon: Radar,
      index: "03",
      title: t("intelligence.market.title"),
      description: t("intelligence.market.description"),
    },
  ];
  const assessmentSignals = [
    {
      icon: BrainCircuit,
      label: t("assessment.signals.aptitude"),
      state: t("assessment.states.observe"),
    },
    {
      icon: UsersRound,
      label: t("assessment.signals.social"),
      state: t("assessment.states.practice"),
    },
    {
      icon: Lightbulb,
      label: t("assessment.signals.motivation"),
      state: t("assessment.states.develop"),
    },
  ];
  const journeySteps = [
    {
      icon: Compass,
      stage: t("journey.steps.explore.stage"),
      title: t("journey.steps.explore.title"),
      description: t("journey.steps.explore.description"),
    },
    {
      icon: GraduationCap,
      stage: t("journey.steps.learn.stage"),
      title: t("journey.steps.learn.title"),
      description: t("journey.steps.learn.description"),
    },
    {
      icon: BriefcaseBusiness,
      stage: t("journey.steps.experience.stage"),
      title: t("journey.steps.experience.title"),
      description: t("journey.steps.experience.description"),
    },
    {
      icon: TrendingUp,
      stage: t("journey.steps.grow.stage"),
      title: t("journey.steps.grow.title"),
      description: t("journey.steps.grow.description"),
    },
  ];
  const prioritySkills = [
    {
      label: t("roadmap.skills.foundation"),
      timing: t("roadmap.priority.now"),
      width: "w-full",
    },
    {
      label: t("roadmap.skills.project"),
      timing: t("roadmap.priority.next"),
      width: "w-4/5",
    },
    {
      label: t("roadmap.skills.social"),
      timing: t("roadmap.priority.maintain"),
      width: "w-3/5",
    },
  ];
  const sourceGroups = [
    { label: "ILOSTAT", type: t("market.sources.labor") },
    { label: "World Bank", type: t("market.sources.macro") },
    { label: "O*NET / ESCO", type: t("market.sources.skills") },
    { label: "WEF", type: t("market.sources.future") },
  ];
  const trustItems = [
    {
      icon: Link2,
      title: t("trust.citations.title"),
      description: t("trust.citations.description"),
    },
    {
      icon: ShieldCheck,
      title: t("trust.privacy.title"),
      description: t("trust.privacy.description"),
    },
    {
      icon: MessageSquareText,
      title: t("trust.explain.title"),
      description: t("trust.explain.description"),
    },
    {
      icon: Compass,
      title: t("trust.autonomy.title"),
      description: t("trust.autonomy.description"),
    },
  ];
  const faqItems = [
    { question: t("faq.items.one.question"), answer: t("faq.items.one.answer") },
    { question: t("faq.items.two.question"), answer: t("faq.items.two.answer") },
    { question: t("faq.items.three.question"), answer: t("faq.items.three.answer") },
    { question: t("faq.items.four.question"), answer: t("faq.items.four.answer") },
  ];

  return (
    <div className="overflow-clip bg-background">
      <section className="px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="relative isolate min-h-[calc(100dvh-5rem)] overflow-hidden rounded-[2rem] bg-foreground sm:rounded-[2.5rem]">
          <Image
            src={HERO_IMAGE}
            alt={t("hero.imageAlt")}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[58%_42%]"
          />
          <div className="landing-hero-vignette absolute inset-0" aria-hidden="true" />
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-35" aria-hidden="true" />

          <div className="relative mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-360 items-end gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-12 lg:py-12">
            <LandingReveal className="max-w-4xl">
              <Badge className="bg-background text-foreground hover:bg-background">
                <Sparkles data-icon="inline-start" aria-hidden="true" />
                {t("hero.badge")}
              </Badge>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white text-balance sm:text-6xl lg:text-7xl">
                {t("hero.titleLine1")}
                <span className="mt-1 block text-white/72">{t("hero.titleLine2")}</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
                {t("hero.description")}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className={cn(buttonVariants({ size: "lg" }), "h-12 px-5")}
                >
                  {primaryLabel}
                  <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                </Link>
                <Link
                  href="#features"
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "lg" }),
                    "h-12 px-5",
                  )}
                >
                  {t("hero.secondary")}
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </div>
            </LandingReveal>

            <LandingReveal delay={0.12} className="lg:justify-self-end">
              <div className="rounded-[2rem] bg-white/12 p-1.5 ring-1 ring-white/18">
                <div className="overflow-hidden rounded-[calc(2rem-0.375rem)] bg-background/95 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7)]">
                  <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="landing-agent-pulse flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <Bot aria-hidden="true" className="size-4" strokeWidth={1.5} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{t("hero.preview.title")}</p>
                        <p className="text-xs text-muted-foreground">{t("hero.preview.status")}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{t("hero.preview.badge")}</Badge>
                  </div>
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
                      <Search aria-hidden="true" className="size-4 text-primary" strokeWidth={1.5} />
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t("hero.preview.searching")}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2" aria-label={t("hero.preview.sourcesLabel")}>
                      {["O*NET", "ILOSTAT", "WEF"].map((source) => (
                        <span
                          key={source}
                          className="rounded-xl bg-primary/8 px-2 py-2 text-center font-mono text-[0.625rem] font-medium text-primary"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 border-t border-border/70 pt-4">
                      <Route aria-hidden="true" className="size-5 text-primary" strokeWidth={1.5} />
                      <p className="text-sm font-medium">{t("hero.preview.result")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </LandingReveal>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-360 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <LandingReveal className="max-w-4xl">
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
            {t("intelligence.title")}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {t("intelligence.description")}
          </p>
        </LandingReveal>

        <div className="mt-16 border-y border-border/80">
          {intelligenceLayers.map((item, index) => {
            const Icon = item.icon;

            return (
              <LandingReveal
                key={item.index}
                delay={index * 0.06}
                className="grid gap-5 border-b border-border/80 py-8 last:border-b-0 md:grid-cols-[5rem_minmax(14rem,0.7fr)_minmax(0,1fr)] md:items-center md:gap-8"
              >
                <span className="font-mono text-xs text-muted-foreground">{item.index}</span>
                <div className="flex items-center gap-4">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                </div>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground md:justify-self-end">
                  {item.description}
                </p>
              </LandingReveal>
            );
          })}
        </div>
      </section>

      <section id="features" className="scroll-mt-24 border-y border-border/70 bg-muted/35">
        <div className="mx-auto grid w-full max-w-360 gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[minmax(0,0.8fr)_minmax(32rem,1.2fr)] lg:items-center lg:gap-20 lg:px-8">
          <LandingReveal>
            <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {t("assessment.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("assessment.description")}
            </p>
            <div className="mt-9 flex flex-col gap-5">
              {assessmentSignals.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-background text-primary ring-1 ring-border/70">
                      <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    </span>
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
                      {item.state}
                    </span>
                  </div>
                );
              })}
            </div>
          </LandingReveal>

          <LandingReveal delay={0.1}>
            <div className="rounded-[2.25rem] bg-foreground/6 p-1.5 ring-1 ring-foreground/6">
              <div className="overflow-hidden rounded-[calc(2.25rem-0.375rem)] bg-foreground text-background shadow-[inset_0_1px_0_rgb(255_255_255_/_0.12)]">
                <div className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(13rem,0.85fr)]">
                  <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                      <Badge variant="secondary">{t("assessment.preview.badge")}</Badge>
                      <span className="font-mono text-xs text-background/45">02 / 08</span>
                    </div>
                    <p className="mt-8 max-w-lg text-xl font-medium leading-8 sm:text-2xl">
                      {t("assessment.preview.question")}
                    </p>
                    <div className="mt-8 grid gap-3">
                      {(["one", "two", "three"] as const).map((option, index) => (
                        <div
                          key={option}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm",
                            index === 1
                              ? "bg-background text-foreground"
                              : "bg-background/7 text-background/60 ring-1 ring-background/10",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded-full ring-1",
                              index === 1 ? "bg-primary text-primary-foreground ring-primary" : "ring-background/25",
                            )}
                          >
                            {index === 1 ? <Check aria-hidden="true" className="size-3" strokeWidth={2} /> : null}
                          </span>
                          {t(`assessment.preview.options.${option}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-background/10 bg-background/[0.055] p-6 sm:p-8 md:border-l md:border-t-0">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-background/45">
                      {t("assessment.preview.reading")}
                    </p>
                    <div className="mt-7 flex flex-col gap-7">
                      {assessmentSignals.map((item, index) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span>{item.label}</span>
                            <span className="text-background/45">0{index + 1}</span>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/10">
                            <div
                              className={cn(
                                "landing-signal-bar h-full origin-left rounded-full bg-primary",
                                index === 0 ? "w-[88%]" : index === 1 ? "w-[72%]" : "w-[62%]",
                              )}
                              style={{ animationDelay: `${index * 160}ms` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-8 text-xs leading-5 text-background/50">
                      {t("assessment.preview.note")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </LandingReveal>
        </div>
      </section>

      <section id="journey" className="scroll-mt-24 px-3 py-3 sm:px-4 sm:py-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-foreground text-background sm:rounded-[2.5rem]">
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-360 px-5 py-24 sm:px-8 sm:py-32 lg:px-12">
            <LandingReveal className="max-w-4xl">
              <Badge variant="secondary">{t("journey.badge")}</Badge>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
                {t("journey.title")}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-background/58 sm:text-lg">
                {t("journey.description")}
              </p>
            </LandingReveal>

            <div className="relative mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {journeySteps.map((item, index) => {
                const Icon = item.icon;

                return (
                  <LandingReveal key={item.stage} delay={index * 0.06} className="relative">
                    <div className="relative h-full rounded-[1.75rem] bg-background/[0.055] p-5 ring-1 ring-background/10">
                      <span className="relative flex size-12 items-center justify-center rounded-full bg-background text-foreground">
                        <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
                      </span>
                      <p className="mt-7 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-background/40">
                        {item.stage}
                      </p>
                      <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-background/55">{item.description}</p>
                    </div>
                  </LandingReveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-360 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <LandingReveal className="max-w-4xl">
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
            {t("roadmap.title")}
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {t("roadmap.description")}
          </p>
        </LandingReveal>

        <div className="mt-14 grid overflow-hidden rounded-[2rem] bg-border/70 p-px md:grid-cols-12 md:gap-px">
          <LandingReveal className="bg-background p-6 sm:p-8 md:col-span-7 md:row-span-2">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                  {t("roadmap.priority.label")}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">{t("roadmap.priority.title")}</h3>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Target aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </span>
            </div>
            <div className="mt-10 flex flex-col gap-7">
              {prioritySkills.map((skill, index) => (
                <div key={skill.label}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{skill.label}</span>
                    <span className="text-xs text-muted-foreground">{skill.timing}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("landing-signal-bar h-full origin-left rounded-full bg-primary", skill.width)}
                      style={{ animationDelay: `${index * 140}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-border/70 pt-6 text-sm text-muted-foreground">
              <CircleDotDashed aria-hidden="true" className="size-4 text-primary" strokeWidth={1.5} />
              {t("roadmap.priority.note")}
            </div>
          </LandingReveal>

          <LandingReveal delay={0.06} className="bg-primary p-6 text-primary-foreground sm:p-8 md:col-span-5">
            <Route aria-hidden="true" className="size-8" strokeWidth={1.5} />
            <h3 className="mt-8 text-2xl font-semibold tracking-tight">{t("roadmap.paths.title")}</h3>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/72">{t("roadmap.paths.description")}</p>
            <div className="mt-7 flex items-center gap-2">
              {["A", "B", "C"].map((path) => (
                <span key={path} className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/12 font-mono text-xs">
                  {path}
                </span>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal delay={0.1} className="bg-muted p-6 sm:p-8 md:col-span-5">
            <Clock3 aria-hidden="true" className="size-8 text-primary" strokeWidth={1.5} />
            <h3 className="mt-8 text-2xl font-semibold tracking-tight">{t("roadmap.adaptive.title")}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("roadmap.adaptive.description")}</p>
            <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-background px-3 py-1.5">{t("roadmap.adaptive.checkIn")}</span>
              <ArrowRight aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
              <span className="rounded-full bg-background px-3 py-1.5">{t("roadmap.adaptive.adjust")}</span>
            </div>
          </LandingReveal>
        </div>
      </section>

      <section id="market" className="scroll-mt-24 border-y border-border/70 bg-muted/35">
        <div className="mx-auto w-full max-w-360 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <LandingReveal className="max-w-4xl">
            <Badge variant="secondary">{t("market.badge")}</Badge>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
              {t("market.title")}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("market.description")}
            </p>
          </LandingReveal>

          <div className="mt-14 rounded-[2.25rem] bg-foreground/6 p-1.5 ring-1 ring-foreground/6">
            <div className="overflow-hidden rounded-[calc(2.25rem-0.375rem)] bg-background">
              <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
                <LandingReveal className="relative min-h-[32rem] overflow-hidden bg-foreground p-6 text-background sm:p-8 lg:p-10">
                  <div className="landing-market-grid pointer-events-none absolute inset-0" aria-hidden="true" />
                  <div className="landing-market-scan pointer-events-none absolute inset-x-0 top-0 h-px bg-primary" aria-hidden="true" />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-center justify-between gap-5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-full bg-background/8 ring-1 ring-background/12">
                          <Globe2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{t("market.agent.title")}</p>
                          <p className="text-xs text-background/45">{t("market.agent.status")}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{t("market.agent.live")}</Badge>
                    </div>

                    <div className="my-auto py-16">
                      <p className="max-w-xl text-2xl font-medium leading-9 sm:text-3xl sm:leading-10">
                        {t("market.agent.query")}
                      </p>
                      <div className="mt-8 flex flex-wrap gap-2">
                        {[t("market.agent.web"), t("market.agent.jobs"), t("market.agent.reports")].map((item) => (
                          <span key={item} className="rounded-full bg-background/7 px-3 py-1.5 text-xs text-background/62 ring-1 ring-background/10">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {sourceGroups.map((source) => (
                        <div key={source.label} className="rounded-2xl bg-background/[0.055] p-3 ring-1 ring-background/10">
                          <p className="font-mono text-[0.625rem] font-medium">{source.label}</p>
                          <p className="mt-1 text-[0.625rem] leading-4 text-background/40">{source.type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </LandingReveal>

                <LandingReveal delay={0.08} className="p-6 sm:p-8 lg:p-10">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                        {t("market.forecast.label")}
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight">{t("market.forecast.title")}</h3>
                    </div>
                    <LineChart aria-hidden="true" className="size-7 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("market.forecast.description")}</p>

                  <div className="mt-8 flex flex-col gap-3">
                    {(["growing", "stable", "uncertain"] as const).map((state, index) => (
                      <div key={state} className="flex items-center gap-4 rounded-2xl bg-muted/70 p-4">
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-full",
                            index === 0 ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                          )}
                        >
                          {index === 0 ? (
                            <TrendingUp aria-hidden="true" className="size-4" strokeWidth={1.5} />
                          ) : index === 1 ? (
                            <LineChart aria-hidden="true" className="size-4" strokeWidth={1.5} />
                          ) : (
                            <CircleDotDashed aria-hidden="true" className="size-4" strokeWidth={1.5} />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{t(`market.forecast.states.${state}.title`)}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {t(`market.forecast.states.${state}.description`)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex items-start gap-3 border-t border-border/70 pt-6">
                    <DatabaseZap aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
                    <p className="text-xs leading-5 text-muted-foreground">{t("market.forecast.note")}</p>
                  </div>
                </LandingReveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-360 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(28rem,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-20">
          <LandingReveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-muted">
              <Image
                src={CV_IMAGE}
                alt={t("cv.imageAlt")}
                fill
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-background/95 p-4 text-foreground shadow-[0_18px_60px_rgb(0_0_0_/_0.16)] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <FileCheck2 aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t("cv.photoCard.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("cv.photoCard.description")}</p>
                  </div>
                </div>
              </div>
            </div>
          </LandingReveal>

          <LandingReveal delay={0.08}>
            <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {t("cv.title")}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("cv.description")}
            </p>
            <div className="mt-9 rounded-[2rem] bg-foreground/6 p-1.5 ring-1 ring-foreground/6">
              <div className="rounded-[calc(2rem-0.375rem)] bg-background p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles aria-hidden="true" className="size-4" strokeWidth={1.5} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{t("cv.review.title")}</p>
                      <p className="text-xs text-muted-foreground">{t("cv.review.status")}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{t("cv.review.badge")}</Badge>
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  {(["evidence", "clarity", "match"] as const).map((item, index) => (
                    <div key={item} className="grid grid-cols-[2rem_1fr] gap-3 rounded-2xl bg-muted/65 p-4">
                      <span className="font-mono text-xs text-primary">0{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{t(`cv.review.items.${item}.title`)}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t(`cv.review.items.${item}.description`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </LandingReveal>
        </div>
      </section>

      <section className="border-y border-border/70">
        <div className="mx-auto w-full max-w-360 px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <LandingReveal className="max-w-4xl">
            <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl">
              {t("trust.title")}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t("trust.description")}
            </p>
          </LandingReveal>

          <div className="mt-14 grid gap-x-10 gap-y-0 border-t border-border/80 md:grid-cols-2">
            {trustItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <LandingReveal
                  key={item.title}
                  delay={(index % 2) * 0.06}
                  className="grid grid-cols-[2.75rem_1fr] gap-4 border-b border-border/80 py-7"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </LandingReveal>
              );
            })}
          </div>

          <LandingReveal className="mt-10 flex flex-col gap-4 rounded-[1.75rem] bg-muted p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold">{t("trust.scope.title")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("trust.scope.description")}</p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {t("trust.scope.badge")}
            </Badge>
          </LandingReveal>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-360 gap-16 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[minmax(0,0.75fr)_minmax(30rem,1.25fr)] lg:gap-24 lg:px-8">
        <LandingReveal>
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
            {t("faq.title")}
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">{t("faq.description")}</p>
        </LandingReveal>

        <div className="border-t border-border/80">
          {faqItems.map((item, index) => (
            <LandingReveal key={item.question} delay={index * 0.04}>
              <details className="group border-b border-border/80">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
                  <span>{item.question}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-45 motion-reduce:transition-none">
                    <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={1.5} />
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 pr-12 text-sm leading-6 text-muted-foreground">{item.answer}</p>
              </details>
            </LandingReveal>
          ))}
        </div>
      </section>

      <section className="px-3 pb-3 sm:px-4 sm:pb-4">
        <LandingReveal className="relative overflow-hidden rounded-[2rem] bg-primary px-5 py-20 text-primary-foreground sm:rounded-[2.5rem] sm:px-10 sm:py-24">
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative mx-auto flex w-full max-w-360 flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div className="max-w-4xl">
              <h2 className="text-4xl font-semibold leading-[1] tracking-[-0.05em] text-balance sm:text-6xl lg:text-7xl">
                {t("finalCta.title")}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-primary-foreground/72 sm:text-lg">
                {t("finalCta.description")}
              </p>
            </div>
            <Link
              href={primaryHref}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-12 shrink-0 px-5",
              )}
            >
              {primaryLabel}
              <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </div>
        </LandingReveal>
      </section>
    </div>
  );
}
