"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExportChunk = { limit: number; offset: number };

/**
 * Single Export control: CSV / Excel / PDF. For large unfiltered lists, asks row cap first.
 */
export function ExportFormatMenu({
  label = "Export",
  total,
  selectionCount,
  disabled,
  busy,
  showPdf,
  onExportCsv,
  onExportExcel,
  onExportPdf,
}: {
  label?: string;
  total: number;
  selectionCount: number;
  disabled?: boolean;
  busy?: boolean;
  showPdf?: boolean;
  onExportCsv: (chunk?: ExportChunk) => void;
  onExportExcel: (chunk?: ExportChunk) => void;
  onExportPdf?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [chunkKind, setChunkKind] = useState<"csv" | "xlsx" | null>(null);

  const needChunk = total > 1000 && selectionCount === 0;

  function runCsv(chunk?: ExportChunk) {
    onExportCsv(chunk);
    setOpen(false);
    setChunkKind(null);
  }

  function runExcel(chunk?: ExportChunk) {
    onExportExcel(chunk);
    setOpen(false);
    setChunkKind(null);
  }

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          disabled={disabled || busy || total === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          onClick={() => setOpen((o) => !o)}
        >
          <Download className="h-4 w-4" />
          {busy ? "…" : label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        {open && (
          <div className="absolute right-0 z-40 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                if (needChunk) {
                  setOpen(false);
                  setChunkKind("csv");
                } else runCsv(undefined);
              }}
            >
              CSV
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              onClick={() => {
                if (needChunk) {
                  setOpen(false);
                  setChunkKind("xlsx");
                } else runExcel(undefined);
              }}
            >
              Excel
            </button>
            {showPdf && onExportPdf ? (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  onExportPdf();
                  setOpen(false);
                }}
              >
                PDF
              </button>
            ) : null}
          </div>
        )}
      </div>

      {chunkKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <p className="text-sm text-slate-800 dark:text-slate-100">
              Your list has {total} rows. Export the first batch:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([500, 1000, 5000] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium dark:border-slate-600",
                  )}
                  onClick={() =>
                    chunkKind === "csv"
                      ? runCsv({ limit: c, offset: 0 })
                      : runExcel({ limit: c, offset: 0 })
                  }
                >
                  First {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm text-slate-600 underline dark:text-slate-400"
              onClick={() => setChunkKind(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
