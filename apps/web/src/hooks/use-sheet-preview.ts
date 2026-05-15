"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export type SheetPreviewData = {
  columns: string[];
  normalizedColumns: string[];
  matchedHints: string[];
  approxDataRows: number;
};

/**
 * Debounced Google Sheet header fetch (public sheet export as CSV, first row = columns).
 */
export function useSheetPreview(url: string, token: string | undefined, enabled: boolean) {
  const [data, setData] = useState<SheetPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled || !token) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const t = url.trim();
    if (t.length < 30 || !t.includes("docs.google.com/spreadsheets")) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const my = ++seq.current;
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch<SheetPreviewData>("/import-export/sheet-preview", token, {
            method: "POST",
            body: JSON.stringify({ url: t }),
            signal: ac.signal,
          });
          if (seq.current !== my) return;
          setData(res);
          setError(null);
        } catch (e: unknown) {
          if (ac.signal.aborted) return;
          const msg =
            e instanceof Error
              ? e.message
              : typeof e === "object" && e !== null && "message" in e
                ? String((e as { message: unknown }).message)
                : "Could not preview sheet.";
          if (seq.current !== my) return;
          setData(null);
          setError(msg);
        } finally {
          if (seq.current === my) setLoading(false);
        }
      })();
    }, 450);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [url, token, enabled]);

  return { data, loading, error };
}
