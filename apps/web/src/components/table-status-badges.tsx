import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pastel pill + dot — deal status (vendors) */
export function DealStatusTablePill({
  variant,
  children,
  className,
}: {
  variant: "pending" | "done";
  children: ReactNode;
  className?: string;
}) {
  const isPending = variant === "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight",
        isPending
          ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isPending ? "bg-amber-700 dark:bg-amber-400" : "bg-emerald-700 dark:bg-emerald-400",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

/** Order list: Completed / Pending with same visual language as deal status */
export function OrderStatusTablePill({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s !== "COMPLETED" && s !== "PENDING") {
    return <span className="text-[11px] text-slate-600 dark:text-slate-300">{status}</span>;
  }
  const isDone = s === "COMPLETED";
  const label = isDone ? "Completed" : "Pending";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-tight",
        isDone
          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"
          : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isDone ? "bg-emerald-700 dark:bg-emerald-400" : "bg-amber-700 dark:bg-amber-400",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

function nichePalette(label: string | undefined): { bg: string; text: string } {
  const raw = (label || "").trim();
  const w = raw.split(/[\s&|,]+/)[0]?.toLowerCase() || "";
  if (w.includes("saas") || w.includes("software") || w.includes("b2b")) {
    return { bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-900 dark:text-violet-200" };
  }
  if (w.includes("food") || w.includes("recipe") || w.includes("cook")) {
    return { bg: "bg-amber-100 dark:bg-amber-950/45", text: "text-amber-950 dark:text-amber-100" };
  }
  if (w === "general" || w.includes("general")) {
    return { bg: "bg-slate-100 dark:bg-slate-800/80", text: "text-slate-800 dark:text-slate-100" };
  }
  const palettes: { bg: string; text: string }[] = [
    { bg: "bg-violet-100 dark:bg-violet-950/50", text: "text-violet-900 dark:text-violet-200" },
    { bg: "bg-amber-100 dark:bg-amber-950/45", text: "text-amber-950 dark:text-amber-100" },
    { bg: "bg-sky-100 dark:bg-sky-950/45", text: "text-sky-900 dark:text-sky-100" },
    { bg: "bg-teal-100 dark:bg-teal-950/45", text: "text-teal-900 dark:text-teal-100" },
    { bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-900 dark:text-rose-100" },
  ];
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h + raw.charCodeAt(i) * (i + 1)) % 1000000;
  return palettes[h % palettes.length];
}

/** Single-line niche label with screenshot-style pill backgrounds */
export function NicheTablePill({ text }: { text: string }) {
  const t = text.trim() || "—";
  if (t === "—") {
    return <span className="text-[11px] text-slate-400">—</span>;
  }
  const { bg, text: tc } = nichePalette(t);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight",
        bg,
        tc,
      )}
      title={t}
    >
      {t}
    </span>
  );
}

/** Thin DR meter: &lt;10 red, 10–20 blue, &gt;20 green */
export function DrTableMeter({ dr }: { dr: number }) {
  const pct = Math.min(100, Math.max(0, Number(dr) || 0));
  let fill = "bg-emerald-500 dark:bg-emerald-400";
  if (pct < 10) fill = "bg-red-500 dark:bg-red-400";
  else if (pct <= 20) fill = "bg-blue-500 dark:bg-blue-400";
  return (
    <div className="flex items-center justify-center gap-1.5">
      <div
        className="h-1 w-11 min-w-[2.75rem] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        title={`DR ${dr}`}
      >
        <div className={cn("h-full min-h-[4px] rounded-full", fill)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-slate-700 dark:text-slate-200">{dr}</span>
    </div>
  );
}
