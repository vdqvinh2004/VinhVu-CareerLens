"use client";

import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { BrandMark } from "@/components/brand";
import { preloaderTimeoutEvent } from "@/lib/preloader";

const messageKeys = [
  "semanticPathways",
  "opinionatedAlgorithms",
  "filingCabinets",
  "distributedThoughts",
  "tinyGears",
  "knowledgeThreads",
] as const;

function getDailyMessageIndex(seed: string) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % messageKeys.length;
}

function AppPreloader({
  children,
  daySeed,
}: {
  children: ReactNode;
  daySeed: string;
}) {
  const t = useTranslations("Preloader");
  const common = useTranslations("Common");
  const shouldReduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);
  const [progress, setProgress] = useState(0);
  const initialMessageIndex = useMemo(
    () => getDailyMessageIndex(daySeed),
    [daySeed],
  );
  const [messageOffset, setMessageOffset] = useState(0);
  const messageKey =
    messageKeys[(initialMessageIndex + messageOffset) % messageKeys.length];

  useLayoutEffect(() => {
    if (document.documentElement.dataset.preloaderActive !== "true") {
      queueMicrotask(() => setIsVisible(false));
      return;
    }

    contentRef.current?.setAttribute("inert", "");
    contentRef.current?.setAttribute("aria-hidden", "true");
    queueMicrotask(() => setIsBlocking(true));
  }, []);

  useEffect(() => {
    function handlePreloaderTimeout() {
      setIsVisible(false);
    }

    window.addEventListener(preloaderTimeoutEvent, handlePreloaderTimeout);
    return () =>
      window.removeEventListener(preloaderTimeoutEvent, handlePreloaderTimeout);
  }, []);

  useEffect(() => {
    if (!isBlocking || !isVisible) {
      return;
    }

    const messageTimer = window.setInterval(() => {
      startTransition(() => {
        setMessageOffset((current) => (current + 1) % messageKeys.length);
      });
    }, 2000);

    return () => window.clearInterval(messageTimer);
  }, [isBlocking, isVisible]);

  useEffect(() => {
    if (!isBlocking) {
      return;
    }

    const minimumDuration = shouldReduceMotion ? 0 : 900;
    const completionDuration = shouldReduceMotion ? 0 : 180;
    const completionHold = shouldReduceMotion ? 80 : 180;
    const startedAt = performance.now();
    let pageLoaded = document.readyState === "complete";
    let minimumElapsed = false;
    let finishing = false;
    let animationFrame = 0;
    let completionTimer = 0;
    let minimumTimer = 0;

    function finishProgress() {
      if (!pageLoaded || !minimumElapsed || finishing) {
        return;
      }

      finishing = true;
      cancelAnimationFrame(animationFrame);

      if (shouldReduceMotion) {
        setProgress(100);
        completionTimer = window.setTimeout(
          () => setIsVisible(false),
          completionHold,
        );
        return;
      }

      const completionStartedAt = performance.now();

      function updateCompletion(now: number) {
        const completionRatio = Math.min(
          (now - completionStartedAt) / completionDuration,
          1,
        );
        setProgress(92 + Math.round(completionRatio * 8));

        if (completionRatio < 1) {
          animationFrame = requestAnimationFrame(updateCompletion);
          return;
        }

        completionTimer = window.setTimeout(
          () => setIsVisible(false),
          completionHold,
        );
      }

      animationFrame = requestAnimationFrame(updateCompletion);
    }

    function handlePageLoad() {
      pageLoaded = true;
      finishProgress();
    }

    function updateWaitingProgress(now: number) {
      const elapsedRatio = Math.min((now - startedAt) / minimumDuration, 1);
      const easedRatio = 1 - Math.pow(1 - elapsedRatio, 3);
      const nextProgress = Math.min(92, Math.round(easedRatio * 92));

      setProgress((current) => Math.max(current, nextProgress));

      if (elapsedRatio < 1) {
        animationFrame = requestAnimationFrame(updateWaitingProgress);
      }
    }

    if (pageLoaded) {
      queueMicrotask(finishProgress);
    } else {
      window.addEventListener("load", handlePageLoad, { once: true });
    }

    minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      finishProgress();
    }, minimumDuration);

    if (shouldReduceMotion) {
      queueMicrotask(() => setProgress(92));
    } else {
      animationFrame = requestAnimationFrame(updateWaitingProgress);
    }

    return () => {
      window.removeEventListener("load", handlePageLoad);
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
      window.clearTimeout(minimumTimer);
    };
  }, [isBlocking, shouldReduceMotion]);

  useEffect(() => {
    if (!isBlocking) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousBusy = document.body.getAttribute("aria-busy");
    document.body.style.overflow = "hidden";
    document.body.setAttribute("aria-busy", "true");

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousBusy === null) {
        document.body.removeAttribute("aria-busy");
      } else {
        document.body.setAttribute("aria-busy", previousBusy);
      }
    };
  }, [isBlocking]);

  function finishPreloader() {
    document.documentElement.removeAttribute("data-preloader-active");

    if (!isBlocking) {
      return;
    }

    const content = contentRef.current;
    content?.removeAttribute("inert");
    content?.removeAttribute("aria-hidden");
    setIsBlocking(false);

    requestAnimationFrame(() => {
      content?.querySelector<HTMLElement>("[autofocus]")?.focus();
    });
  }

  return (
    <>
      <AnimatePresence onExitComplete={finishPreloader}>
        {isVisible && (
          <motion.div
            key="app-preloader"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0.08 : 0.22,
              delay: shouldReduceMotion ? 0 : 0.1,
            }}
            className="app-preloader fixed inset-0 z-100 min-h-dvh place-items-center overflow-hidden bg-background px-5 py-10 text-foreground"
          >
            <p className="sr-only" role="status" aria-live="polite">
              {t("loading")}
            </p>

            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : -8,
              }}
              transition={{ duration: shouldReduceMotion ? 0.08 : 0.18 }}
              className="w-full max-w-xl"
            >
              <div className="flex flex-col items-center gap-5 text-center">
                <BrandMark className="h-24 w-44" />
                <div>
                  <p className="text-lg font-semibold tracking-tight">
                    {common("brandName")}
                  </p>
                  <p className="mt-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground">
                    {common("developedBy")}
                  </p>
                </div>
              </div>

              <div className="mt-14">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("progressLabel")}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-sm tabular-nums"
                  >
                    {t("percent", { percent: progress })}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("progressLabel")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-1 overflow-hidden rounded-full bg-muted"
                >
                  <motion.div
                    initial={false}
                    animate={{ scaleX: progress / 100 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.12 }}
                    className="h-full origin-left rounded-full bg-foreground"
                  />
                </div>
                <div className="mt-4 min-h-14">
                  <AnimatePresence initial={false} mode="wait">
                    <motion.p
                      key={messageKey}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.14 }}
                      className="rounded-lg px-3 py-2 text-center text-xs leading-5 text-muted-foreground text-balance"
                    >
                      {t(`messages.${messageKey}`)}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        ref={contentRef}
        data-app-content=""
        suppressHydrationWarning
        inert={isBlocking}
        aria-hidden={isBlocking ? true : undefined}
      >
        {children}
      </div>
    </>
  );
}

export { AppPreloader };
