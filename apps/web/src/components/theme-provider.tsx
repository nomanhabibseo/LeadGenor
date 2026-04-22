"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import {
  resolveThemeDark,
  setThemeCookieClient,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-storage";

function readStoredPreference(): ThemePreference {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === "dark" || s === "light" || s === "system") return s;
  } catch {
    /* private mode */
  }
  return "system";
}

function applyPreference(pref: ThemePreference) {
  const dark = resolveThemeDark(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  setThemeCookieClient(dark ? "dark" : "light");
}

type ThemeCtx = {
  preference: ThemePreference;
  /** Resolved UI dark flag (system → prefers-color-scheme). */
  resolvedDark: boolean;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const { data: me } = useQuery({
    queryKey: ["users", "me", "theme", token],
    queryFn: () =>
      apiFetch<{ themePreference?: string | null }>("/users/me", token),
    enabled: status === "authenticated" && !!token,
  });

  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useLayoutEffect(() => {
    const fromServer = me?.themePreference;
    if (fromServer === "light" || fromServer === "dark" || fromServer === "system") {
      setPreferenceState(fromServer);
      applyPreference(fromServer);
      return;
    }
    const local = readStoredPreference();
    setPreferenceState(local);
    applyPreference(local);
  }, [me?.themePreference]);

  useLayoutEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPreference("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    applyPreference(p);
  }, []);

  const resolvedDark = useMemo(() => resolveThemeDark(preference), [preference]);

  const value = useMemo(
    () => ({ preference, resolvedDark, setPreference }),
    [preference, resolvedDark, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
