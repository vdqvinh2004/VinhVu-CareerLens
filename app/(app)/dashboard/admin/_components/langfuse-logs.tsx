"use client";

import { useEffect, useTransition, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Eye, Copy, Check, X } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  getLangfuseLogsAction,
  type LangfuseGeneration,
  type LangfuseTrace,
} from "../actions";

// ─── helpers ────────────────────────────────────────────────────────────────

function stringify(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function truncate(value: unknown, maxLen = 60): string {
  const str = stringify(value);
  if (!str) return "—";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

function extractUserText(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (Array.isArray(input)) {
    const userMsg = input.findLast(
      (m: { role?: string }) => m?.role === "user",
    ) as { content?: string } | undefined;
    return typeof userMsg?.content === "string" ? userMsg.content : stringify(input);
  }
  return stringify(input);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

// ─── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="text-emerald-500"
          >
            <Check size={11} />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Copy size={11} />
          </motion.span>
        )}
      </AnimatePresence>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Details Modal ───────────────────────────────────────────────────────────

type DetailsEntry = {
  input: unknown;
  output: unknown;
  timestamp: string;
  label: string;
  statusMessage?: string | null;
  usage?: LangfuseGeneration["usage"];
};

function toEntry(gen: LangfuseGeneration): DetailsEntry {
  return {
    input: gen.input,
    output: gen.output,
    timestamp: gen.startTime,
    label: gen.model ?? "—",
    statusMessage: gen.statusMessage,
    usage: gen.usage,
  };
}

function toTraceEntry(t: LangfuseTrace): DetailsEntry {
  return {
    input: t.input,
    output: t.output,
    timestamp: t.timestamp,
    label: t.name ?? "trace",
  };
}

type DetailsModalProps = {
  entry: DetailsEntry | null;
  onClose: () => void;
};

function DetailsModal({ entry, onClose }: DetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (entry) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [entry]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const inputText = entry ? stringify(entry.input) : "";
  const outputText = entry ? stringify(entry.output) : "";
  const { date, time } = entry ? formatDate(entry.timestamp) : { date: "", time: "" };

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onCancel={(e) => { e.preventDefault(); handleClose(); }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 outline-none backdrop:bg-foreground/30 backdrop:backdrop-blur-sm"
    >
      <AnimatePresence>
        {entry && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Details</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {entry?.label} · {date} {time}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  <X />
                </Button>
              </div>

              {/* Body */}
              <div className="flex max-h-[65dvh] flex-col gap-0 overflow-y-auto divide-y divide-border">
                {/* Input */}
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Input
                    </p>
                    {inputText && <CopyButton text={inputText} />}
                  </div>
                  <pre className="min-h-12 overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                    {inputText || "—"}
                  </pre>
                </div>

                {/* Output */}
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Output
                    </p>
                    {outputText && <CopyButton text={outputText} />}
                  </div>
                  <pre className="min-h-12 overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-words">
                    {outputText || "—"}
                  </pre>
                  {entry?.statusMessage && (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
                      {entry.statusMessage}
                    </p>
                  )}
                </div>

                {/* Token usage */}
                {entry?.usage && (
                  <div className="flex items-center gap-6 px-5 py-3.5">
                    {[
                      { label: "Input tokens", val: entry.usage.input },
                      { label: "Output tokens", val: entry.usage.output },
                      { label: "Total tokens", val: entry.usage.total },
                    ].map(({ label, val }) =>
                      val != null ? (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="font-mono text-sm font-medium">
                            {val.toLocaleString()}
                          </p>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}

// ─── TruncatedCell ───────────────────────────────────────────────────────────

function TruncatedCell({
  text,
  onView,
}: {
  text: string;
  onView: () => void;
}) {
  return (
    <div className="flex max-w-[200px] items-center gap-1.5">
      <span
        title={text}
        className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-muted-foreground"
      >
        {text || "—"}
      </span>
      {text && text !== "—" && (
        <button
          type="button"
          title="View details"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye size={11} />
        </button>
      )}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ level }: { level: string }) {
  const isError = level === "ERROR";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-medium ${
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}
    >
      {isError ? "404" : "200"}
    </span>
  );
}

// ─── Generations table ───────────────────────────────────────────────────────

function GenerationsTable({
  data,
  isLoading,
}: {
  data: LangfuseGeneration[];
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<DetailsEntry | null>(null);

  const columns: ColumnDef<LangfuseGeneration>[] = [
    {
      key: "started_date",
      header: "Date",
      sortValue: (g) => g.startTime,
      headerClassName: "w-38",
      cell: (g) => {
        const { date, time } = formatDate(g.startTime);
        return (
          <span className="font-mono text-xs text-muted-foreground">
            <span className="block">{date}</span>
            <span className="block opacity-55">{time}</span>
          </span>
        );
      },
    },
    {
      key: "model",
      header: "Model",
      sortValue: (g) => g.model ?? "",
      headerClassName: "w-36",
      cell: (g) => (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {g.model ?? "—"}
        </span>
      ),
    },
    {
      key: "input",
      header: "Input",
      className: "w-52",
      cell: (g) => (
        <TruncatedCell
          text={truncate(extractUserText(g.input))}
          onView={() => setSelected(toEntry(g))}
        />
      ),
    },
    {
      key: "output",
      header: "Output",
      className: "w-52",
      cell: (g) => (
        <TruncatedCell
          text={truncate(g.output)}
          onView={() => setSelected(toEntry(g))}
        />
      ),
    },
    {
      key: "tokens",
      header: "Tokens",
      sortValue: (g) =>
        g.usage?.total ?? (g.usage?.input ?? 0) + (g.usage?.output ?? 0),
      headerClassName: "w-24 text-right",
      className: "text-right",
      cell: (g) => {
        const total =
          g.usage?.total ?? (g.usage?.input ?? 0) + (g.usage?.output ?? 0);
        return total > 0 ? (
          <span className="font-mono text-xs tabular-nums">
            {total.toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-20",
      cell: (g) => <StatusBadge level={g.level} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowKey={(g) => g.id}
        isLoading={isLoading}
        defaultPageSize={10}
        scrollClassName="max-h-[calc(100dvh-312px)] overflow-y-auto"
        emptyTitle="No generations yet"
        emptyDescription="Send a message in AI Assistant to see logs appear here."
      />
      <DetailsModal entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// ─── Traces table ────────────────────────────────────────────────────────────

function TracesTable({
  data,
  isLoading,
}: {
  data: LangfuseTrace[];
  isLoading: boolean;
}) {
  const [selected, setSelected] = useState<DetailsEntry | null>(null);

  const columns: ColumnDef<LangfuseTrace>[] = [
    {
      key: "timestamp",
      header: "Date",
      sortValue: (t) => t.timestamp,
      headerClassName: "w-38",
      cell: (t) => {
        const { date, time } = formatDate(t.timestamp);
        return (
          <span className="font-mono text-xs text-muted-foreground">
            <span className="block">{date}</span>
            <span className="block opacity-55">{time}</span>
          </span>
        );
      },
    },
    {
      key: "name",
      header: "Trace",
      sortValue: (t) => t.name ?? "",
      cell: (t) => (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {t.name ?? "—"}
        </span>
      ),
    },
    {
      key: "userId",
      header: "User",
      cell: (t) => (
        <span className="text-xs text-muted-foreground">{t.userId ?? "anonymous"}</span>
      ),
    },
    {
      key: "input",
      header: "Input",
      className: "w-52",
      cell: (t) => (
        <TruncatedCell
          text={truncate(t.input)}
          onView={() => setSelected(toTraceEntry(t))}
        />
      ),
    },
    {
      key: "output",
      header: "Output",
      className: "w-52",
      cell: (t) => (
        <TruncatedCell
          text={truncate(t.output)}
          onView={() => setSelected(toTraceEntry(t))}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowKey={(t) => t.id}
        isLoading={isLoading}
        defaultPageSize={10}
        scrollClassName="max-h-[calc(100dvh-312px)] overflow-y-auto"
        emptyTitle="No traces yet"
        emptyDescription="Traces will appear after AI calls are made."
      />
      <DetailsModal entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

type Tab = "generations" | "traces";

export function LangfuseLogs() {
  const [activeTab, setActiveTab] = useState<Tab>("generations");
  const [traces, setTraces] = useState<LangfuseTrace[]>([]);
  const [generations, setGenerations] = useState<LangfuseGeneration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getLangfuseLogsAction(100);
      setTraces(result.traces);
      setGenerations(result.generations);
      setError(result.error);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "generations", label: "Generations", count: generations.length },
    { id: "traces", label: "Traces", count: traces.length },
  ];

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-border px-4">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs">
                {tab.count}
              </span>
              {activeTab === tab.id && (
                <motion.span
                  layoutId="admin-log-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <motion.span
            animate={{ rotate: isPending ? 360 : 0 }}
            transition={{
              duration: 0.6,
              repeat: isPending ? Infinity : 0,
              ease: "linear",
            }}
          >
            <RefreshCw size={12} />
          </motion.span>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-border bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {activeTab === "generations" ? (
        <GenerationsTable data={generations} isLoading={isPending} />
      ) : (
        <TracesTable data={traces} isLoading={isPending} />
      )}
    </div>
  );
}
