"use client";
import { useSyncExternalStore } from "react";
import { readWorkspace, STORAGE_KEY } from "@/lib/browser-storage";
const subscribe = () => () => {};
export function BrowserWorkspace({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  if (!ready) return <p role="status" className="p-8">Loading browser workspace…</p>;
  try { readWorkspace(); }
  catch (error) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-xl font-semibold">Browser storage unavailable</h1><p role="alert" className="mt-4">{error instanceof Error ? error.message : "Browser storage unavailable."}</p><p className="mt-4">Your saved data uses localStorage key <code>{STORAGE_KEY}</code>. Back it up using browser developer tools before clearing it.</p></main>;
  }
  return children;
}
