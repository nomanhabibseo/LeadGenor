"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowMenuItem =
  | { key: string; type: "link"; label: string; href: string }
  | { key: string; type: "button"; label: string; onClick: () => void; danger?: boolean };

export function DataTableRowMenu({ items, a11yLabel = "Row actions" }: { items: RowMenuItem[]; a11yLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (rootRef.current?.contains(t)) return;
      if (t.closest?.("[data-table-row-menu]")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  if (items.length === 0) return null;

  const menu = open ? (
    <ul
      data-table-row-menu
      className="fixed z-[5000] min-w-[7.5rem] rounded-md border border-slate-200 bg-white py-0.5 text-left text-[11px] shadow-lg dark:border-slate-600 dark:bg-slate-800"
      style={{ top: menuPos.top, right: menuPos.right }}
      role="menu"
    >
      {items.map((it) => {
        if (it.type === "link") {
          return (
            <li key={it.key} role="none">
              <Link
                href={it.href}
                className="block px-2.5 py-1.5 text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700/80"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            </li>
          );
        }
        return (
          <li key={it.key} role="none">
            <button
              type="button"
              className={cn(
                "block w-full px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700/80",
                it.danger
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-800 dark:text-slate-100",
              )}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <div className="relative inline-flex" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-700/50"
        aria-label={a11yLabel}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
