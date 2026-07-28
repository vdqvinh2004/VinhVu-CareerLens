"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  GraduationCap,
  Leaf,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type {
  JourneyEntryCategory,
  JourneyEntrySource,
  JourneyEntryView,
} from "@/lib/journey";
import { cn } from "@/lib/utils";

import {
  askJourneyAiAction,
  createJourneyEntryAction,
  deleteJourneyEntryAction,
  updateJourneyEntryAction,
} from "../actions";

type EntryDraft = {
  title: string;
  description: string;
  targetDate: string;
  category: JourneyEntryCategory;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type MonthGroup = {
  key: string;
  year: number;
  month: number;
  entries: JourneyEntryView[];
};

const categoryIcons = {
  learning: GraduationCap,
  experience: Leaf,
  career: BriefcaseBusiness,
  personal: UserRound,
} satisfies Record<JourneyEntryCategory, typeof GraduationCap>;

const categoryOptions: JourneyEntryCategory[] = [
  "learning",
  "experience",
  "career",
  "personal",
];

const sourceIcons = {
  manual: UserRound,
  roadmap: Sparkles,
  ai: Bot,
} satisfies Record<JourneyEntrySource, typeof UserRound>;

const futureStars = [
  { className: "top-3 left-[12%]", delay: 0, duration: 3.2, size: "size-3" },
  { className: "top-7 right-[17%]", delay: 0.8, duration: 2.7, size: "size-4" },
  { className: "bottom-4 left-[42%]", delay: 1.4, duration: 3.6, size: "size-3" },
] as const;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): EntryDraft {
  return {
    title: "",
    description: "",
    targetDate: todayString(),
    category: "personal",
  };
}

function monthGroups(
  entries: JourneyEntryView[],
  startYear: number,
  endYear: number,
) {
  const entryMap = new Map<string, JourneyEntryView[]>();
  entries.forEach((entry) => {
    const key = entry.targetDate.slice(0, 7);
    const current = entryMap.get(key) ?? [];
    current.push(entry);
    entryMap.set(key, current);
  });

  const groups: MonthGroup[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      groups.push({ key, year, month, entries: entryMap.get(key) ?? [] });
    }
  }
  return groups;
}

function JourneySourceBadge({ source }: { source: JourneyEntrySource }) {
  const t = useTranslations("Journey");
  const Icon = sourceIcons[source];

  return (
    <Badge
      variant="outline"
      data-source={source}
      className="journey-source-badge"
    >
      <Icon data-icon="inline-start" />
      {t(`sources.${source}`)}
    </Badge>
  );
}

function JourneySourceLegend() {
  const t = useTranslations("Journey");

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted-foreground">
        {t("sourceLegend")}
      </span>
      <JourneySourceBadge source="manual" />
      <JourneySourceBadge source="roadmap" />
      <JourneySourceBadge source="ai" />
    </div>
  );
}

