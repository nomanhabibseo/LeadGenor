"use client";

/**
 * Pill switch: grey track when off, blue when on, white thumb.
 * Place the field label beside this control (do not put text inside the switch).
 */
export function FormSwitch({
  on,
  onToggle,
  disabled,
  "aria-label": ariaLabel,
  id,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-blue-600 dark:bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
        aria-hidden
      />
    </button>
  );
}
