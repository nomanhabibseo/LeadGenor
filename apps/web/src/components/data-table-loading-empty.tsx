"use client";

import { Loader2 } from "lucide-react";

export function DataTableLoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="data-table-td py-16">
        <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <span>Loading table…</span>
        </div>
      </td>
    </tr>
  );
}

export function DataTableEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="data-table-td py-14 text-center text-sm text-slate-500 dark:text-slate-400">
        {message}
      </td>
    </tr>
  );
}

/** Shown below toolbar until the first list fetch finishes (avoids “empty” flicker). */
export function ListPageBodyLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 py-16 dark:border-slate-700 dark:bg-slate-800/30"
      aria-busy
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500 dark:text-indigo-400" aria-hidden />
      <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
    </div>
  );
}
