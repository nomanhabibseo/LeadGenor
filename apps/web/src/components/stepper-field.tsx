"use client";

import { cn } from "@/lib/utils";
import { NativeNumberInput } from "@/components/native-number-input";

/**
 * Numeric fields using the native number spinner (same look as follow-up “in (n) days”).
 * Optional `prefix` (e.g. currency symbol) sits to the left of the input.
 * Use `value={null}` for a blank default; `onChange` may receive `null` when cleared.
 */
export function StepperField({
  value,
  onChange,
  mode = "int",
  min = 0,
  max,
  step = 1,
  showZero,
  prefix,
  placeholder,
  className,
  embedded,
  onBlur,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  mode?: "int" | "decimal";
  min?: number;
  max?: number;
  step?: number;
  /** @deprecated Kept for call-site compatibility */
  showZero?: boolean;
  prefix?: string;
  placeholder?: string;
  className?: string;
  embedded?: boolean;
  onBlur?: () => void;
  "aria-label"?: string;
}) {
  void showZero;
  const inner = (
    <div className="flex min-w-0 flex-1 items-stretch">
      {prefix ? (
        <span className="pointer-events-none flex shrink-0 items-center pl-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {prefix}
        </span>
      ) : null}
      <NativeNumberInput
        unstyled
        mode={mode}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={cn("min-h-[2.25rem] flex-1", prefix ? "pl-1 pr-2" : "px-2")}
      />
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("flex min-w-0 flex-1 items-stretch overflow-hidden", className)}>{inner}</div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/40 transition-colors hover:border-sky-500 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800/75 dark:ring-slate-700/50 dark:hover:border-sky-400 dark:focus-within:border-sky-400 dark:focus-within:ring-sky-500/25",
        className,
      )}
    >
      {inner}
    </div>
  );
}
