import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getViewer } from "@/lib/auth/dal";

import { AdminTabs } from "./_components/admin-tabs";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const viewer = await getViewer();

  if (!viewer || !viewer.roles.includes("ADMIN")) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <div className="border-b px-6 py-4">
        <h1 className="text-base font-semibold tracking-tight">Admin</h1>
        <p className="text-xs text-muted-foreground">System observability</p>
      </div>
      <AdminTabs />
    </div>
  );
}
