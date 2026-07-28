"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

import { LangfuseLogs } from "./langfuse-logs";

type AdminTab = "ai-logs";

const TABS: { id: AdminTab; label: string; icon: typeof Activity }[] = [
  { id: "ai-logs", label: "AI Logs", icon: Activity },
];

export function AdminTabs() {
  const [active, setActive] = useState<AdminTab>("ai-logs");

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border px-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="admin-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {active === "ai-logs" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">via Langfuse</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <LangfuseLogs />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
