"use client";
import { BrowserWorkspace } from "@/components/browser-workspace";
import { useWorkspace } from "@/lib/browser-storage";
import { DashboardShell } from "./_components/dashboard-shell";
function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { profile } = useWorkspace();
  return <DashboardShell viewer={{ canEditProfile: true, displayName: profile.fullName, email: profile.email, isAdmin: false }}>{children}</DashboardShell>;
}
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <BrowserWorkspace><WorkspaceShell>{children}</WorkspaceShell></BrowserWorkspace>;
}
