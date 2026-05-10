"use client";

import { FileUp, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ImportQuitOverlay } from "@/components/sheet-import-quit-overlay";
import { SheetPreviewPanel } from "@/components/sheet-preview-panel";
import { useSheetPreview } from "@/hooks/use-sheet-preview";
import { SkippedDuplicateUrlsPanel } from "@/components/skipped-duplicate-urls-panel";
import { SHEET_IMPORT_BUSY_HINT, SHEET_IMPORT_BUTTON_LABEL } from "@/lib/sheet-import-busy-message";
import { cn } from "@/lib/utils";

export function ImportSpreadsheetModal({
  open,
  title,
  subtitle,
  onClose,
  token,
  sheetUrl,
  onSheetUrlChange,
  importMsg,
  onPickCsv,
  onImportFromSheet,
  importBusy = false,
  importProgressSummary = null,
  onAbortImportFlow,
  skippedDuplicateUrls,
  skippedDuplicatesDescription,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  token: string | undefined;
  sheetUrl: string;
  onSheetUrlChange: (v: string) => void;
  importMsg: string | null;
  onPickCsv: (file: File | null) => void;
  onImportFromSheet: () => void;
  importBusy?: boolean;
  /** Live row count label, e.g. "Imported 12 / 120" */
  importProgressSummary?: string | null;
  /** Abort the active import HTTP request(s). Required for cancel‑while‑running UX. */
  onAbortImportFlow?: () => void;
  skippedDuplicateUrls?: string[];
  skippedDuplicatesDescription?: string;
}) {
  const sheetPreview = useSheetPreview(sheetUrl, token, open);
  const [quitOpen, setQuitOpen] = useState(false);

  useEffect(() => {
    if (!open) setQuitOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function requestClose() {
    if (importBusy) setQuitOpen(true);
    else onClose();
  }

  function onQuitConfirmed() {
    onAbortImportFlow?.();
    setQuitOpen(false);
    onClose();
  }

  if (!open) return null;

  const importOutcomeVisible = Boolean(importMsg) || (skippedDuplicateUrls?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal
        className="modal-surface relative flex max-h-[min(88vh,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
      >
        <ImportQuitOverlay open={quitOpen} onQuitOk={onQuitConfirmed} onBackToTab={() => setQuitOpen(false)} />

        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => requestClose()}
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">CSV file</span>
              <label
                className={cn(
                  "mt-1 flex cursor-pointer items-center gap-2",
                  importBusy && "pointer-events-none opacity-50",
                )}
              >
                <span className="form-input-body inline-flex flex-1 cursor-pointer items-center gap-2 py-2 text-xs text-slate-700 dark:text-slate-200">
                  <FileUp className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-cyan-400" />
                  Choose file…
                </span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onPickCsv(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Google Sheet URL</span>
              <input
                className="form-input-body mt-1 font-mono text-xs"
                placeholder="https://docs.google.com/spreadsheets/d/…"
                value={sheetUrl}
                onChange={(e) => onSheetUrlChange(e.target.value)}
                disabled={!token || importBusy}
              />
              <SheetPreviewPanel loading={sheetPreview.loading} error={sheetPreview.error} data={sheetPreview.data} />
              <button
                type="button"
                disabled={!token || !sheetUrl.trim() || importBusy}
                onClick={() => void onImportFromSheet()}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {importBusy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    {SHEET_IMPORT_BUTTON_LABEL}
                  </>
                ) : (
                  "Import from URL"
                )}
              </button>
              {importBusy ? (
                <>
                  {importProgressSummary ? (
                    <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-100">{importProgressSummary}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{SHEET_IMPORT_BUSY_HINT}</p>
                </>
              ) : null}
            </div>
          </div>

          {importMsg ? (
            <div className="mt-4">
              <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-800 dark:bg-slate-900/55 dark:text-slate-100">
                {importMsg}
              </p>
            </div>
          ) : null}
          {skippedDuplicateUrls?.length ? (
            <div className="mt-4">
              <SkippedDuplicateUrlsPanel urls={skippedDuplicateUrls} description={skippedDuplicatesDescription} />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          {importBusy ? (
            <button
              type="button"
              className="text-sm font-medium text-red-600 hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
              onClick={() => onAbortImportFlow?.()}
            >
              Cancel import
            </button>
          ) : importOutcomeVisible ? (
            <button
              type="button"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
              onClick={() => onClose()}
            >
              Back
            </button>
          ) : (
            <button type="button" className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100" onClick={() => requestClose()}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
