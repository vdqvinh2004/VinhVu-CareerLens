"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { GoogleIcon } from "@/components/icons/google";
import { PasswordField } from "./password-field";
import {
  initiateGoogleOAuthAction,
  loginAction,
  type AuthActionState,
} from "../actions";

const initialState: AuthActionState = { status: "idle" };

function GoogleButton() {
  return (
    <form action={initiateGoogleOAuthAction}>
      <motion.button
        type="submit"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <GoogleIcon />
        Continue with Google
      </motion.button>
    </form>
  );
}

function LoginForm() {
  const t = useTranslations("Auth");
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="space-y-5">
      <GoogleButton />

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-5">
        <div className="grid gap-2">
          <Label htmlFor="login-email">{t("common.email")}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="email@example.com"
            required
          />
        </div>

        <PasswordField
          id="login-password"
          name="password"
          label={t("common.password")}
          autoComplete="current-password"
          required
          labelAction={
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("login.forgotPassword")}
            </Link>
          }
        />

        <AnimatePresence initial={false}>
          {state.message && (
            <motion.p
              key={state.message}
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.14 }}
              className="text-sm text-destructive">
              {state.message}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("login.submitting") : t("login.submit")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("login.newUser")}{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline">
            {t("login.createAccount")}
          </Link>
        </p>
      </form>
    </div>
  );
}

export { LoginForm };
