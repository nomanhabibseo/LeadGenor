"use client";

import { cn } from "@/lib/utils";

/**
 * Native `type="number"` with browser spinner — same visual language as follow-up “in (n) days”.
 * Use `unstyled` when an outer shell (e.g. `StepperField`) already provides the border.
 * Pass `null` for an empty field (no “0” shown); `onChange` may receive `null` when cleared.
 */
export function NativeNumberInput({
  value,
  onChange,
  mode = "int",
  min = 0,
  max,
  step = 1,
  unstyled = false,
  className,
  placeholder,
  onBlur,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  mode?: "int" | "decimal";
  min?: number;
  max?: number;
  step?: number;
  unstyled?: boolean;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
  "aria-label"?: string;
}) {
  const nStep = mode === "int" ? step : 0.01;
  const display = value === null || value === undefined || Number.isNaN(value) ? "" : String(value);
  return (
    <input
      type="number"
      aria-label={ariaLabel}
      placeholder={placeholder}
      min={min}
      max={max}
      step={nStep}
      value={display}
      onBlur={onBlur}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(null);
          return;
        }
        const n = mode === "int" ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isNaN(n)) return;
        let v = n;
        if (v < min) v = min;
        if (max != null && v > max) v = max;
        onChange(v);
      }}
      className={cn(
        unstyled
          ? "w-full min-w-0 border-0 bg-transparent py-2 text-center text-sm font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-0 dark:text-slate-100"
          : "min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-center text-sm font-semibold tabular-nums text-slate-900 shadow-sm transition-colors hover:border-sky-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-400 dark:focus:border-sky-400 dark:focus:ring-sky-500/25",
        className,
      )}
    />
  );
}
