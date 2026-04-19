import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pill badge: red (pending) or green (done), white text — matches dashboard status style */
export function StatusPill({
  variant,
  children,
  className,
}: {
  variant: "pending" | "done";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-xs font-semibold leading-tight text-white",
        variant === "done" ? "bg-emerald-600" : "bg-red-600",
        className,
      )}
    >
      {children}
    </span>
  );
}
