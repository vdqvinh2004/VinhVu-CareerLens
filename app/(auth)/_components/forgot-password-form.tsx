"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { forgotPasswordAction, type AuthActionState } from "../actions";
import { PresencePanel } from "./presence-panel";

const initialState: AuthActionState = { status: "idle" };

function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [state.status]);

  return (
    <div className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {state.status === "success" ? (
          <PresencePanel
            key="success"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.16 }}
            className="space-y-5"
          >
            <div
              role="status"
              className="rounded-xl border bg-muted/50 p-4 text-sm leading-6"
            >
              <h2
                ref={successHeadingRef}
                tabIndex={-1}
                className="font-medium outline-none"
              >
                {t("forgot.successTitle")}
              </h2>
              <p className="mt-1 text-muted-foreground">{state.message}</p>
            </div>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "w-full",
              )}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              {t("common.backToLogin")}
            </Link>
          </PresencePanel>
        ) : (
          <PresencePanel
            key="form"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14 }}
          >
            <form action={action} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="recovery-email">{t("common.email")}</Label>
                <Input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  required
                  autoFocus
                />
              </div>
              <AnimatePresence initial={false}>
                {state.message && (
                  <motion.p
                    key={state.message}
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.14 }}
                    className="text-sm text-destructive"
                  >
                    {state.message}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                <Mail data-icon="inline-start" aria-hidden="true" />
                {pending ? t("forgot.submitting") : t("forgot.submit")}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <ArrowLeft
                  aria-hidden="true"
                  className="mr-1 inline size-3.5 align-[-0.15em]"
                />
                {t("common.backToLogin")}
              </Link>
            </form>
          </PresencePanel>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ForgotPasswordForm };
