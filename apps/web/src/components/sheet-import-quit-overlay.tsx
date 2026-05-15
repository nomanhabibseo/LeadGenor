"use client";

import { IMPORT_IN_FLIGHT_QUIT_MESSAGE } from "@/lib/sheet-import-busy-message";

/** Blocks the import dialog until the user confirms leaving while a fetch is active. */
export function ImportQuitOverlay({
  open,
  onQuitOk,
  onBackToTab,
  message = IMPORT_IN_FLIGHT_QUIT_MESSAGE,
}: {
  open: boolean;
  onQuitOk: () => void;
  onBackToTab: () => void;
  message?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-quit-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="import-quit-title" className="text-sm leading-relaxed text-slate-800 dark:text-slate-100">
          {message}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="px-1 py-1 text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
            onClick={onBackToTab}
          >
            Back to tab
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            onClick={onQuitOk}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
