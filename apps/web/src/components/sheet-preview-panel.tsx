"use client";

import type { SheetPreviewData } from "@/hooks/use-sheet-preview";

export function SheetPreviewPanel({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: SheetPreviewData | null;
}) {
  if (loading) {
    return <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Reading sheet columns…</p>;
  }
  if (error) {
    return (
      <p className="mt-2 whitespace-pre-wrap text-xs text-amber-800 dark:text-amber-200/90">{error}</p>
    );
  }
  if (!data?.columns?.length) return null;
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/90 p-2 text-xs dark:border-slate-600 dark:bg-slate-900/40">
      <p className="font-semibold text-slate-800 dark:text-slate-100">
        Columns ({data.columns.length}) · ~{data.approxDataRows} data row(s)
      </p>
      <p className="mt-1 break-words font-mono text-[11px] text-slate-700 dark:text-slate-300">
        {data.columns.join(" · ")}
      </p>
      {data.matchedHints.length > 0 ? (
        <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300/90">
          Recognized fields: {data.matchedHints.join(", ")}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
          Tip: include headers like site_url, company_name, email for best results.
        </p>
      )}
    </div>
  );
}
