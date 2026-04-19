"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileUp,
  Filter,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { ExportFormatMenu, type ExportChunk } from "@/components/export-format-menu";
import { TablePagination } from "@/components/table-pagination";
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";
import { useReference } from "@/hooks/use-reference";
import { appendRangeParams } from "@/lib/range-query";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import {
  countriesShortList,
  nicheFirstWord,
} from "@/lib/vendor-table-display";

const PAGE_SIZE = 100;

type DealStatus = "DEAL_DONE" | "PENDING";

type Row = {
  id: string;
  siteUrl: string;
  dr: number;
  traffic: number;
  dealStatus: DealStatus;
  guestPostPrice: string | { toString(): string };
  currency: { symbol: string; code: string };
  language: { name: string };
  niches: { niche: { label: string } }[];
  countries: { country: { name: string; code: string } }[];
  completedOrderCount?: number;
};

/** Single-field ranges: e.g. "10 - 50" or "100" */
type VendorFilters = {
  nicheId: string;
  countryId: string;
  languageId: string;
  traffic: string;
  dr: string;
  gp: string;
  ne: string;
  mozDa: string;
  as: string;
  tat: string;
  ref: string;
  backlinks: string;
  paymentTerms: "" | "ADVANCE" | "AFTER_LIVE_LINK";
  dealStatus: "" | DealStatus;
};

const emptyFilters = (): VendorFilters => ({
  nicheId: "",
  countryId: "",
  languageId: "",
  traffic: "",
  dr: "",
  gp: "",
  ne: "",
  mozDa: "",
  as: "",
  tat: "",
  ref: "",
  backlinks: "",
  paymentTerms: "",
  dealStatus: "",
});

type ColKey =
  | "dealStatus"
  | "niche"
  | "dr"
  | "traffic"
  | "country"
  | "language"
  | "gpPrice"
  | "actions";

const defaultCols: Record<ColKey, boolean> = {
  dealStatus: true,
  niche: true,
  dr: true,
  traffic: true,
  country: true,
  language: true,
  gpPrice: true,
  actions: true,
};

function dealLabel(s: DealStatus) {
  return s === "DEAL_DONE" ? "Done" : "Pending";
}

