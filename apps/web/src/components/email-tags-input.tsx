"use client";

import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { parseEmailsClient } from "@/lib/emails-input";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailTagsInputProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  invalid?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
};

/** Emails as chips; comma or Enter commits a valid address (stored joined by `, ` in `value`). */
export function EmailTagsInput({
  value,
  onChange,
  placeholder = "Type an email, then comma or Enter",
  disabled,
  className,
  invalid,
  "aria-invalid": ariaInvalid,
}: EmailTagsInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const chips = parseEmailsClient(value);

  const commitOne = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      if (!EMAIL_RE.test(t)) return;
      const lower = t.toLowerCase();
      if (chips.some((c) => c.toLowerCase() === lower)) {
        setDraft("");
        return;
      }
      const next = [...chips, t].join(", ");
      onChange(next);
      setDraft("");
    },
    [chips, onChange],
  );

  function removeAt(i: number) {
    const next = chips.filter((_, j) => j !== i);
    onChange(next.join(", "));
  }

  return (
    <div
      className={cn(
        "group/email-tags flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-100/80 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:ring-slate-700/50 dark:focus-within:border-sky-400",
        invalid && "border-red-400 ring-red-200 dark:border-red-500/60 dark:ring-red-900/40",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((em, i) => (
        <span
          key={`${em}-${i}`}
          className="group/chip inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200/90 bg-slate-100/95 pl-2 pr-0.5 py-0.5 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-700/90 dark:text-slate-100"
        >
          <span className="truncate">{em}</span>
          <button
            type="button"
            title="Remove"
            disabled={disabled}
            className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-slate-200 hover:text-slate-900 group-hover/chip:opacity-100 dark:hover:bg-slate-600 dark:hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              removeAt(i);
            }}
          >
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="email"
        autoComplete="email"
        disabled={disabled}
        placeholder={chips.length === 0 ? placeholder : "Add another…"}
        className="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        value={draft}
        aria-invalid={ariaInvalid}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitOne(draft.trim());
            return;
          }
          if (e.key === "Backspace" && !draft && chips.length > 0) {
            removeAt(chips.length - 1);
          }
        }}
        onBlur={() => {
          const t = draft.trim();
          if (t && EMAIL_RE.test(t)) commitOne(t);
        }}
      />
    </div>
  );
}
