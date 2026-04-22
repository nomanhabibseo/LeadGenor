"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

type Tpl = { id: string; name: string; folder: { name: string } };

function folderNameOf(t: Tpl) {
  return (t.folder?.name ?? "").trim() || "Uncategorized";
}

/**
 * Email step: shows folder/template when chosen; opens a modal to pick folder then template.
 */
export function FlowEmailTemplateSelect({
  value,
  onChange,
  templates,
  flowCardClass,
  variant = "pill",
  emptyLabel = "Add email content",
  showEmailPill = true,
  compact = false,
}: {
  value: string;
  onChange: (templateId: string) => void;
  templates: Tpl[];
  flowCardClass: string;
  variant?: "pill" | "panel";
  emptyLabel?: string;
  showEmailPill?: boolean;
  compact?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<"folders" | "templates">("folders");
  const [folderKey, setFolderKey] = useState<string | null>(null);
  /** In templates step: highlighted row; applied only when user clicks Save. */
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const sel = templates.find((t) => t.id === value);
  const summary = sel ? `${sel.folder.name} / ${sel.name}` : emptyLabel;

  const folderNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) {
      set.add(folderNameOf(t));
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const templatesInFolder = useMemo(
    () => (folderKey ? templates.filter((t) => folderNameOf(t) === folderKey) : []),
    [templates, folderKey],
  );

  function openPicker() {
    setPickerView("folders");
    setFolderKey(null);
    setPendingTemplateId(null);
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerView("folders");
    setFolderKey(null);
    setPendingTemplateId(null);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickerOpen(false);
        setPickerView("folders");
        setFolderKey(null);
        setPendingTemplateId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  const innerRound = compact
    ? variant === "pill"
      ? "rounded-xl py-1.5 pl-2 pr-7"
      : "rounded-lg py-1.5 pl-2 pr-7"
    : variant === "pill"
      ? "rounded-2xl py-3 pl-3 pr-9"
      : "rounded-xl py-3 pl-3 pr-9";
  const outer =
    variant === "pill"
      ? compact
        ? "relative inline-flex w-full min-w-0 max-w-full flex-col items-stretch justify-center"
        : "relative inline-flex w-full max-w-sm min-w-[12rem] flex-col items-stretch justify-center"
      : "relative flex w-full min-w-0 flex-col items-stretch";

  return (
    <div className={cn(outer, flowCardClass)}>
      <button
        type="button"
        className={cn(
          "relative w-full text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/60",
          innerRound,
        )}
        aria-label="Choose email template"
        onClick={openPicker}
      >
        <div className="flex min-w-0 max-w-full flex-col items-center gap-1 px-2 text-center">
          {showEmailPill ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
              <Mail className="h-3 w-3 shrink-0" />
              Email
            </span>
          ) : null}
          <span
            className={cn(
              "line-clamp-2 max-w-full min-w-0 break-words px-1 leading-snug",
              compact ? "text-[11px]" : "text-xs",
              sel ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-400 dark:text-slate-500",
            )}
          >
            {summary}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 shrink-0 -translate-y-1/2 text-slate-400",
            compact ? "right-1.5 h-3 w-3" : "right-2.5 h-4 w-4",
          )}
        />
      </button>

      {pickerOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={closePicker} role="presentation">
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-label="Choose template"
            onClick={(e) => e.stopPropagation()}
          >
            {pickerView === "folders" ? (
              <>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Choose a folder</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Then pick a template inside it.</p>
                {folderNames.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No templates available yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {folderNames.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800/80"
                          onClick={() => {
                            setFolderKey(name);
                            const inFolder = templates.filter((t) => folderNameOf(t) === name);
                            const preselect = value && inFolder.some((t) => t.id === value) ? value : null;
                            setPendingTemplateId(preselect);
                            setPickerView("templates");
                          }}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-6 flex justify-end">
                  <button type="button" className="rounded-lg border px-3 py-2 text-sm dark:border-slate-600" onClick={closePicker}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  onClick={() => {
                    setPickerView("folders");
                    setFolderKey(null);
                    setPendingTemplateId(null);
                  }}
                >
                  ← Folders
                </button>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{folderKey}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Select a template, then click Save.</p>
                <ul className="mt-4 space-y-2">
                  {templatesInFolder.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition dark:border-slate-600",
                          pendingTemplateId === t.id
                            ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-950 ring-2 ring-indigo-500/25 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100"
                            : "border-slate-200 text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/80",
                        )}
                        onClick={() => setPendingTemplateId(t.id)}
                      >
                        {t.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <button type="button" className="rounded-lg border px-3 py-2 text-sm dark:border-slate-600" onClick={closePicker}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-save-primary-sm disabled:pointer-events-none disabled:opacity-50"
                    disabled={!pendingTemplateId}
                    onClick={() => {
                      if (pendingTemplateId) onChange(pendingTemplateId);
                      closePicker();
                    }}
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
