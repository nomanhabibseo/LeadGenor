"use client";

import { FileUp, X } from "lucide-react";

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
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="modal-surface w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {subtitle ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">CSV file</span>
            <label className="mt-1 flex cursor-pointer items-center gap-2">
              <span className="form-input-body inline-flex flex-1 cursor-pointer items-center gap-2 py-2 text-xs text-slate-700 dark:text-slate-200">
                <FileUp className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-cyan-400" />
                Choose file…
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onPickCsv(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Google Sheet URL</span>
            <input
              className="form-input-body mt-1 font-mono text-xs"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(e) => onSheetUrlChange(e.target.value)}
              disabled={!token}
            />
            <button
              type="button"
              disabled={!token || !sheetUrl.trim()}
              onClick={() => void onImportFromSheet()}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Import from URL
            </button>
          </div>
        </div>

        {importMsg ? (
          <p className="mt-3 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">{importMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