function JourneyNode({
  entry,
  index,
  onEdit,
  onToggle,
  pendingId,
}: {
  entry: JourneyEntryView;
  index: number;
  onEdit: (entry: JourneyEntryView) => void;
  onToggle: (entry: JourneyEntryView, completed: boolean) => void;
  pendingId: string | null;
}) {
  const t = useTranslations("Journey");
  const shouldReduceMotion = useReducedMotion();
  const Icon = categoryIcons[entry.category];
  const isLeft = index % 2 === 0;

  return (
    <motion.article
      layout
      initial={
        shouldReduceMotion
          ? false
          : { opacity: 0, x: isLeft ? -18 : 18, y: 10 }
      }
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative grid gap-4 pl-12 md:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] md:pl-0",
        entry.completed && "opacity-70",
      )}
    >
      <div
        data-source={entry.source}
        className={cn(
          "journey-entry rounded-2xl border p-5 md:col-span-1",
          isLeft ? "md:col-start-1" : "md:col-start-3",
        )}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            aria-label={t("toggle", { title: entry.title })}
            checked={entry.completed}
            disabled={pendingId === entry.id}
            onCheckedChange={(checked) => onToggle(entry, checked)}
            className="mt-1"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3
                className={cn(
                  "text-base font-semibold leading-6 tracking-[-0.015em]",
                  entry.completed && "line-through decoration-primary/50",
                )}
              >
                {entry.title}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("edit")}
                onClick={() => onEdit(entry)}
                className="shrink-0"
              >
                <Pencil />
              </Button>
            </div>
            {entry.description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {entry.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <JourneySourceBadge source={entry.source} />
              <span className="flex items-center gap-1.5">
                <Icon aria-hidden="true" className="size-3.5" />
                {t(`categories.${entry.category}`)}
              </span>
              {entry.sourceLabel ? (
                <span>{t("fromRoadmap", { source: entry.sourceLabel })}</span>
              ) : null}
              {entry.completed ? (
                <span className="font-medium text-primary">{t("done")}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <span
        aria-hidden="true"
        data-source={entry.source}
        className="journey-source-node absolute top-5 left-4 flex size-8 items-center justify-center rounded-full border shadow-sm md:left-1/2 md:-translate-x-1/2"
      >
        {entry.completed ? (
          <Check className="size-4" strokeWidth={2.2} />
        ) : (
          <Icon className="size-4" strokeWidth={1.8} />
        )}
      </span>
    </motion.article>
  );
}

function MonthSection({
  group,
  onEdit,
  onToggle,
  pendingId,
}: {
  group: MonthGroup;
  onEdit: (entry: JourneyEntryView) => void;
  onToggle: (entry: JourneyEntryView, completed: boolean) => void;
  pendingId: string | null;
}) {
  const locale = useLocale();
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(Date.UTC(group.year, group.month, 1)),
  );

  return (
    <section
      id={`journey-${group.key}`}
      data-journey-year={group.month === 0 ? group.year : undefined}
      className={cn(
        "relative pb-14 [contain-intrinsic-size:0_12rem] [content-visibility:auto] md:pb-20",
        group.entries.length === 0 && "pb-10 md:pb-14",
      )}
    >
      <div className="mb-7 grid grid-cols-[2.5rem_1fr] items-center gap-3 md:grid-cols-[1fr_4rem_1fr]">
        <span className="relative flex size-10 items-center justify-center rounded-full border bg-background font-mono text-xs font-semibold text-muted-foreground md:col-start-2 md:justify-self-center">
          {String(group.month + 1).padStart(2, "0")}
        </span>
        <h2 className="text-sm font-medium capitalize text-muted-foreground md:col-start-3">
          {monthName}
        </h2>
      </div>

      {group.entries.length > 0 ? (
        <div className="flex flex-col gap-5 md:gap-7">
          {group.entries.map((entry, index) => (
            <JourneyNode
              key={entry.id}
              entry={entry}
              index={index}
              onEdit={onEdit}
              onToggle={onToggle}
              pendingId={pendingId}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EntryDialog({
  entry,
  open,
  onOpenChange,
  onDeleted,
  onSaved,
}: {
  entry: JourneyEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (entryId: string) => void;
  onSaved: (entry: JourneyEntryView) => void;
}) {
  const t = useTranslations("Journey");
  const [draft, setDraft] = useState<EntryDraft>(() =>
    entry
      ? {
          category: entry.category,
          description: entry.description,
          targetDate: entry.targetDate,
          title: entry.title,
        }
      : emptyDraft(),
  );
  const [pending, setPending] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const categoryItems = categoryOptions.map((category) => ({
    value: category,
    label: t(`categories.${category}`),
  }));

  function submit() {
    if (!draft.title.trim() || !draft.targetDate) return;
    setPending(true);
    startTransition(async () => {
      try {
        const saved = entry
          ? await updateJourneyEntryAction({
              entryId: entry.id,
              ...draft,
            })
          : await createJourneyEntryAction(draft);
        if (saved) {
          onSaved(saved);
          onOpenChange(false);
        }
      } finally {
        setPending(false);
      }
    });
  }

  function deleteEntry() {
    if (!entry || deletePending) return;
    setDeletePending(true);
    setDeleteError(false);

    startTransition(async () => {
      try {
        const deletedEntryId = await deleteJourneyEntryAction(entry.id);
        if (!deletedEntryId) {
          setDeleteError(true);
          return;
        }
        setDeleteDialogOpen(false);
        onOpenChange(false);
        onDeleted(deletedEntryId);
      } catch {
        setDeleteError(true);
      } finally {
        setDeletePending(false);
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{entry ? t("editTitle") : t("addTitle")}</DialogTitle>
            <DialogDescription>{t("entryDescription")}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
          <Field>
            <FieldLabel htmlFor="journey-title">{t("fields.title")}</FieldLabel>
            <Input
              id="journey-title"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="journey-description">
              {t("fields.description")}
            </FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                id="journey-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
              />
            </InputGroup>
            <FieldDescription>{t("fields.descriptionHint")}</FieldDescription>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="journey-date">{t("fields.date")}</FieldLabel>
              <Input
                id="journey-date"
                type="date"
                value={draft.targetDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    targetDate: event.target.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="journey-category">
                {t("fields.category")}
              </FieldLabel>
              <Select
                items={categoryItems}
                value={draft.category}
                onValueChange={(value) => {
                  if (value) {
                    setDraft((current) => ({
                      ...current,
                      category: value as JourneyEntryCategory,
                    }));
                  }
                }}
              >
                <SelectTrigger id="journey-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categoryItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          </FieldGroup>
          <DialogFooter className={entry ? "sm:justify-between" : undefined}>
            {entry ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDeleteError(false);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 data-icon="inline-start" />
                {t("delete")}
              </Button>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="button" disabled={pending} onClick={submit}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {t("save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!deletePending) setDeleteDialogOpen(nextOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { title: entry?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("deleteError")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={deleteEntry}
            >
              {deletePending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {t("confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AiJourneyDialog({
  entries,
  open,
  onEntriesChange,
  onOpenChange,
}: {
  entries: JourneyEntryView[];
  open: boolean;
  onEntriesChange: (entries: JourneyEntryView[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Journey");
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: t("ai.welcome") },
  ]);

  function sendPrompt() {
    const content = prompt.trim();
    if (!content || pending) return;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content },
    ]);
    setPrompt("");
    setError(null);
    setPending(true);

    startTransition(async () => {
      try {
        const result = await askJourneyAiAction(content);
        onEntriesChange(result.changedEntries);
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.assistantMessage,
          },
        ]);
      } catch {
        setError(t("ai.error"));
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(46rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            {t("ai.title")}
          </DialogTitle>
          <DialogDescription>{t("ai.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <Message key={message.id} align={isUser ? "end" : "start"}>
                {!isUser ? (
                  <MessageAvatar className="size-8 self-start bg-primary text-primary-foreground">
                    <Bot className="size-4" />
                  </MessageAvatar>
                ) : null}
                <MessageContent className={isUser ? "max-w-[82%]" : "max-w-[90%]"}>
                  {!isUser ? <MessageHeader>{t("ai.name")}</MessageHeader> : null}
                  <Bubble
                    align={isUser ? "end" : "start"}
                    variant={isUser ? "default" : "tinted"}
                  >
                    <BubbleContent className="whitespace-pre-wrap">
                      {message.content}
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            );
          })}
          {pending ? (
            <Message align="start">
              <MessageAvatar className="size-8 self-start bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </MessageAvatar>
              <MessageContent>
                <Bubble variant="tinted">
                  <BubbleContent className="flex items-center gap-2">
                    <Spinner />
                    {t("ai.working")}
                  </BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          ) : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="border-t bg-popover px-6 py-5">
          <InputGroup>
            <InputGroupTextarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendPrompt();
                }
              }}
              placeholder={t("ai.placeholder")}
              rows={2}
              disabled={pending || entries.length === 0}
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <span className="text-xs">{t("ai.hint")}</span>
              <InputGroupButton
                size="icon-sm"
                variant="default"
                aria-label={t("ai.send")}
                disabled={!prompt.trim() || pending}
                onClick={sendPrompt}
              >
                <Send />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JourneyReflection({ entries }: { entries: JourneyEntryView[] }) {
  const t = useTranslations("Journey");
  const completedCount = entries.filter((entry) => entry.completed).length;
  const nextEntry = entries.find((entry) => !entry.completed);
  const progress = entries.length > 0 ? Math.round((completedCount / entries.length) * 100) : 0;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl bg-foreground p-6 text-background shadow-[0_24px_70px_color-mix(in_oklch,var(--primary)_13%,transparent)] sm:p-7"
    >
      <div aria-hidden="true" className="absolute top-0 right-0 size-32 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-medium text-background/70">
          <Sparkles aria-hidden="true" className="size-4" />
          {t("reflection.label")}
        </div>
        <p className="mt-5 text-xl font-semibold leading-8 tracking-[-0.025em]">
          {entries.length === 0
            ? t("reflection.empty")
            : t("reflection.progress", { completed: completedCount, total: entries.length })}
        </p>
        {nextEntry ? (
          <p className="mt-4 text-sm leading-6 text-background/60">
            {t("reflection.next", { title: nextEntry.title })}
          </p>
        ) : entries.length > 0 ? (
          <p className="mt-4 text-sm leading-6 text-background/60">
            {t("reflection.complete")}
          </p>
        ) : null}
        <div className="mt-7 flex items-end justify-between border-t border-background/15 pt-5">
          <span className="text-xs text-background/50">{t("reflection.identity")}</span>
          <span className="font-mono text-3xl font-semibold tracking-[-0.06em]">
            {progress}%
          </span>
        </div>
      </div>
    </motion.aside>
  );
}

function FutureFooter({ entries }: { entries: JourneyEntryView[] }) {
  const t = useTranslations("Journey");
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [minimized, setMinimized] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 3);
  const expectations = entries
    .filter((entry) => {
      const date = new Date(`${entry.targetDate}T00:00:00`);
      return !entry.completed && date >= today && date <= horizon;
    });
  const hasOverflow =
    expectations.length > 3 ||
    expectations.some(
      (entry) => entry.title.length + entry.description.length > 140,
    );
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 left-3 z-30 transition-[left] duration-200 ease-out motion-reduce:transition-none md:right-5 md:bottom-5 md:left-[calc(var(--dashboard-sidebar-width)_+_1rem)]">
      <motion.footer
        layout={!shouldReduceMotion}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 30, delay: 0.16 }
        }
        className="journey-future-footer pointer-events-auto relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border px-4 py-4 backdrop-blur-xl sm:px-5 sm:py-5 lg:px-6"
      >
        {futureStars.map((star) => (
          <motion.span
            key={star.className}
            aria-hidden="true"
            animate={
              shouldReduceMotion
                ? { opacity: 0.45 }
                : {
                    opacity: [0.2, 0.85, 0.2],
                    rotate: [0, 12, 0],
                    scale: [0.78, 1.08, 0.78],
                  }
            }
            transition={{
              delay: star.delay,
              duration: star.duration,
              ease: "easeInOut",
              repeat: shouldReduceMotion ? 0 : Infinity,
            }}
            className={cn("absolute text-current", star.className)}
          >
            <Sparkles className={star.size} />
          </motion.span>
        ))}

        <div className="relative flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="journey-future-icon flex size-11 shrink-0 items-center justify-center rounded-2xl border">
                <Target className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium opacity-70">
                  {t("future.eyebrow")}
                </p>
                <p className="mt-0.5 text-sm font-semibold sm:text-base">
                  {t("future.label")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={
                minimized ? t("future.expand") : t("future.collapse")
              }
              aria-expanded={!minimized}
              aria-controls="journey-future-expectations"
              onClick={() => setMinimized((current) => !current)}
            >
              <span className="hidden sm:inline">
                {minimized ? t("future.expand") : t("future.collapse")}
              </span>
              {minimized ? (
                <Maximize2 data-icon="inline-end" />
              ) : (
                <Minimize2 data-icon="inline-end" />
              )}
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {!minimized ? (
              <motion.div
                key="future-expectations"
                id="journey-future-expectations"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
                className={cn(
                  "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3",
                  hasOverflow && "max-h-[42dvh] overflow-y-auto pr-1",
                )}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {expectations.length > 0 ? (
                    expectations.map((entry, index) => (
                      <motion.article
                        layout={!shouldReduceMotion}
                        key={entry.id}
                        initial={
                          shouldReduceMotion || index < 3
                            ? false
                            : { opacity: 0, y: 10 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
                        }
                        transition={{ duration: shouldReduceMotion ? 0 : 0.24 }}
                        className="journey-future-item rounded-2xl border px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold leading-5">
                            {entry.title}
                          </h3>
                          <time
                            dateTime={entry.targetDate}
                            className="shrink-0 font-mono text-[0.68rem] opacity-65"
                          >
                            {dateFormatter.format(
                              new Date(`${entry.targetDate}T00:00:00`),
                            )}
                          </time>
                        </div>
                        {entry.description ? (
                          <p className="mt-1.5 text-xs leading-5 opacity-70">
                            {entry.description}
                          </p>
                        ) : null}
                      </motion.article>
                    ))
                  ) : (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="journey-future-item rounded-2xl border px-4 py-3 text-sm opacity-75 sm:col-span-2 xl:col-span-3"
                    >
                      {t("future.empty")}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.footer>
    </div>
  );
}

export function JourneyTimeline({
  initialEntries,
  importedCount,
}: {
  initialEntries: JourneyEntryView[];
  importedCount: number | null;
}) {
  const t = useTranslations("Journey");
  const currentYear = new Date().getFullYear();
  const latestEntryYear = initialEntries.reduce(
    (latest, entry) => Math.max(latest, Number(entry.targetDate.slice(0, 4))),
    currentYear,
  );
  const [entries, setEntries] = useState(initialEntries);
  const [visibleEndYear, setVisibleEndYear] = useState(
    Math.max(currentYear + 2, latestEntryYear),
  );
  const [activeYear, setActiveYear] = useState(currentYear);
  const [editingEntry, setEditingEntry] = useState<JourneyEntryView | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [floatingActionsVisible, setFloatingActionsVisible] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const startYear = Math.min(
    currentYear,
    entries.reduce(
      (earliest, entry) => Math.min(earliest, Number(entry.targetDate.slice(0, 4))),
      currentYear,
    ),
  );
  const groups = useMemo(
    () => monthGroups(entries, startYear, visibleEndYear),
    [entries, startYear, visibleEndYear],
  );
  const years = Array.from(
    { length: visibleEndYear - startYear + 1 },
    (_, index) => startYear + index,
  );

  useEffect(() => {
    const headerActions = headerActionsRef.current;
    if (!headerActions) return;

    const observer = new IntersectionObserver(([observation]) => {
      if (!observation) return;
      setFloatingActionsVisible(
        !observation.isIntersecting && observation.boundingClientRect.bottom <= 0,
      );
    });
    observer.observe(headerActions);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([observation]) => {
        if (observation?.isIntersecting) {
          setVisibleEndYear((year) => year + 1);
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-journey-year]"),
    );
    const observer = new IntersectionObserver(
      (observations) => {
        const visible = observations
          .filter((observation) => observation.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const value = visible?.target.getAttribute("data-journey-year");
        if (value) setActiveYear(Number(value));
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visibleEndYear]);

  function saveLocal(entry: JourneyEntryView) {
    setEntries((current) => {
      const exists = current.some((item) => item.id === entry.id);
      const next = exists
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [...current, entry];
      return next.toSorted((a, b) => a.targetDate.localeCompare(b.targetDate));
    });
  }

  function toggleEntry(entry: JourneyEntryView, completed: boolean) {
    setPendingId(entry.id);
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, completed } : item,
      ),
    );
    startTransition(async () => {
      try {
        const saved = await updateJourneyEntryAction({
          completed,
          entryId: entry.id,
        });
        if (saved) saveLocal(saved);
      } catch {
        setEntries((current) =>
          current.map((item) =>
            item.id === entry.id ? { ...item, completed: entry.completed } : item,
          ),
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function openAddDialog() {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  }

  function openEditDialog(entry: JourneyEntryView) {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  }

  function deleteLocal(entryId: string) {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    setEditingEntry(null);
  }

  function goToYear(year: number) {
    setActiveYear(year);
    document
      .querySelector<HTMLElement>(`[data-journey-year="${year}"]`)
      ?.scrollIntoView({ behavior: shouldReduceMotion ? "auto" : "smooth" });
  }

  const completedCount = entries.filter((entry) => entry.completed).length;

  return (
    <div className="relative min-h-dvh pb-60">
      <div aria-hidden="true" className="journey-ambient pointer-events-none absolute inset-x-0 top-0 h-[44rem]" />
      <div className="relative mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <motion.header
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.65fr)] lg:items-end lg:gap-14"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarDays aria-hidden="true" className="size-4" />
              {t("eyebrow")}
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-balance sm:text-5xl lg:text-6xl lg:leading-[1.02]">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {t("description")}
            </p>
            <div ref={headerActionsRef} className="mt-7 flex flex-wrap gap-3">
              <Button type="button" size="lg" onClick={openAddDialog}>
                <Plus data-icon="inline-start" />
                {t("add")}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => setAiDialogOpen(true)}
              >
                <Sparkles data-icon="inline-start" />
                {t("askAi")}
              </Button>
            </div>
            {importedCount !== null ? (
              <p className="mt-5 text-sm font-medium text-primary" role="status">
                {importedCount > 0
                  ? t("imported", { count: importedCount })
                  : t("importFailed")}
              </p>
            ) : null}
          </div>
          <JourneyReflection entries={entries} />
        </motion.header>

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_5rem] lg:gap-10">
          <main className="relative min-w-0">
            <div
              aria-hidden="true"
              className="absolute top-5 bottom-0 left-5 border-l-2 border-dashed border-primary/25 md:left-1/2"
            />

            {entries.length === 0 ? (
              <div className="relative mb-14 ml-12 rounded-3xl border border-dashed bg-card/80 p-7 md:mx-auto md:max-w-xl md:text-center">
                <Sparkles aria-hidden="true" className="size-6 text-primary md:mx-auto" />
                <h2 className="mt-4 text-xl font-semibold">{t("empty.title")}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("empty.description")}
                </p>
                <Button type="button" className="mt-5" onClick={openAddDialog}>
                  <Plus data-icon="inline-start" />
                  {t("empty.action")}
                </Button>
              </div>
            ) : (
              <div className="mb-10 flex flex-col gap-3 md:mx-auto md:max-w-3xl">
                <div className="flex items-center justify-between rounded-2xl border bg-background/80 px-4 py-3 backdrop-blur-sm">
                  <span className="text-sm text-muted-foreground">
                    {t("progress", { completed: completedCount, total: entries.length })}
                  </span>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {Math.round((completedCount / entries.length) * 100)}%
                  </span>
                </div>
                <JourneySourceLegend />
              </div>
            )}

            {groups.map((group) => (
              <MonthSection
                key={group.key}
                group={group}
                onEdit={openEditDialog}
                onToggle={toggleEntry}
                pendingId={pendingId}
              />
            ))}
            <div ref={sentinelRef} aria-hidden="true" className="h-8" />
          </main>

          <nav
            aria-label={t("yearNavigation")}
            className="sticky top-24 hidden h-fit max-h-[calc(100dvh-7rem)] self-start flex-col items-center gap-1 overflow-y-auto rounded-2xl border bg-background/85 p-1.5 shadow-lg backdrop-blur-xl lg:flex"
          >
            {years.map((year) => (
              <button
                key={year}
                type="button"
                aria-current={activeYear === year ? "true" : undefined}
                onClick={() => goToYear(year)}
                className={cn(
                  "rounded-xl px-2.5 py-2 font-mono text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                  activeYear === year && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {year}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {floatingActionsVisible ? (
          <motion.div
            key="journey-floating-actions"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="pointer-events-none fixed top-3 right-3 left-3 z-30 flex justify-center md:left-auto md:justify-end"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border bg-background/90 p-2 shadow-xl backdrop-blur-xl">
              <Button type="button" size="sm" onClick={openAddDialog}>
                <Plus data-icon="inline-start" />
                {t("add")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAiDialogOpen(true)}
              >
                <Sparkles data-icon="inline-start" />
                {t("askAi")}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <EntryDialog
        key={`${editingEntry?.id ?? "new"}-${entryDialogOpen ? "open" : "closed"}`}
        entry={editingEntry}
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        onDeleted={deleteLocal}
        onSaved={saveLocal}
      />
      <AiJourneyDialog
        entries={entries}
        open={aiDialogOpen}
        onEntriesChange={setEntries}
        onOpenChange={setAiDialogOpen}
      />
      <FutureFooter entries={entries} />
    </div>
  );
}
