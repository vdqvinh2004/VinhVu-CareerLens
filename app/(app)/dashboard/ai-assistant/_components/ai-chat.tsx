"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUp,
  ArrowDown,
  Bot,
  Globe2,
  House,
  MessageSquarePlus,
  Route,
  Square,
  Trash2,
} from "lucide-react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { parseAgentSseStream } from "@/lib/ai/agent/sse";
import type { ChatSession } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  createSessionAction,
  deleteSessionAction,
  getSessionsAction,
  getSuggestedPromptsAction,
  loadMessagesAction,
  updateSessionModelAction,
} from "../actions";
import {
  applyAgentEvent,
  classifyAbortFailure,
  createUiMessage,
  isActiveMessage,
  prepareTransportRetry,
  releaseStaleActiveMessages,
  resolveRetryClientRequestId,
  type UIMessage,
} from "./chat-state";
import {
  AssistantAnswer,
  type MessageLabels,
} from "./research-message";

const HOME_TAB = "assistant-home";

type FollowedRoadmapProgress = {
  title: string;
  href: string;
  progress: number;
  completedCount: number;
  totalCount: number;
};
const ACTIVE_SESSION_STORAGE_KEY = "meshmind.ai-assistant.active-session.v1";
const SCROLL_FOLLOW_DISTANCE = 120;
const REMOTE_RUN_POLL_MS = 1_500;
const REMOTE_RUN_STALE_MS = 5 * 60_000;

function readActiveSessionId() {
  try {
    return window.sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberActiveSession(sessionId: string | null) {
  try {
    if (sessionId) {
      window.sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId);
    } else {
      window.sessionStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    }
  } catch {
    // The server remains authoritative when browser storage is unavailable.
  }
}

class ChatRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }
}

async function chatRequestError(response: Response) {
  let body: { error?: { code?: string; message?: string } } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // Fall back to a typed HTTP error when the response body is unavailable.
  }
  return new ChatRequestError(
    body.error?.code ?? `http_${response.status}`,
    body.error?.message ?? `Stream error: ${response.status}`,
    response.status === 429 || response.status >= 500,
  );
}

function MessageBubble({
  labels,
  locale,
  message,
  onRetry,
}: {
  labels: MessageLabels;
  locale: string;
  message: UIMessage;
  onRetry?: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-full"
    >
      <Message align={isUser ? "end" : "start"} className={cn(!isUser && "gap-4")}>
        {!isUser ? (
          <MessageAvatar className="size-8 self-start bg-foreground text-background">
            <Bot className="size-4" />
          </MessageAvatar>
        ) : null}
        <MessageContent className={cn(isUser ? "max-w-[85%] sm:max-w-[70%]" : "max-w-3xl")}>
          {!isUser && message.model ? (
            <MessageHeader className="px-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
              {message.model}
            </MessageHeader>
          ) : null}
          <Bubble
            align={isUser ? "end" : "start"}
            variant={isUser ? "default" : "ghost"}
            className={cn(!isUser && "w-full max-w-full")}
          >
            <BubbleContent
              className={cn(
                isUser
                  ? "rounded-[1.35rem] rounded-br-md px-4 py-3"
                  : "w-full text-[0.95rem] leading-7",
              )}
            >
              {isUser ? (
                <span className="whitespace-pre-wrap">{message.content}</span>
              ) : (
                <AssistantAnswer
                  labels={labels}
                  locale={locale}
                  message={message}
                  onRetry={onRetry}
                />
              )}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    </motion.div>
  );
}

