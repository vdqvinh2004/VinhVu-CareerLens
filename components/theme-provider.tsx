"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  DARK_MODE_QUERY,
  THEME_STORAGE_KEY,
  isThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const subscribers = new Set<() => void>();

let stopListening: (() => void) | undefined;

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia(DARK_MODE_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: ThemePreference) {
  const resolvedTheme = resolveTheme(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = theme;
}

function readTheme(): ThemePreference {
  const documentPreference = document.documentElement.dataset.themePreference;

  if (isThemePreference(documentPreference)) {
    return documentPreference;
  }

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (isThemePreference(storedPreference)) {
      return storedPreference;
    }
  } catch {
    return "system";
  }

  return "system";
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function startListening() {
  const mediaQuery = window.matchMedia(DARK_MODE_QUERY);

  applyTheme(readTheme());

  function handleSystemThemeChange() {
    if (readTheme() === "system") {
      applyTheme("system");
    }
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY) {
      return;
    }

    const nextTheme = isThemePreference(event.newValue)
      ? event.newValue
      : "system";

    applyTheme(nextTheme);
    notifySubscribers();
  }

  mediaQuery.addEventListener("change", handleSystemThemeChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function subscribeToTheme(subscriber: () => void) {
  subscribers.add(subscriber);

  if (subscribers.size === 1) {
    stopListening = startListening();
  }

  return () => {
    subscribers.delete(subscriber);

    if (subscribers.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

function getThemeSnapshot() {
  return readTheme();
}

function getServerThemeSnapshot(): ThemePreference {
  return "system";
}

function setThemePreference(nextTheme: ThemePreference) {
  applyTheme(nextTheme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // The document preference still works when storage is unavailable.
  }

  notifySubscribers();
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const contextValue = useMemo(
    () => ({ theme, setTheme: setThemePreference }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

export { ThemeProvider, useTheme };
