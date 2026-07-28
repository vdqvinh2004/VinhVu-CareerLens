"use client";

import { Children, type ReactNode } from "react";
import { ExternalLink, Globe2, RotateCcw } from "lucide-react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { UIMessage } from "./chat-state";
import { resolveCitationText } from "./chat-state";

type MessageLabels = {
  accessed: string;
  cancelled: string;
  citation: (ordinal: number, title: string) => string;
  evidence: string;
  errorMessage: (code?: string) => string;
  external: string;
  failed: string;
  phase: Record<NonNullable<UIMessage["phase"]>, string>;
  published: string;
  retry: string;
  sourceCount: (count: number) => string;
  sources: string;
  unknownDate: string;
};

function displayDate(
  value: string | null,
  locale: string,
  unknownDate: string,
  includeTime = false,
) {
  if (!value) return unknownDate;
  return new Intl.DateTimeFormat(locale, includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function hostname(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function CitationText({
  children,
  labels,
  message,
}: {
  children: ReactNode;
  labels: MessageLabels;
  message: UIMessage;
}) {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return resolveCitationText(child, message.citations, message.sources).map((part, index) =>
      part.type === "text" ? (
        part.value
      ) : (
        <a
          key={`${part.citation.ordinal}-${index}`}
          href={part.source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={labels.citation(part.citation.ordinal, part.source.title)}
          title={part.source.title}
          className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-[0.72em] font-semibold leading-5 text-foreground no-underline transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {part.marker}
        </a>
      ),
    );
  });
}

function markdownComponents(message: UIMessage, labels: MessageLabels): Components {
  const cited = (children: ReactNode) => (
    <CitationText message={message} labels={labels}>{children}</CitationText>
  );

  return {
    a: ({ children }) => <span className="font-medium underline decoration-muted-foreground/50 underline-offset-4">{cited(children)}</span>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">{cited(children)}</blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
    h1: ({ children }) => <h3 className="text-base font-semibold">{cited(children)}</h3>,
    h2: ({ children }) => <h3 className="text-base font-semibold">{cited(children)}</h3>,
    h3: ({ children }) => <h4 className="font-semibold">{cited(children)}</h4>,
    img: ({ alt }) => alt ? <span className="text-muted-foreground">{alt}</span> : null,
    li: ({ children }) => <li className="pl-1 marker:text-muted-foreground">{cited(children)}</li>,
    ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1.5">{children}</ol>,
    p: ({ children }) => <p>{cited(children)}</p>,
    pre: ({ children }) => (
      <pre className="overflow-x-auto rounded-xl bg-background/70 p-3 font-mono text-xs">{children}</pre>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{cited(children)}</strong>,
    table: ({ children }) => (
      <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>
    ),
    td: ({ children }) => <td className="border p-2 align-top">{cited(children)}</td>,
    th: ({ children }) => <th className="border bg-background/60 p-2 font-semibold">{cited(children)}</th>,
    ul: ({ children }) => <ul className="ml-5 list-disc space-y-1.5">{children}</ul>,
  };
}

export function ModelMarkdown({ message, labels }: { message: UIMessage; labels: MessageLabels }) {
  return (
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      components={markdownComponents(message, labels)}
      urlTransform={() => null}
    >
      {message.content}
    </Markdown>
  );
}

export function ResearchActivity({ message, labels }: { message: UIMessage; labels: MessageLabels }) {
  const active = message.status === "pending" || message.status === "streaming";
  if (!active && message.sources.length === 0) return null;

  return (
    <div className="flex min-h-6 items-center gap-2" aria-live="polite">
      {active ? (
        <Badge variant="secondary">
          <Spinner
            data-icon="inline-start"
            aria-label={labels.phase[message.phase ?? "thinking"]}
            className="motion-reduce:animate-none"
          />
          {labels.phase[message.phase ?? "thinking"]}
        </Badge>
      ) : (
        <Badge variant="outline">
          <Globe2 data-icon="inline-start" />
          {labels.sourceCount(message.sources.length)}
        </Badge>
      )}
      {active && message.sources.length > 0 ? (
        <span className="text-xs text-muted-foreground">{labels.sourceCount(message.sources.length)}</span>
      ) : null}
    </div>
  );
}

export function SourceList({
  labels,
  locale,
  message,
}: {
  labels: MessageLabels;
  locale: string;
  message: UIMessage;
}) {
  if (message.sources.length === 0) return null;
  const quotesBySource = new Map<string, string[]>();
  for (const citation of message.citations) {
    const quotes = quotesBySource.get(citation.sourceId) ?? [];
    if (!quotes.includes(citation.quote)) quotes.push(citation.quote);
    quotesBySource.set(citation.sourceId, quotes);
  }

  return (
    <Accordion className="mt-1 bg-background/40">
      <AccordionItem value="sources">
        <AccordionTrigger className="px-3 py-2.5 text-xs hover:no-underline">
          <span className="flex items-center gap-2">
            <Globe2 className="size-3.5" />
            {labels.sources}
            <Badge variant="outline">{message.sources.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <ol className="flex flex-col gap-3">
            {message.sources.map((source) => {
              const quotes = quotesBySource.get(source.id) ?? [];
              return (
                <li key={source.id} className="grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-start gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
                      aria-label={`${source.title}. ${labels.external}`}
                    >
                      <span className="line-clamp-2">{source.title}</span>
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    </a>
                    <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {hostname(source.url)}
                    </p>
                  </div>
                  <dl className="grid gap-1 text-[11px] text-muted-foreground sm:text-right">
                    <div><dt className="inline font-medium text-foreground">{labels.published}: </dt><dd className="inline">{displayDate(source.publishedAt, locale, labels.unknownDate)}</dd></div>
                    <div><dt className="inline font-medium text-foreground">{labels.accessed}: </dt><dd className="inline">{displayDate(source.accessedAt, locale, labels.unknownDate, true)}</dd></div>
                  </dl>
                  {quotes.length > 0 ? (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      {quotes.map((quote) => (
                        <blockquote key={quote} className="border-l-2 pl-3 text-xs leading-5 text-muted-foreground">
                          <span className="sr-only">{labels.evidence}: </span>
                          &ldquo;{quote}&rdquo;
                        </blockquote>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function AssistantAnswer({
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
  return (
    <div className="flex flex-col gap-3">
      <ResearchActivity message={message} labels={labels} />
      {message.content ? (
        <ModelMarkdown message={message} labels={labels} />
      ) : null}
      {message.status === "cancelled" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{labels.cancelled}</Badge>
          {onRetry ? (
            <Button type="button" size="xs" variant="outline" onClick={onRetry}>
              <RotateCcw data-icon="inline-start" />
              {labels.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {message.status === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>{message.error ? labels.errorMessage(message.error.code) : labels.failed}</span>
          {(message.error?.retryable ?? true) && onRetry ? (
            <Button type="button" size="xs" variant="outline" onClick={onRetry}>
              <RotateCcw data-icon="inline-start" />
              {labels.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      <SourceList labels={labels} locale={locale} message={message} />
    </div>
  );
}

export type { MessageLabels };
