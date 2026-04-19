"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  accentClassName,
  compactValue,
}: {
  label: string;
  value: string | number;
  href: string;
  icon: LucideIcon;
  accentClassName?: string;
  /** Slightly smaller metric (e.g. dashboard vendor/client counts). */
  compactValue?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card transition-all",
        "dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-none dark:ring-1 dark:ring-slate-700/50",
        "hover:-translate-y-1 hover:border-brand-300/60 hover:shadow-brand dark:hover:border-cyan-500/30",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-violet-500 to-amber-400 opacity-0 transition group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p
            className={cn(
              "mt-2 font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100",
              compactValue ? "text-xl" : "text-2xl",
            )}
          >
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 shadow-inner",
            "dark:from-slate-800 dark:to-slate-900 dark:text-slate-300",
            "group-hover:from-brand-50 group-hover:to-violet-50 group-hover:text-brand-700 dark:group-hover:from-slate-800 dark:group-hover:to-slate-800 dark:group-hover:text-cyan-300",
            accentClassName,
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
      </div>
    </Link>
  );
}
