"use client";

import { cn } from "@/lib/utils";

export function TablePagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Back
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={cn(
              "min-w-[2rem] rounded border px-2 py-1 text-xs font-medium shadow-sm",
              p === page
                ? "border-transparent bg-brand-gradient text-slate-100 ring-1 ring-white/10"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
            )}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
