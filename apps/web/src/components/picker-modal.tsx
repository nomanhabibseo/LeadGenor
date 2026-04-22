"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PickerModal({
  open,
  title,
  subtitle,
  onClose,
  search,
  onSearchChange,
  compact,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 dark:bg-black/70 sm:items-center sm:p-4">
      <div
        className={cn(
          "flex max-h-[80vh] w-full flex-col rounded-xl bg-white shadow-2xl dark:border dark:border-slate-600 dark:bg-slate-800 dark:shadow-2xl",
          compact ? "max-w-sm" : "max-w-lg",
        )}
        role="dialog"
        aria-modal
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-700 sm:px-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative border-b border-slate-100 px-2 py-1.5 dark:border-slate-700">
          <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className="form-input-sm pl-9"
            placeholder="Filter…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2 pl-1 pr-0 sm:pl-1.5 sm:pr-0">{children}</div>
        <div className="border-t border-slate-100 px-2 py-2 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-save-primary-block py-2 text-sm shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
