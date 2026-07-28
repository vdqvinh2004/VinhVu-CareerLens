"use client";

import { useActionState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  superadminLoginAction,
  type AuthActionState,
} from "../actions";
import { PasswordField } from "./password-field";
import { PresencePanel } from "./presence-panel";

const initialState: AuthActionState = { status: "idle" };

function SuperadminLoginForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(
    superadminLoginAction,
    initialState,
  );
  const isMfaStep = state.status === "mfa";

  return (
    <form action={action} className="space-y-5">
      <AnimatePresence initial={false} mode="popLayout">
        <PresencePanel
          key={isMfaStep ? "mfa" : "credentials"}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.16 }}
          className="space-y-5"
        >
          {isMfaStep ? (
            <>
              <input
                type="hidden"
                name="challengeToken"
                value={state.challengeToken}
              />
              <div className="grid gap-2">
                <Label htmlFor="superadmin-totp">
                  {t("superadmin.authenticationCode")}
                </Label>
                <Input
                  id="superadmin-totp"
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="superadmin-identifier">
                  {t("superadmin.operationsIdentifier")}
                </Label>
                <Input
                  id="superadmin-identifier"
                  name="identifier"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
              <PasswordField
                id="superadmin-password"
                name="password"
                label={t("common.password")}
                autoComplete="current-password"
                required
              />
            </>
          )}
        </PresencePanel>
      </AnimatePresence>

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
        {pending
          ? t("superadmin.submitting")
          : isMfaStep
            ? t("superadmin.verify")
            : t("common.continue")}
      </Button>
    </form>
  );
}

export { SuperadminLoginForm };
