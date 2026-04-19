"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import { setThemeCookieClient, THEME_STORAGE_KEY } from "@/lib/theme-storage";

function readStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  }
}

function applyDarkClass(next: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", next);
  root.style.colorScheme = next ? "dark" : "light";
  const v = next ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, v);
  } catch {
    /* private mode / blocked storage */
  }
  setThemeCookieClient(v);
}

type ThemeCtx = { dark: boolean; toggle: () => void };
const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  /** Align DOM + state with localStorage (inline script in layout already set `html.dark`). */
  useLayoutEffect(() => {
    const next = readStoredTheme();
    applyDarkClass(next);
    setDark(next);
  }, []);

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      applyDarkClass(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
