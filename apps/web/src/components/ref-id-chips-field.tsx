"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type RefOption = { id: string; label: string };

type RefIdChipsFieldProps = {
  ids: string[];
  options: RefOption[];
  max: number;
  onChange: (ids: string[]) => void;
  onOpenPicker: () => void;
  emptyLabel?: string;
  error?: string | null;
  required?: boolean;
  label: string;
};

/** Selected reference rows (niche/country) as chips; click the box to open the picker (max caps). */
export function RefIdChipsField({
  ids,
  options,
  max,
  onChange,
  onOpenPicker,
  emptyLabel = "Choose…",
  error,
  required,
  label,
}: RefIdChipsFieldProps) {
  const optMap = new Map(options.map((o) => [o.id, o.label]));

  function removeId(id: string) {
    onChange(ids.filter((x) => x !== id));
  }

  return (
    <div>
      <span className="form-label-sm">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "form-trigger-body mt-1 flex max-h-[5rem] min-h-[2.75rem] w-full flex-col overflow-hidden text-left outline-none transition hover:border-slate-300 dark:hover:border-slate-500",
          error && "form-input-body-invalid",
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-chip-remove]")) return;
          onOpenPicker();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenPicker();
          }
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5">
          <div className="flex flex-wrap content-start items-center gap-1">
            {ids.length === 0 ? (
              <span className="text-[11px] text-slate-400 dark:text-slate-300">{emptyLabel}</span>
            ) : (
              ids.map((id) => (
                <span
                  key={id}
                  className="group/chip inline-flex max-w-full items-center gap-0.5 rounded border border-slate-200/90 bg-slate-100/95 pl-1.5 pr-0.5 py-px text-[10px] font-medium leading-tight text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-700/90 dark:text-slate-100"
                >
                  <span className="max-w-[10rem] truncate">{optMap.get(id) ?? id}</span>
                  <button
                    type="button"
                    data-chip-remove
                    title="Remove"
                    className="rounded p-px text-slate-500 opacity-0 transition hover:bg-slate-200 hover:text-slate-900 group-hover/chip:opacity-100 dark:hover:bg-slate-600 dark:hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeId(id);
                    }}
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
      {error ? <p className="form-field-error">{error}</p> : null}
    </div>
  );
}
