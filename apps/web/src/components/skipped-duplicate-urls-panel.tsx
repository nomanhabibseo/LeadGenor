"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function SkippedDuplicateUrlsPanel({
  urls,
  description,
  onDismiss,
  headline,
}: {
  urls: string[];
  /** e.g. "already exist in your vendors" */
  description?: string;
  onDismiss?: () => void;
  /** Overrides default “already in your data — not added” title */
  headline?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!urls.length) return null;
  const desc =
    description ??
    "These site URLs were already saved in your account, so new rows were not created for them.";
  const titleLine =
    headline ??
    `${urls.length} URL${urls.length === 1 ? "" : "s"} already in your data — not added.`;
  return (
    <>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">{titleLine}</p>
        <p className="mt-1 text-[11px] text-amber-900/90 dark:text-amber-200/90">{desc}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="text-[11px] font-semibold text-brand-700 underline dark:text-cyan-400"
            onClick={() => setOpen(true)}
          >
            See duplicate URLs
          </button>
          {onDismiss ? (
            <button
              type="button"
              className="text-[11px] text-slate-600 underline dark:text-slate-400"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="dup-urls-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="modal-surface relative max-h-[min(80vh,520px)] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <h4 id="dup-urls-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                URLs not added (already in your data)
              </h4>
              <button
                type="button"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[min(60vh,400px)] list-inside list-disc overflow-y-auto px-4 py-3 font-mono text-[11px] text-slate-800 dark:text-slate-200">
              {urls.map((u) => (
                <li key={u} className="break-all py-0.5">
                  {u}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
