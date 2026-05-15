"use client";

import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function PageBreadcrumb({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav className="mb-3 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`}>
          {i > 0 ? <span className="mx-1.5 text-slate-300 dark:text-slate-600">→</span> : null}
          {it.href ? (
            <Link href={it.href} className="hover:text-cyan-600 hover:underline dark:hover:text-cyan-400">
              {it.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-800 dark:text-slate-200">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