function buildVendorListUrl(
  scope: string,
  page: number,
  searchUrl: string,
  f: VendorFilters,
  scopeAllowsDealFilter: boolean,
) {
  const qs = new URLSearchParams();
  qs.set("scope", scope);
  qs.set("page", String(page));
  qs.set("limit", String(PAGE_SIZE));
  if (searchUrl.trim()) qs.set("searchUrl", searchUrl.trim());
  if (f.nicheId) qs.set("nicheIds", f.nicheId);
  if (f.countryId) qs.set("countryIds", f.countryId);
  if (f.languageId) qs.set("languageId", f.languageId);
  appendRangeParams(qs, "traffic", f.traffic);
  appendRangeParams(qs, "dr", f.dr);
  appendRangeParams(qs, "gpPrice", f.gp);
  appendRangeParams(qs, "nePrice", f.ne);
  appendRangeParams(qs, "mozDa", f.mozDa);
  appendRangeParams(qs, "authorityScore", f.as);
  appendRangeParams(qs, "tatValue", f.tat);
  appendRangeParams(qs, "ref", f.ref);
  appendRangeParams(qs, "backlinks", f.backlinks);
  if (f.paymentTerms) qs.set("paymentTerms", f.paymentTerms);
  if (scopeAllowsDealFilter && f.dealStatus) qs.set("dealStatus", f.dealStatus);
  return `/vendors?${qs.toString()}`;
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function VendorTable({
  scope,
  title,
  showBulkPrice,
}: {
  scope: "all" | "deal_done" | "pending" | "trash";
  title: string;
  showBulkPrice?: boolean;
}) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { data: ref, isLoading: refLoading } = useReference();
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<{
    ids: string[];
    qty: number;
  } | null>(null);

  const scopeAllowsDealFilter = scope === "all";
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [draft, setDraft] = useState<VendorFilters>(emptyFilters);
  const [applied, setApplied] = useState<VendorFilters>(emptyFilters);

  const colStorageKey = `vendor-table-cols-${scope}`;
  const [cols, setCols] = useState<Record<ColKey, boolean>>(defaultCols);
  const [colsOpen, setColsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(colStorageKey);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
        setCols({ ...defaultCols, ...p });
      }
    } catch {
      /* ignore */
    }
  }, [colStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(colStorageKey, JSON.stringify(cols));
    } catch {
      /* ignore */
    }
  }, [cols, colStorageKey]);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const listUrl = useMemo(
    () => buildVendorListUrl(scope, page, searchUrl, applied, scopeAllowsDealFilter),
    [scope, page, searchUrl, applied, scopeAllowsDealFilter],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", scope, page, searchUrl, applied],
    queryFn: () =>
      apiFetch<{
        data: Row[];
        total: number;
        page: number;
        limit: number;
      }>(listUrl, token),
    enabled: !!token,
  });

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const openFilterPanel = useCallback(() => {
    setDraft(applied);
    setFilterOpen(true);
  }, [applied]);

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  const clearFilters = useCallback(() => {
    const z = emptyFilters();
    setDraft(z);
    setApplied(z);
    setPage(1);
  }, []);

  function toggleAll() {
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function deleteRow(id: string) {
    if (!token) return;
    await fetch(apiUrl(`/vendors/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  function scheduleDelete(id: string) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete(id);
    deleteTimerRef.current = setTimeout(() => {
      void deleteRow(id);
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 5000);
  }

  function cancelDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setPendingDelete(null);
  }

  async function bulkPrice(payload: {
    percent: number;
    guestPost: boolean;
    nicheEdit: boolean;
  }) {
    if (!token) return;
    if (!payload.guestPost && !payload.nicheEdit) {
      alert("Select Guest post and/or Niche edit.");
      return;
    }
    const res = await fetch(apiUrl("/vendors/bulk-price"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        percent: payload.percent,
        guestPost: payload.guestPost,
        nicheEdit: payload.nicheEdit,
      }),
    });
    const errText = await res.text();
    if (!res.ok) {
      try {
        const j = JSON.parse(errText) as { message?: unknown };
        const msg = j.message;
        alert(
          typeof msg === "string"
            ? msg
            : Array.isArray(msg)
              ? msg.join(", ")
              : errText || "Bulk price update failed",
        );
      } catch {
        alert(errText || "Bulk price update failed");
      }
      return;
    }
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function runPermanentDelete(ids: string[]) {
    if (!token) return;
    for (const id of ids) {
      await fetch(apiUrl(`/vendors/${id}/permanent`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setSelected(new Set());
    setConfirmPermanent(null);
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function onImportCsv(file: File | null) {
    setImportMsg(null);
    if (!file || !token) return;
    const text = await file.text();
    const res = await fetch(apiUrl("/import-export/vendors/csv"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csv: text }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      imported?: number;
      errors?: string[];
    };
    if (!res.ok) {
      const err = j.message;
      const textErr = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(textErr || "Import failed.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} vendor(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function onImportFromSheet() {
    setImportMsg(null);
    if (!token || !sheetUrl.trim()) return;
    const res = await fetch(apiUrl("/import-export/vendors/from-sheet"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: sheetUrl.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      imported?: number;
      errors?: string[];
    };
    if (!res.ok) {
      const err = j.message;
      const textErr = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(textErr || "Could not fetch sheet.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} vendor(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  const exportIds = useMemo(() => {
    if (selected.size > 0) return [...selected];
    return rows.map((r) => r.id);
  }, [selected, rows]);

  async function downloadExport(
    format: "csv" | "xlsx",
    chunk?: ExportChunk,
  ) {
    if (!token) return;
    if (selected.size === 0 && !chunk && exportIds.length === 0) return;
    setExportBusy(true);
    try {
      const body: Record<string, unknown> = { format };
      if (selected.size > 0) {
        body.ids = [...selected];
      } else if (chunk) {
        body.limit = chunk.limit;
        body.offset = chunk.offset ?? 0;
      } else {
        body.ids = exportIds;
      }
      const res = await fetch(apiUrl("/import-export/vendors/export"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert((await res.text()) || "Export failed");
        return;
      }
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition");
      let filename = format === "xlsx" ? "vendors.xlsx" : "vendors.csv";
      const m = dispo?.match(/filename="?([^";]+)"?/i);
      if (m?.[1]) filename = m[1];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  }

  function exportPdf() {
    if (rows.length === 0) {
      alert("No rows to export.");
      return;
    }
    const ids = exportIds;
    const toPrint = rows.filter((r) => ids.includes(r.id));
    const head: string[] = [];
    head.push("Site URL");
    if (cols.niche) head.push("Niche");
    if (cols.country) head.push("Country");
    if (cols.language) head.push("Language");
    if (cols.traffic) head.push("Traffic");
    if (cols.dr) head.push("DR");
    if (cols.dealStatus) head.push("Deal status");
    if (cols.gpPrice) head.push("Price");
    const trs = toPrint
      .map((r) => {
        const price =
          typeof r.guestPostPrice === "object"
            ? r.guestPostPrice.toString()
            : r.guestPostPrice;
        const cells: string[] = [];
        cells.push(r.siteUrl);
        if (cols.niche)
          cells.push(nicheFirstWord(r.niches[0]?.niche.label));
        if (cols.country) cells.push(countriesShortList(r.countries));
        if (cols.language) cells.push(r.language.name);
        if (cols.traffic) cells.push(String(r.traffic));
        if (cols.dr) cells.push(String(r.dr));
        if (cols.dealStatus) cells.push(dealLabel(r.dealStatus));
        if (cols.gpPrice) cells.push(`${r.currency.symbol}${price}`);
        return `<tr>${cells.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Vendors</title>
<style>body{font-family:system-ui,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f1f5f9}</style></head><body>
<table><thead><tr>${head.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  const hasActiveFilters = useMemo(() => {
    const z = emptyFilters();
    return JSON.stringify(applied) !== JSON.stringify(z);
  }, [applied]);

  const colLabels: { key: ColKey; label: string }[] = [
    { key: "niche", label: "Niche" },
    { key: "country", label: "Country" },
    { key: "language", label: "Language" },
    { key: "traffic", label: "Traffic" },
    { key: "dr", label: "DR" },
    { key: "dealStatus", label: "Deal status" },
    { key: "gpPrice", label: "Price" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <div className="-mx-1 max-w-none px-1 md:-mx-2 md:px-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {showBulkPrice && <BulkPriceButton onApply={(p) => void bulkPrice(p)} />}
      </div>

      <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>
          <span className="text-[11px] font-medium">
            {from}–{to} of {total}
          </span>
          {selected.size > 0 ? ` — ${selected.size} selected` : ""}
          {!selected.size && rows.length > 0 ? (
            <span className="text-slate-500"> — exporting current page rows</span>
          ) : null}
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200">
                Search URL
              </span>
              <input
                className="min-w-0 w-full rounded border border-slate-300 px-2 py-1 text-sm sm:w-56 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={searchUrl}
                onChange={(e) => {
                  setPage(1);
                  setSearchUrl(e.target.value);
                }}
                placeholder="Search URL…"
              />
            </label>

            <button
              type="button"
              className={cn("btn-filter", filterOpen && "btn-filter-active")}
              onClick={() => (filterOpen ? setFilterOpen(false) : openFilterPanel())}
            >
              <Filter className="h-4 w-4" />
              Filter
              {hasActiveFilters ? (
                <span className="rounded-full bg-white/25 px-1.5 text-[10px] text-white">
                  on
                </span>
              ) : null}
            </button>

            {hasActiveFilters ? (
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  clearFilters();
                  setFilterOpen(false);
                }}
              >
                Clear filter
              </button>
            ) : null}

            {scope !== "trash" && (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    setImportMsg(null);
                    setImportOpen(true);
                  }}
                >
                  <FileUp className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  Import
                </button>

                <ExportFormatMenu
                  total={total}
                  selectionCount={selected.size}
                  disabled={exportBusy || rows.length === 0}
                  busy={exportBusy}
                  showPdf
                  onExportCsv={(c) => void downloadExport("csv", c)}
                  onExportExcel={(c) => void downloadExport("xlsx", c)}
                  onExportPdf={() => exportPdf()}
                />
              </>
            )}

            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => setColsOpen((o) => !o)}
              >
                <LayoutGrid className="h-4 w-4" />
                Columns
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {colsOpen && (
                <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900">
                  <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    Show columns
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                    {colLabels.map(({ key, label }) => (
                      <li key={key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={cols[key]}
                            onChange={() =>
                              setCols((c) => ({ ...c, [key]: !c[key] }))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-2 w-full rounded border border-slate-200 py-1 text-xs dark:border-slate-600"
                    onClick={() => setColsOpen(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>

            {scope !== "trash" ? (
              <div className="ml-auto flex shrink-0">
                <Link href="/vendors/new" className="btn-toolbar-primary">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add new vendor
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {filterOpen && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/50">
            {refLoading || !ref ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Loading filter options…
              </p>
            ) : (
              <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Niche
                </span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={draft.nicheId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, nicheId: e.target.value }))
                  }
                >
                  <option value="">Any</option>
                  {ref.niches.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Country
                </span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={draft.countryId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, countryId: e.target.value }))
                  }
                >
                  <option value="">Any</option>
                  {ref.countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Language
                </span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={draft.languageId}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, languageId: e.target.value }))
                  }
                >
                  <option value="">Any</option>
                  {ref.languages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Traffic (min – max)
                </span>
                <input
                  type="text"
                  placeholder="e.g. 1000 - 50000"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={draft.traffic}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, traffic: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  DR (min – max)
                </span>
                <input
                  type="text"
                  placeholder="e.g. 20 - 70"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={draft.dr}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dr: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  Guest post resell (min – max)
                </span>
                <input
                  type="text"
                  placeholder="e.g. 50 - 200"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={draft.gp}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, gp: e.target.value }))
                  }
                />
              </label>
            </div>

            {moreFilters && (
              <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Niche edit resell (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.ne}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, ne: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Moz DA (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.mozDa}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, mozDa: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Authority score (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.as}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, as: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    TAT value (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.tat}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, tat: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Ref. domains (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.ref}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, ref: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Backlinks (min – max)
                  </span>
                  <input
                    type="text"
                    placeholder="min - max"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={draft.backlinks}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, backlinks: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Payment terms
                  </span>
                  <select
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={draft.paymentTerms}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        paymentTerms: e.target.value as VendorFilters["paymentTerms"],
                      }))
                    }
                  >
                    <option value="">Any</option>
                    <option value="ADVANCE">Advance</option>
                    <option value="AFTER_LIVE_LINK">After live link</option>
                  </select>
                </label>
                {scopeAllowsDealFilter ? (
                  <label className="block text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      Deal status
                    </span>
                    <select
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={draft.dealStatus}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          dealStatus: e.target.value as VendorFilters["dealStatus"],
                        }))
                      }
                    >
                      <option value="">Any</option>
                      <option value="DEAL_DONE">Done</option>
                      <option value="PENDING">Pending</option>
                    </select>
                  </label>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-brand-gradient px-4 py-1.5 text-sm font-semibold text-white dark:ring-1 dark:ring-cyan-500/30"
                onClick={() => {
                  applyFilters();
                  setFilterOpen(false);
                }}
              >
                Apply filters
              </button>
              <button
                type="button"
                className="text-sm text-brand-700 underline dark:text-cyan-400"
                onClick={() => setMoreFilters((m) => !m)}
              >
                {moreFilters ? "Fewer filters" : "More filters"}
              </button>
            </div>
              </>
            )}
          </div>
        )}
      </div>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import vendors"
        subtitle="CSV file or a public Google Sheet link"
        token={token}
        sheetUrl={sheetUrl}
        onSheetUrlChange={setSheetUrl}
        importMsg={importMsg}
        onPickCsv={(f) => void onImportCsv(f)}
        onImportFromSheet={() => void onImportFromSheet()}
      />

      {scope === "trash" && selected.size > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            onClick={() =>
              setConfirmPermanent({ ids: [...selected], qty: selected.size })
            }
          >
            Delete selected permanently
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>Vendor will be moved to trash in a few seconds…</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={cancelDelete}
          >
            Undo
          </button>
        </div>
      )}

      {isLoading && <p className="mt-4">Loading…</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={
                    allIds.length > 0 && selected.size === allIds.length
                  }
                  onChange={toggleAll}
                />
              </th>
              <th className="p-2">Site URL</th>
              {cols.niche ? <th className="p-2">Niche</th> : null}
              {cols.country ? <th className="p-2">Country</th> : null}
              {cols.language ? <th className="p-2">Language</th> : null}
              {cols.traffic ? <th className="p-2">Traffic</th> : null}
              {cols.dr ? <th className="p-2">DR</th> : null}
              {cols.dealStatus ? (
                <th className="p-2 text-xs font-semibold uppercase tracking-wide">
                  Deal status
                </th>
              ) : null}
              {cols.gpPrice ? <th className="p-2">Price</th> : null}
              {cols.actions ? <th className="p-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const price =
                typeof r.guestPostPrice === "object"
                  ? r.guestPostPrice.toString()
                  : r.guestPostPrice;
              const badge = r.completedOrderCount ?? 0;
              const badgeClass =
                badge >= 10 ? "text-green-600" : "text-red-600";
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 dark:border-slate-700"
                >
                  <td className="p-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => {
                        const n = new Set(selected);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        setSelected(n);
                      }}
                    />
                  </td>
                  <td className="p-2 align-top text-sm font-medium text-sky-700 dark:text-sky-400">
                    <span className="mr-1.5 inline-flex min-w-[1rem] justify-center rounded bg-slate-100 px-0.5 text-[10px] font-bold leading-tight dark:bg-slate-800">
                      <span className={badgeClass}>{badge}</span>
                    </span>
                    {r.siteUrl}
                  </td>
                  {cols.niche ? (
                    <td
                      className="max-w-[8rem] truncate p-2 align-top text-xs text-slate-700 dark:text-slate-300"
                      title={r.niches.map((n) => n.niche.label).join(", ")}
                    >
                      {nicheFirstWord(r.niches[0]?.niche.label)}
                    </td>
                  ) : null}
                  {cols.country ? (
                    <td
                      className="max-w-[7rem] truncate p-2 align-top text-xs text-slate-700 dark:text-slate-300"
                      title={r.countries
                        .map((c) => c.country.name)
                        .join(", ")}
                    >
                      {countriesShortList(r.countries)}
                    </td>
                  ) : null}
                  {cols.language ? (
                    <td className="max-w-[7rem] truncate p-2 align-top text-xs text-slate-700 dark:text-slate-300">
                      {r.language.name}
                    </td>
                  ) : null}
                  {cols.traffic ? (
                    <td className="p-2 align-top text-xs tabular-nums text-slate-700 dark:text-slate-300">
                      {r.traffic}
                    </td>
                  ) : null}
                  {cols.dr ? (
                    <td className="p-2 align-top text-xs tabular-nums text-slate-700 dark:text-slate-300">
                      {r.dr}
                    </td>
                  ) : null}
                  {cols.dealStatus ? (
                    <td className="p-2 align-middle">
                      <StatusPill
                        variant={r.dealStatus === "DEAL_DONE" ? "done" : "pending"}
                      >
                        {dealLabel(r.dealStatus)}
                      </StatusPill>
                    </td>
                  ) : null}
                  {cols.gpPrice ? (
                    <td className="p-2 align-top text-xs tabular-nums text-slate-700 dark:text-slate-300">
                      {r.currency.symbol}
                      {price}
                    </td>
                  ) : null}
                  {cols.actions ? (
                    <td className="whitespace-nowrap p-2 align-top text-xs">
                      <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/vendors/${r.id}`}
                          className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                          View
                        </Link>
                        {scope !== "trash" ? (
                          <>
                            <Link
                              href={`/vendors/${r.id}/edit`}
                              className="text-sky-600 hover:underline dark:text-sky-400"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => scheduleDelete(r.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="text-sky-600 hover:underline dark:text-sky-400"
                              onClick={async () => {
                                await fetch(
                                  apiUrl(`/vendors/${r.id}/restore`),
                                  {
                                    method: "POST",
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  },
                                );
                                void qc.invalidateQueries({
                                  queryKey: ["vendors"],
                                });
                              }}
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() =>
                                setConfirmPermanent({ ids: [r.id], qty: 1 })
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={setPage}
      />

      {confirmPermanent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
            <p className="text-sm text-slate-800 dark:text-slate-200">
              The app is permanently deleting {confirmPermanent.qty} site
              {confirmPermanent.qty === 1 ? "" : "s"}. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => setConfirmPermanent(null)}
              >
                No
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => void runPermanentDelete(confirmPermanent.ids)}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type BulkPricePayload = {
  percent: number;
  guestPost: boolean;
  nicheEdit: boolean;
};

function BulkPriceButton({
  onApply,
}: {
  onApply: (payload: BulkPricePayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [priceTarget, setPriceTarget] = useState<"guest_post" | "niche_edit" | "both">(
    "both",
  );
  const [pct, setPct] = useState("10");

  function apply() {
    const n = Math.min(100, Math.max(0, Number(pct) || 0));
    const signed = direction === "increase" ? n : -n;
    const guestPost = priceTarget === "guest_post" || priceTarget === "both";
    const nicheEdit = priceTarget === "niche_edit" || priceTarget === "both";
    onApply({ percent: signed, guestPost, nicheEdit });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-800"
        onClick={() => setOpen(true)}
      >
        Bulk price
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 dark:bg-black/60">
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-price-title"
          >
            <h2
              id="bulk-price-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Bulk resell price change
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Applies to every <strong>deal done</strong> vendor. Adjusts stored guest post / niche edit{" "}
              <strong>resell</strong> prices only.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Direction</p>
                <div className="mt-1.5 flex flex-wrap gap-3 text-sm text-slate-800 dark:text-slate-200">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-dir"
                      checked={direction === "increase"}
                      onChange={() => setDirection("increase")}
                    />
                    Increase
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-dir"
                      checked={direction === "decrease"}
                      onChange={() => setDirection("decrease")}
                    />
                    Decrease
                  </label>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Apply to</p>
                <div className="mt-1.5 flex flex-col gap-2 text-sm text-slate-800 dark:text-slate-200">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-target"
                      checked={priceTarget === "guest_post"}
                      onChange={() => setPriceTarget("guest_post")}
                    />
                    Guest post resell
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-target"
                      checked={priceTarget === "niche_edit"}
                      onChange={() => setPriceTarget("niche_edit")}
                    />
                    Niche edit resell
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="bulk-target"
                      checked={priceTarget === "both"}
                      onChange={() => setPriceTarget("both")}
                    />
                    Both
                  </label>
                </div>
              </div>

              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Percentage (0–100)
                </span>
                <input
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-save-primary-sm" onClick={() => apply()}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
