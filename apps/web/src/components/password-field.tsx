"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  autoComplete?: string;
  "aria-label"?: string;
  id?: string;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
};

/** Password input with show/hide toggle (Eye icon). */
export function PasswordField({
  value,
  onChange,
  className,
  autoComplete,
  "aria-label": ariaLabel,
  id,
  minLength,
  required,
  placeholder,
}: PasswordFieldProps) {
  const autoId = useId();
  const fid = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={fid}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        minLength={minLength}
        required={required}
        placeholder={placeholder}
        className={cn("w-full pr-10", className)}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4 shrink-0" aria-hidden /> : <Eye className="h-4 w-4 shrink-0" aria-hidden />}
      </button>
    </div>
  );
}
