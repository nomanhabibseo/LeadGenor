"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-700/80";

export function TablePagination({
  page,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 30, 50],
  showLimitSelect = true,
  className,
}: {
  page: number;
  totalPages: number;
  limit: number;
  onPageChange: (p: number) => void;
  onLimitChange?: (n: number) => void;
  limitOptions?: number[];
  /** When false, rows-per-page dropdown is hidden (fixed page size). */
  showLimitSelect?: boolean;
  className?: string;
}) {
  const showNav = totalPages > 1;
  const showSize = showLimitSelect && typeof onLimitChange === "function";

  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-center justify-end gap-2",
        className,
      )}
    >
        {showSize ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="sr-only">Rows per page</span>
            <select
              className="h-9 min-w-[3.25rem] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={limit}
              onChange={(e) => {
                onLimitChange!(Number(e.target.value));
                onPageChange(1);
              }}
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showNav ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={navBtn}
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={navBtn}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl border border-violet-500/80 bg-violet-50 px-2.5 text-sm font-semibold text-violet-700 shadow-sm tabular-nums dark:border-violet-400/70 dark:bg-violet-950/50 dark:text-violet-200"
              aria-current="page"
            >
              {page}
            </span>
            <button
              type="button"
              className={navBtn}
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={navBtn}
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
    </div>
  );
}
