"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, reset }: { error: Error; reset: () => void }) {
  return <section className="mx-auto max-w-xl p-8">
    <h1 className="text-xl font-semibold">Could not update your workspace</h1>
    <p role="alert" className="mt-4 text-sm text-destructive">{error.message}</p>
    <div className="mt-6 flex items-center gap-4">
      <Button onClick={reset}>Try again</Button>
      <Link href="/dashboard/settings" className="text-sm underline">Open settings and export a backup</Link>
    </div>
  </section>;
}