function ModelSelector({
  models,
  selected,
  onChange,
  disabled,
}: {
  models: string[];
  selected: string;
  onChange: (model: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("Assistant");
  const modelItems = models.map((value) => ({ value, label: value }));

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Select
        items={modelItems}
        value={selected}
        onValueChange={(value) => {
          if (value) onChange(value);
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" aria-label={t("model")} className="min-w-0 max-w-52 border-0 bg-transparent shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" align="start" alignItemWithTrigger={false}>
          <SelectGroup>
            {modelItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function SessionTab({
  session,
  disabled,
  selected,
  onSelect,
}: {
  session: ChatSession;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "ghost"}
      data-session-id={session.id}
      disabled={disabled}
      aria-current={selected ? "page" : undefined}
      onClick={onSelect}
      className="h-7 min-w-32 max-w-52 flex-none px-3 text-xs"
    >
      <span className="truncate">{session.title}</span>
    </Button>
  );
}

function DeleteConversationButton({
  disabled,
  onDelete,
}: {
  disabled: boolean;
  onDelete: () => Promise<boolean>;
}) {
  const t = useTranslations("Assistant");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label={t("delete")}
            title={t("delete")}
            className="shrink-0"
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("deleteCancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              const deleted = await onDelete();
              setDeleting(false);
              if (deleted) setOpen(false);
            }}
          >
            {deleting ? t("deleting") : t("deleteConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmptyState({
  onPrompt,
  disabled,
  loading,
  prompts,
}: {
  onPrompt: (text: string) => void;
  disabled: boolean;
  loading: boolean;
  prompts: string[];
}) {
  const t = useTranslations("Assistant");
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-full items-center py-8 sm:py-12"
    >
      <Empty className="mx-auto grid max-w-5xl gap-10 border-0 p-2 text-left lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1.15fr)] lg:gap-16">
        <EmptyHeader className="max-w-none items-start text-left">
          <EmptyMedia variant="icon" className="size-11 rounded-2xl bg-foreground text-background">
            <Bot />
          </EmptyMedia>
          <EmptyTitle className="mt-4 max-w-sm text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {t("emptyTitle")}
          </EmptyTitle>
          <EmptyDescription className="mt-2 max-w-sm text-base leading-7">
            {t("emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
        <div className="flex w-full flex-col border-t" aria-busy={loading}>
          {loading ? (
            <div className="flex flex-col" role="status">
              <span className="sr-only">{t("loadingSuggestions")}</span>
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-4 border-b py-5">
                  <Skeleton className="h-3 w-5" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : prompts.map((prompt, index) => (
            <Button
              key={prompt}
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={() => onPrompt(prompt)}
              className="group h-auto justify-start gap-4 rounded-none border-b px-0 py-4 text-left text-sm font-normal leading-6 whitespace-normal hover:bg-transparent"
            >
              <span className="font-mono text-xs text-muted-foreground/45">0{index + 1}</span>
              <span className="flex-1 transition-transform group-hover:translate-x-1">{prompt}</span>
              <ArrowUp className="size-4 rotate-45 text-muted-foreground/45" />
            </Button>
          ))}
        </div>
      </Empty>
    </motion.div>
  );
}

function OverviewHome({
  conversationCount,
  disabled,
  followedRoadmap,
  modelCount,
  onNewConversation,
  viewerName,
}: {
  conversationCount: number;
  disabled: boolean;
  followedRoadmap: FollowedRoadmapProgress | null;
  modelCount: number;
  onNewConversation: () => void;
  viewerName: string;
}) {
  const t = useTranslations("Assistant");

  return (
    <section className="mx-auto grid min-h-full w-full max-w-5xl items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
      <header>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
          {t("welcome", { name: viewerName })}
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
          {t("overviewDescription")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" size="lg" onClick={onNewConversation} disabled={disabled}>
            <MessageSquarePlus data-icon="inline-start" />
            {t("newConversation")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="/dashboard/careerlens" />}
          >
            <Route data-icon="inline-start" />
            {t("openRoadmap")}
          </Button>
        </div>
      </header>

      <aside className="rounded-[2rem] bg-foreground p-7 text-background">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">
          {t("workspaceSnapshot")}
        </p>
        <div className="mt-8">
          <p className="font-mono text-5xl font-semibold tracking-[-0.06em]">
            {conversationCount}
          </p>
          <p className="mt-2 text-sm text-background/55">{t("conversationCount")}</p>
        </div>
        <Separator className="my-6 bg-background/10" />
        <div>
          <p className="font-mono text-3xl font-semibold tracking-[-0.04em]">{modelCount}</p>
          <p className="mt-2 text-sm text-background/55">{t("modelCount")}</p>
        </div>
        {followedRoadmap ? (
          <>
            <Separator className="my-6 bg-background/10" />
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium">{t("followingTitle")}</p>
                <p className="mt-1 line-clamp-2 text-sm text-background/55">
                  {followedRoadmap.title}
                </p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-background/60">
                  <span>
                    {t("followingProgress", {
                      completed: followedRoadmap.completedCount,
                      total: followedRoadmap.totalCount,
                    })}
                  </span>
                  <span>{followedRoadmap.progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background/15">
                  <div
                    className="h-full rounded-full bg-background"
                    style={{ width: `${followedRoadmap.progress}%` }}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<Link href={followedRoadmap.href} />}
              >
                <Route data-icon="inline-start" />
                {t("openFollowing")}
              </Button>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}

export function AIChat({
  followedRoadmap,
  initialModels,
  viewerName,
}: {
  followedRoadmap: FollowedRoadmapProgress | null;
  initialModels: string[];
  viewerName: string;
}) {
  const t = useTranslations("Assistant");
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionMutating, setSessionMutating] = useState(false);
  const [sending, setSending] = useState(false);
  const [ownsStream, setOwnsStream] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(initialModels[0] ?? "");
  const [forceWeb, setForceWeb] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const tabsViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const followsLatestRef = useRef(true);
  const sessionLoadRef = useRef(0);
  const currentSessionRef = useRef<string | null>(null);
  const sendInFlightRef = useRef(false);
  const sessionMutationRef = useRef(false);
  const suggestionRequestRef = useRef(0);
  const hasActiveRun = messages.some(isActiveMessage);
  const interactionDisabled =
    sessionsLoading || sending || sessionLoading || sessionMutating || hasActiveRun;
  const translatedMessageError = useCallback((code?: string) => {
    switch (code) {
      case "private_web_forbidden": return t("errors.privateWebForbidden");
      case "force_web_unavailable": return t("errors.forceWebUnavailable");
      case "force_web_not_used": return t("errors.forceWebNotUsed");
      case "deadline_exceeded": return t("errors.deadlineExceeded");
      case "session_busy":
      case "request_in_progress": return t("errors.sessionBusy");
      case "session_not_found": return t("errors.sessionNotFound");
      case "model_mismatch": return t("errors.modelMismatch");
      case "history_unavailable": return t("errors.historyUnavailable");
      case "run_incomplete":
      case "stale_run_recovered": return t("errors.runIncomplete");
      default: return t("messageError");
    }
  }, [t]);
  const labels: MessageLabels = {
    accessed: t("sources.accessed"),
    cancelled: t("cancelled"),
    citation: (ordinal, title) => t("sources.citation", { ordinal, title }),
    evidence: t("sources.evidence"),
    external: t("sources.external"),
    errorMessage: translatedMessageError,
    failed: t("messageError"),
    phase: {
      thinking: t("research.thinking"),
      searching: t("research.searching"),
      reading: t("research.reading"),
      synthesizing: t("research.synthesizing"),
    },
    published: t("sources.published"),
    retry: t("retry"),
    sourceCount: (count) => t("research.sourceCount", { count }),
    sources: t("sources.title"),
    unknownDate: t("sources.unknownDate"),
  };
  const messageLoadErrorText = t("messageLoadError");

  useEffect(() => {
    let disposed = false;

    getSessionsAction()
      .then(async (loadedSessions) => {
        if (disposed) return;
        setSessions(loadedSessions);

        const sessionId = readActiveSessionId();
        if (!sessionId) return;
        const session = loadedSessions.find((item) => item.id === sessionId);
        if (!session) {
          rememberActiveSession(null);
          return;
        }

        const loadId = ++sessionLoadRef.current;
        currentSessionRef.current = sessionId;
        setCurrentSessionId(sessionId);
        setSelectedModel(session.model);
        setSessionLoading(true);
        try {
          const loadedMessages = await loadMessagesAction(sessionId);
          if (
            !disposed &&
            sessionLoadRef.current === loadId &&
            currentSessionRef.current === sessionId
          ) {
            setMessages(loadedMessages.map(createUiMessage));
          }
        } catch {
          if (
            !disposed &&
            sessionLoadRef.current === loadId &&
            currentSessionRef.current === sessionId
          ) {
            setMessageLoadError(messageLoadErrorText);
          }
        } finally {
          if (!disposed && sessionLoadRef.current === loadId) {
            setSessionLoading(false);
          }
        }
      })
      .catch(() => {
        if (!disposed) setSessionsError(true);
      })
      .finally(() => {
        if (!disposed) setSessionsLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [messageLoadErrorText]);

  useEffect(() => {
    if (messages.length === 0) return;
    const container = messagesRef.current;
    if (container && followsLatestRef.current) {
      container.scrollTop = container.scrollHeight;
      setShowJumpToLatest(false);
    } else if (container) {
      setShowJumpToLatest(true);
    }
  }, [messages]);

  useEffect(() => {
    const requestId = ++suggestionRequestRef.current;
    if (
      !currentSessionId ||
      sessionLoading ||
      messages.length > 0 ||
      messageLoadError ||
      !selectedModel
    ) {
      return;
    }

    const start = window.setTimeout(() => {
      setSuggestedPrompts([]);
      setSuggestionsLoading(true);
      getSuggestedPromptsAction(locale, selectedModel)
        .then((prompts) => {
          if (suggestionRequestRef.current === requestId) {
            setSuggestedPrompts(prompts);
          }
        })
        .catch(() => {
          if (suggestionRequestRef.current === requestId) {
            setSuggestedPrompts([
              t("prompts.major"),
              t("prompts.coding"),
              t("prompts.university"),
              t("prompts.skills"),
              t("prompts.scholarship"),
            ]);
          }
        })
        .finally(() => {
          if (suggestionRequestRef.current === requestId) {
            setSuggestionsLoading(false);
          }
        });
    }, 0);

    return () => window.clearTimeout(start);
  }, [currentSessionId, locale, messageLoadError, messages.length, selectedModel, sessionLoading, t]);

  useEffect(() => {
    if (!currentSessionId) return;

    const viewport = tabsViewportRef.current;
    const activeTab = viewport?.querySelector<HTMLElement>(
      `[data-session-id="${CSS.escape(currentSessionId)}"]`,
    );

    if (!viewport || !activeTab) return;

    const viewportRect = viewport.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const overflowRight = tabRect.right - viewportRect.right;
    const overflowLeft = tabRect.left - viewportRect.left;

    if (overflowRight > 0) {
      viewport.scrollBy({
        left: overflowRight + 8,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    } else if (overflowLeft < 0) {
      viewport.scrollBy({
        left: overflowLeft - 8,
        behavior: shouldReduceMotion ? "auto" : "smooth",
      });
    }
  }, [currentSessionId, sessions, shouldReduceMotion]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const reloadCanonical = useCallback(async (
    sessionId: string,
    options: { reportError?: boolean } = {},
  ) => {
    const loadId = ++sessionLoadRef.current;
    try {
      const loaded = await loadMessagesAction(sessionId);
      if (
        sessionLoadRef.current === loadId &&
        currentSessionRef.current === sessionId
      ) {
        setMessages(loaded.map(createUiMessage));
        setMessageLoadError(null);
      }
      return true;
    } catch {
      if (
        options.reportError !== false &&
        sessionLoadRef.current === loadId &&
        currentSessionRef.current === sessionId
      ) {
        setMessageLoadError(t("messageLoadError"));
      }
      return false;
    }
  }, [t]);

  useEffect(() => {
    if (!currentSessionId || !hasActiveRun || sending || sessionLoading) return;
    let disposed = false;
    const poll = async () => {
      try {
        const loaded = (await loadMessagesAction(currentSessionId)).map(createUiMessage);
        if (disposed || currentSessionRef.current !== currentSessionId) return;
        setMessages(releaseStaleActiveMessages(
          loaded,
          Date.now(),
          REMOTE_RUN_STALE_MS,
          t("errors.runIncomplete"),
        ));
        setMessageLoadError(null);
      } catch {
        if (disposed || currentSessionRef.current !== currentSessionId) return;
        setMessages((current) => releaseStaleActiveMessages(
          current,
          Date.now(),
          REMOTE_RUN_STALE_MS,
          t("errors.runIncomplete"),
        ));
        setMessageLoadError(t("messageLoadError"));
      }
    };
    const timer = window.setInterval(() => void poll(), REMOTE_RUN_POLL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [currentSessionId, hasActiveRun, sending, sessionLoading, t]);

  const switchSession = useCallback(async (sessionId: string) => {
    if (
      sessionsLoading ||
      sendInFlightRef.current ||
      sessionMutationRef.current ||
      hasActiveRun
    ) return;
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    const loadId = ++sessionLoadRef.current;
    setSessionLoading(true);
    setMessageLoadError(null);
    setActionError(null);
    followsLatestRef.current = true;
    setShowJumpToLatest(false);
    currentSessionRef.current = sessionId;
    rememberActiveSession(sessionId);
    setCurrentSessionId(sessionId);
    setSelectedModel(session.model);
    setMessages([]);
    try {
      const loaded = await loadMessagesAction(sessionId);
      if (sessionLoadRef.current === loadId && currentSessionRef.current === sessionId) {
        setMessages(loaded.map(createUiMessage));
      }
    } catch {
      if (sessionLoadRef.current === loadId && currentSessionRef.current === sessionId) {
        setMessageLoadError(t("messageLoadError"));
      }
    } finally {
      if (sessionLoadRef.current === loadId) setSessionLoading(false);
    }
  }, [hasActiveRun, sessions, sessionsLoading, t]);

  const createNewSession = useCallback(async () => {
    if (
      sessionsLoading ||
      sendInFlightRef.current ||
      sessionMutationRef.current ||
      hasActiveRun
    ) return;
    sessionMutationRef.current = true;
    setSessionMutating(true);
    setActionError(null);
    try {
      const session = await createSessionAction(selectedModel);
      sessionLoadRef.current += 1;
      currentSessionRef.current = session.id;
      rememberActiveSession(session.id);
      setSessions((prev) => [...prev, session]);
      setCurrentSessionId(session.id);
      setMessages([]);
      setMessageLoadError(null);
      followsLatestRef.current = true;
    } catch {
      setActionError(t("createError"));
    } finally {
      sessionMutationRef.current = false;
      setSessionMutating(false);
    }
  }, [hasActiveRun, selectedModel, sessionsLoading, t]);

  const changeModel = useCallback(async (model: string) => {
    if (model === selectedModel || interactionDisabled) return;
    if (!currentSessionId) {
      setSelectedModel(model);
      return;
    }

    sessionMutationRef.current = true;
    setSessionMutating(true);
    setActionError(null);
    try {
      const updated = await updateSessionModelAction(currentSessionId, model);
      setSessions((current) => current.map((session) =>
        session.id === updated.id ? updated : session,
      ));
      setSelectedModel(updated.model);
    } catch {
      setActionError(t("messageError"));
    } finally {
      sessionMutationRef.current = false;
      setSessionMutating(false);
    }
  }, [currentSessionId, interactionDisabled, selectedModel, t]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (
      sessionsLoading ||
      sendInFlightRef.current ||
      sessionMutationRef.current ||
      hasActiveRun
    ) return false;
    sessionMutationRef.current = true;
    setSessionMutating(true);
    setActionError(null);
    const sessionIndex = sessions.findIndex((session) => session.id === sessionId);
    const previousSession = sessionIndex > 0 ? sessions[sessionIndex - 1] : null;
    try {
      await deleteSessionAction(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      if (currentSessionRef.current === sessionId) {
        sessionLoadRef.current += 1;
        if (previousSession) {
          currentSessionRef.current = previousSession.id;
          rememberActiveSession(previousSession.id);
          setCurrentSessionId(previousSession.id);
          setSelectedModel(previousSession.model);
          setSessionLoading(true);
          setMessages([]);
          try {
            const loaded = await loadMessagesAction(previousSession.id);
            if (currentSessionRef.current === previousSession.id) {
              setMessages(loaded.map(createUiMessage));
            }
          } catch {
            setMessageLoadError(t("messageLoadError"));
          } finally {
            setSessionLoading(false);
          }
        } else {
          currentSessionRef.current = null;
          rememberActiveSession(null);
          setCurrentSessionId(null);
          setMessages([]);
        }
      }
      return true;
    } catch {
      setSessionLoading(false);
      setActionError(t("deleteError"));
      return false;
    } finally {
      sessionMutationRef.current = false;
      setSessionMutating(false);
    }
  }, [hasActiveRun, sessions, sessionsLoading, t]);

  const sendMessage = useCallback(async (
    text: string,
    retry?: Pick<
      UIMessage,
      "clientRequestId" | "failureKind" | "localId" | "model" | "run"
    >,
  ) => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      sessionsLoading ||
      sendInFlightRef.current ||
      sessionMutationRef.current ||
      sessionLoading ||
      hasActiveRun
    ) return;
    sendInFlightRef.current = true;
    setSending(true);
    setActionError(null);
    setMessageLoadError(null);
    sessionLoadRef.current += 1;
    let sessionId = currentSessionRef.current;
    const requestModel = retry?.model ?? selectedModel;
    const requestForceWeb = retry?.run?.forceWeb ?? forceWeb;
    const reuseOptimisticTurn = retry?.failureKind === "transport";
    const clientRequestId = retry
      ? resolveRetryClientRequestId(retry, () => crypto.randomUUID())
      : crypto.randomUUID();
    const assistantMsgId = reuseOptimisticTurn
      ? retry.localId
      : crypto.randomUUID();
    let requestController: AbortController | null = null;
    try {
      if (!sessionId) {
        try {
          const session = await createSessionAction(requestModel ?? selectedModel);
          sessionId = session.id;
          currentSessionRef.current = session.id;
          rememberActiveSession(session.id);
          setSessions((prev) => [...prev, session]);
          setCurrentSessionId(session.id);
        } catch {
          setActionError(t("createError"));
          return;
        }
      }
      if (!clientRequestId) {
        setActionError(t("sendError"));
        return;
      }

      setInput("");
      followsLatestRef.current = true;
      setShowJumpToLatest(false);
      if (reuseOptimisticTurn) {
        setMessages((prev) => prepareTransportRetry(prev, retry.localId));
      } else {
        const userMsgId = crypto.randomUUID();
        setMessages((prev) => [...prev, {
          id: userMsgId,
          localId: userMsgId,
          role: "user",
          content: trimmed,
          model: null,
          clientRequestId,
          status: "completed",
          failureKind: null,
          run: null,
          sources: [],
          citations: [],
        }, {
          id: assistantMsgId,
          localId: assistantMsgId,
          role: "assistant",
          content: "",
          model: requestModel,
          clientRequestId,
          status: "pending",
          failureKind: null,
          run: null,
          phase: "thinking",
          sources: [],
          citations: [],
        }]);
      }

      const controller = new AbortController();
      requestController = controller;
      abortRef.current = controller;
      setOwnsStream(true);
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId,
          sessionId,
          message: trimmed,
          model: requestModel,
          forceWeb: requestForceWeb,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw await chatRequestError(res);
      }

      let sawTerminal = false;
      for await (const event of parseAgentSseStream(res.body)) {
        if (
          event.type === "run.completed" ||
          event.type === "run.cancelled" ||
          event.type === "error"
        ) {
          sawTerminal = true;
        }
        setMessages((prev) => {
          const index = prev.findIndex((message) => message.localId === assistantMsgId);
          if (index < 0) return prev;
          const next = [...prev];
          next[index] = applyAgentEvent(prev[index]!, event);
          return next;
        });
      }
      if (!sawTerminal) {
        throw new ChatRequestError("stream_incomplete", t("messageError"), true);
      }
    } catch (err: unknown) {
      const abortFailure = requestController
        ? classifyAbortFailure(err, requestController.signal)
        : null;
      if (abortFailure) {
        setMessages((prev) => prev.map((message) => message.localId === assistantMsgId
          ? { ...message, status: "cancelled", failureKind: abortFailure, phase: undefined }
          : message));
      } else {
        const error = err instanceof ChatRequestError
          ? err
          : new ChatRequestError("stream_failed", t("messageError"), true);
        setMessages((prev) => prev.map((message) => message.localId === assistantMsgId
          ? {
              ...message,
              status: "failed",
              failureKind: "transport",
              phase: undefined,
              error: { code: error.code, message: error.message, retryable: error.retryable },
            }
          : message));
        setActionError(t("sendError"));
      }
    } finally {
      abortRef.current = null;
      setOwnsStream(false);
      const reloaded = sessionId ? await reloadCanonical(sessionId) : false;
      if (reloaded) setActionError(null);
      const updatedSessions = await getSessionsAction().catch(() => null);
      if (updatedSessions) setSessions(updatedSessions);
      sendInFlightRef.current = false;
      setSending(false);
    }
  }, [forceWeb, hasActiveRun, reloadCanonical, selectedModel, sessionLoading, sessionsLoading, t]);

  function stopStreaming() {
    abortRef.current?.abort("user");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleMessagesScroll() {
    const container = messagesRef.current;
    if (!container) return;
    followsLatestRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      SCROLL_FOLLOW_DISTANCE;
    setShowJumpToLatest(!followsLatestRef.current);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center border-b bg-muted/30 px-2 sm:px-4">
        <div
          ref={tabsViewportRef}
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <nav aria-label={t("conversations")} className="flex h-9 w-max min-w-full items-center">
            <Button
              type="button"
              variant={currentSessionId ? "ghost" : "secondary"}
              disabled={interactionDisabled}
              aria-current={currentSessionId ? undefined : "page"}
              onClick={() => {
                if (interactionDisabled) return;
                sessionLoadRef.current += 1;
                currentSessionRef.current = null;
                rememberActiveSession(null);
                setCurrentSessionId(null);
                setMessages([]);
                setMessageLoadError(null);
              }}
              className="h-7 flex-none px-3 text-xs"
            >
              <House data-icon="inline-start" />
              {t("home")}
            </Button>
            {sessionsLoading ? (
              <div role="presentation" className="flex items-center gap-2 px-2">
                <Skeleton className="h-7 w-36 shrink-0" />
                <Skeleton className="h-7 w-44 shrink-0" />
              </div>
            ) : sessionsError ? null : (
              sessions.map((session) => (
                <SessionTab
                  key={session.id}
                  session={session}
                  selected={session.id === currentSessionId}
                  disabled={interactionDisabled}
                  onSelect={() => {
                    if (session.id !== currentSessionId) void switchSession(session.id);
                  }}
                />
              ))
            )}
            {sessionsError ? (
              <span role="alert" className="px-3 text-xs text-destructive">
                {t("sessionsError")}
              </span>
            ) : null}
          </nav>
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-1 border-l pl-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={createNewSession}
            disabled={interactionDisabled}
            aria-label={t("newConversation")}
            title={t("newConversation")}
          >
            <MessageSquarePlus />
          </Button>
          {currentSessionId ? (
            <DeleteConversationButton
              key={currentSessionId}
              disabled={interactionDisabled}
              onDelete={() => handleDeleteSession(currentSessionId)}
            />
          ) : null}
        </div>
      </header>
      {actionError ? (
        <Alert variant="destructive" className="mx-auto mt-2 w-[calc(100%-2rem)] max-w-4xl">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentSessionId ?? HOME_TAB}
          initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.16,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {currentSessionId ? (
            <div className="relative flex min-h-0 flex-1">
              <div
                ref={messagesRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto px-4 md:px-8"
              >
                {messageLoadError ? (
                  <Alert variant="destructive" className="mx-auto mt-6 max-w-4xl">
                    <AlertDescription>{messageLoadError}</AlertDescription>
                  </Alert>
                ) : null}
                {sessionLoading ? (
                  <div className="mx-auto flex max-w-4xl flex-col gap-4 py-10" role="status">
                    <span className="sr-only">{t("loadingMessages")}</span>
                    <Skeleton className="h-20 w-3/4 self-end" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : messages.length === 0 && !messageLoadError ? (
                  <EmptyState
                    onPrompt={sendMessage}
                    disabled={interactionDisabled}
                    loading={suggestionsLoading}
                    prompts={suggestedPrompts}
                  />
                ) : (
                  <div
                    className="mx-auto flex w-full max-w-4xl flex-col gap-9 py-8 sm:py-12"
                    aria-live="polite"
                  >
                    <AnimatePresence initial={false}>
                      {messages.map((msg, index) => {
                        const retryText = index > 0 && messages[index - 1]?.role === "user"
                          ? messages[index - 1].content
                          : undefined;
                        return (
                          <MessageBubble
                            key={msg.localId}
                            labels={labels}
                            locale={locale}
                            message={msg}
                            onRetry={retryText && !interactionDisabled
                              ? () => sendMessage(retryText, msg)
                              : undefined}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              {showJumpToLatest ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-md"
                  onClick={() => {
                    const container = messagesRef.current;
                    if (!container) return;
                    followsLatestRef.current = true;
                    setShowJumpToLatest(false);
                    container.scrollTo({
                      top: container.scrollHeight,
                      behavior: shouldReduceMotion ? "auto" : "smooth",
                    });
                  }}
                >
                  <ArrowDown data-icon="inline-start" />
                  {t("jumpToLatest")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="ai-workspace-home flex-1 overflow-y-auto px-5 md:px-8">
              <OverviewHome
                conversationCount={sessions.length}
                disabled={interactionDisabled}
                followedRoadmap={followedRoadmap}
                modelCount={initialModels.length}
                onNewConversation={createNewSession}
                viewerName={viewerName}
              />
            </div>
          )}

          {currentSessionId ? (
            <div className="shrink-0 bg-background px-3 pb-3 pt-2 sm:px-5 sm:pb-5 md:px-8">
              <div className="mx-auto w-full max-w-4xl">
                <form onSubmit={handleSubmit}>
                  <InputGroup className="h-auto rounded-[1.5rem] border border-input bg-muted/50 shadow-[0_18px_50px_-32px_oklch(0.145_0_0_/_0.6)]">
                    <InputGroupTextarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={handleKeyDown}
                      aria-label={t("messageLabel")}
                      placeholder={t("placeholder")}
                      rows={1}
                      disabled={interactionDisabled}
                      className="min-h-12 px-4 pt-3.5 text-sm leading-6 placeholder:text-muted-foreground/70"
                      style={{ maxHeight: "120px" }}
                    />
                    <InputGroupAddon align="block-end" className="justify-between px-3 pb-3 pt-1">
                      <ModelSelector
                        models={initialModels}
                        selected={selectedModel}
                        onChange={(model) => void changeModel(model)}
                        disabled={interactionDisabled}
                      />
                        <Toggle
                          type="button"
                          size="sm"
                          variant={forceWeb ? "default" : "outline"}
                        pressed={forceWeb}
                        onPressedChange={setForceWeb}
                        disabled={interactionDisabled}
                        aria-label={forceWeb ? t("web.onLabel") : t("web.autoLabel")}
                        title={forceWeb ? t("web.onTitle") : t("web.autoTitle")}
                        className="max-w-36 px-2 sm:px-3"
                      >
                        <Globe2 data-icon="inline-start" />
                        <span className="hidden truncate sm:inline">
                          {forceWeb ? t("web.on") : t("web.auto")}
                        </span>
                      </Toggle>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="hidden text-[10px] font-normal text-muted-foreground/45 sm:inline">
                          {t("provider")}
                        </span>
                        {sending && ownsStream ? (
                          <InputGroupButton
                            type="button"
                            variant="secondary"
                            size="icon-sm"
                            onClick={stopStreaming}
                            aria-label={t("stop")}
                            title={t("stop")}
                          >
                            <Square />
                          </InputGroupButton>
                        ) : (
                          <InputGroupButton
                            type="submit"
                            variant="default"
                            size="icon-sm"
                            disabled={!input.trim() || interactionDisabled}
                            aria-label={t("send")}
                            title={t("send")}
                          >
                            <ArrowUp />
                          </InputGroupButton>
                        )}
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                </form>
                <p className="mt-2 px-3 text-center text-[11px] text-muted-foreground/50">
                  {t("disclaimer")}
                </p>
              </div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
