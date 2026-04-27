"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileUp,
  Filter,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch, apiUrl } from "@/lib/api";
import { ExportFormatMenu, type ExportChunk } from "@/components/export-format-menu";
import { TablePagination } from "@/components/table-pagination";
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";
import { useReference } from "@/hooks/use-reference";
import { appendRangeParams } from "@/lib/range-query";
import {
  DealStatusTablePill,
  DrTableMeter,
  NicheTablePill,
} from "@/components/table-status-badges";
import { cn } from "@/lib/utils";
import { countriesShortList, nicheFirstWord } from "@/lib/vendor-table-display";
import { CountryFlagsCell } from "@/components/country-flags-cell";
import { DataTableRowMenu, type RowMenuItem } from "@/components/data-table-row-menu";
import { TrafficSparkline } from "@/components/traffic-sparkline";

const DEFAULT_LIST_LIMIT = 20;

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

type VendorListPayload = {
  data: Row[];
  total: number;
  page: number;
  limit: number;
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

const VENDOR_EXTRA_ORDER: { key: keyof VendorFilters; label: string }[] = [
  { key: "ne", label: "Niche edit resell (min – max)" },
  { key: "mozDa", label: "Moz DA (min – max)" },
  { key: "as", label: "Authority score (min – max)" },
  { key: "tat", label: "TAT value (min – max)" },
  { key: "ref", label: "Ref. domains (min – max)" },
  { key: "backlinks", label: "Backlinks (min – max)" },
  { key: "paymentTerms", label: "Payment terms" },
  { key: "dealStatus", label: "Deal status" },
];

const VENDOR_BASE_FILTER_KEYS: { key: keyof VendorFilters; label: string }[] = [
  { key: "nicheId", label: "Niche" },
  { key: "countryId", label: "Country" },
  { key: "languageId", label: "Language" },
  { key: "traffic", label: "Traffic (min – max)" },
  { key: "dr", label: "DR (min – max)" },
  { key: "gp", label: "Guest post resell (min – max)" },
];

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

type DashboardVendorCounts = {
  totalVendors: number;
  dealDoneVendors: number;
  pendingDeals: number;
};

function buildVendorListUrl(
  scope: string,
  page: number,
  searchUrl: string,
  f: VendorFilters,
  scopeAllowsDealFilter: boolean,
  listLimit: number,
) {
  const qs = new URLSearchParams();
  qs.set("scope", scope);
  qs.set("page", String(page));
  qs.set("limit", String(listLimit));
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
  const { showAlert, showConfirm } = useAppDialog();
  const { data: ref, isLoading: refLoading } = useReference();
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const listLimit = DEFAULT_LIST_LIMIT;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const undoBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoTrashBanner, setUndoTrashBanner] = useState<{ id: string } | null>(null);
  const scopeAllowsDealFilter = scope === "all";
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeVendorExtras, setActiveVendorExtras] = useState<Set<string>>(() => new Set());
  const [activeVendorBaseFilters, setActiveVendorBaseFilters] = useState<Set<string>>(
    () => new Set(VENDOR_BASE_FILTER_KEYS.map((x) => String(x.key))),
  );
  const [extraPickerOpen, setExtraPickerOpen] = useState(false);
  const [draft, setDraft] = useState<VendorFilters>(emptyFilters);
  const [applied, setApplied] = useState<VendorFilters>(emptyFilters);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);

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
    () => buildVendorListUrl(scope, page, searchUrl, applied, scopeAllowsDealFilter, listLimit),
    [scope, page, searchUrl, applied, scopeAllowsDealFilter, listLimit],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", scope, page, listLimit, searchUrl, applied],
    queryFn: () =>
      apiFetch<{
        data: Row[];
        total: number;
        page: number;
        limit: number;
      }>(listUrl, token),
    enabled: !!token,
  });

  const { data: dashStats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: () => apiFetch<DashboardVendorCounts>("/stats/dashboard", token),
    enabled: !!token && scope !== "trash",
  });

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const limit = data?.limit ?? listLimit;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const openFilterPanel = useCallback(() => {
    setDraft(applied);
    setExtraPickerOpen(false);
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
    setActiveVendorExtras(new Set());
    setActiveVendorBaseFilters(new Set(VENDOR_BASE_FILTER_KEYS.map((x) => String(x.key))));
    setExtraPickerOpen(false);
    setPage(1);
  }, []);

  function addVendorExtra(key: keyof VendorFilters) {
    setActiveVendorExtras((prev) => new Set(prev).add(String(key)));
    setExtraPickerOpen(false);
  }

  function removeVendorExtra(key: keyof VendorFilters) {
    setActiveVendorExtras((prev) => {
      const n = new Set(prev);
      n.delete(String(key));
      return n;
    });
    const blank = emptyFilters();
    setDraft((d) => ({ ...d, [key]: blank[key] }));
  }

  function removeVendorBaseFilter(key: keyof VendorFilters) {
    setActiveVendorBaseFilters((prev) => {
      const n = new Set(prev);
      n.delete(String(key));
      return n;
    });
    const blank = emptyFilters();
    setDraft((d) => ({ ...d, [key]: blank[key] }));
  }

  function addVendorBaseFilter(key: keyof VendorFilters) {
    setActiveVendorBaseFilters((prev) => new Set(prev).add(String(key)));
    setExtraPickerOpen(false);
  }

  function vendorBaseFieldFilled(key: keyof VendorFilters): boolean {
    const v = draft[key];
    return typeof v === "string" && v.trim() !== "";
  }

  function vendorExtraFieldFilled(key: keyof VendorFilters): boolean {
    const v = draft[key];
    if (key === "paymentTerms" || key === "dealStatus") return v !== "";
    return typeof v === "string" && v.trim() !== "";
  }

  function toggleAll() {
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function confirmSoftDeleteVendor(id: string) {
    if (!(await showConfirm("Move this vendor to trash?"))) return;
    if (!token) return;
    const snapshots = qc.getQueriesData<VendorListPayload>({ queryKey: ["vendors"] });
    qc.setQueriesData<VendorListPayload>({ queryKey: ["vendors"] }, (old) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.filter((r) => r.id !== id),
        total: Math.max(0, old.total - 1),
      };
    });
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    const res = await fetch(apiUrl(`/vendors/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      void showAlert((await res.text()) || "Could not move vendor to trash.");
      return;
    }
    setUndoTrashBanner({ id });
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoTrashBanner(null), 20000);
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function confirmSoftDeleteSelectedVendors(ids: string[]) {
    if (!ids.length) return;
    if (!(await showConfirm(`Delete ${ids.length} selected row(s)?`))) return;
    if (!token) return;

    const snapshots = qc.getQueriesData<VendorListPayload>({ queryKey: ["vendors"] });
    qc.setQueriesData<VendorListPayload>({ queryKey: ["vendors"] }, (old) => {
      if (!old) return old;
      const prevLen = old.data.length;
      const next = old.data.filter((r) => !ids.includes(r.id));
      const removed = prevLen - next.length;
      if (!removed) return old;
      return { ...old, data: next, total: Math.max(0, old.total - removed) };
    });
    setSelected(new Set());

    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(apiUrl(`/vendors/${id}`), {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ),
    );
    const failed = results.filter((r) => r.status !== "fulfilled" || !r.value.ok);
    if (failed.length) {
      snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      void showAlert(`Could not delete ${failed.length} row(s). Please try again.`);
    }
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function restoreVendorFromUndo() {
    if (!undoTrashBanner || !token) return;
    const res = await fetch(apiUrl(`/vendors/${undoTrashBanner.id}/restore`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      void showAlert((await res.text()) || "Could not restore vendor.");
      return;
    }
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    setUndoTrashBanner(null);
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function restoreSelectedVendors(ids: string[]) {
    if (!ids.length) return;
    if (!token) return;
    if (!(await showConfirm(`Restore ${ids.length} site(s)?`))) return;
    for (const id of ids) {
      await fetch(apiUrl(`/vendors/${id}/restore`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function bulkPrice(payload: {
    percent: number;
    guestPost: boolean;
    nicheEdit: boolean;
  }) {
    if (!token) return;
    if (!payload.guestPost && !payload.nicheEdit) {
      void showAlert("Select Guest post and/or Niche edit.");
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
        void showAlert(
          typeof msg === "string"
            ? msg
            : Array.isArray(msg)
              ? msg.join(", ")
              : errText || "Bulk price update failed",
        );
      } catch {
        void showAlert(errText || "Bulk price update failed");
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
        void showAlert((await res.text()) || "Export failed");
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
      void showAlert("No rows to export.");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showBulkPrice ? <BulkPriceButton onApply={(p) => void bulkPrice(p)} /> : null}
          {scope !== "trash" ? (
            <>
              {selected.size > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                  onClick={() => void confirmSoftDeleteSelectedVendors(Array.from(selected))}
                >
                  Delete selected rows
                </button>
              ) : null}
              <button
                type="button"
                className="btn-toolbar-outline"
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
              <Link href="/vendors/new" className="btn-toolbar-primary">
                <Plus className="h-4 w-4" aria-hidden />
                Add vendor
              </Link>
            </>
          ) : selected.size > 0 ? (
            <>
              <button
                type="button"
                className="btn-toolbar-outline"
                onClick={() => void restoreSelectedVendors(Array.from(selected))}
              >
                Restore selected
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                onClick={() => {
                  const ids = [...selected];
                  void (async () => {
                    if (!ids.length) return;
                    if (!(await showConfirm(`Permanently delete ${ids.length} site(s)? This cannot be undone.`))) return;
                    await runPermanentDelete(ids);
                  })();
                }}
              >
                Delete selected
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>
          <span className="text-[11px] font-medium">
            {from} - {to} of {total}
          </span>
          {selected.size > 0 ? ` — ${selected.size} selected` : ""}
          {!selected.size && rows.length > 0 ? (
            <span className="text-slate-500"> — exporting current page rows</span>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="table-toolbar-search self-start sm:self-center"
            value={searchUrl}
            onChange={(e) => {
              setPage(1);
              setSearchUrl(e.target.value);
            }}
            placeholder="Search URL, niche, country…"
            aria-label="Search"
          />
          <div className="flex flex-wrap items-center gap-2">
            {scope !== "trash" ? (
              <>
                {statsLoading || !dashStats ? (
                  <span className="text-[11px] text-slate-400">Loading lists…</span>
                ) : (
                  <>
                    <div className="relative">
                      <button
                        type="button"
                        className={cn("scope-pill", (scope === "all" || scope === "deal_done" || scope === "pending") && "scope-pill-active")}
                        onClick={() => setScopeMenuOpen((o) => !o)}
                      >
                        All ({dashStats.totalVendors})
                        <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-80" />
                      </button>
                      {scopeMenuOpen ? (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-40 cursor-default"
                            aria-label="Close menu"
                            onClick={() => setScopeMenuOpen(false)}
                          />
                          <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-950">
                            <Link className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60", scope === "all" && "font-semibold text-violet-700 dark:text-violet-300")} href="/vendors" onClick={() => setScopeMenuOpen(false)}>
                              All ({dashStats.totalVendors})
                            </Link>
                            <Link className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60", scope === "deal_done" && "font-semibold text-violet-700 dark:text-violet-300")} href="/vendors/deal-done" onClick={() => setScopeMenuOpen(false)}>
                              Deal done ({dashStats.dealDoneVendors})
                            </Link>
                            <Link className={cn("block rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/60", scope === "pending" && "font-semibold text-violet-700 dark:text-violet-300")} href="/vendors/pending" onClick={() => setScopeMenuOpen(false)}>
                              Pending deals ({dashStats.pendingDeals})
                            </Link>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            ) : null}

          <button
            type="button"
            className={cn("btn-filter h-8 py-1", filterOpen && "btn-filter-active")}
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
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                clearFilters();
                setFilterOpen(false);
              }}
            >
              Clear filter
            </button>
          ) : null}

          <div className="relative">
            <button
              type="button"
              className="btn-toolbar-outline"
              onClick={() => setColsOpen((o) => !o)}
            >
              <LayoutGrid className="h-4 w-4" />
              Columns
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
            {colsOpen && (
              <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
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
          </div>
        </div>

        {filterOpen && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/55">
            {refLoading || !ref ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Loading filter options…
              </p>
            ) : (
              <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VENDOR_BASE_FILTER_KEYS.filter(({ key }) => activeVendorBaseFilters.has(String(key))).map(
                ({ key, label }) => (
                  <div
                    key={key}
                    className="group relative rounded-lg border border-slate-200/90 bg-white/70 p-2 pr-8 dark:border-slate-600 dark:bg-slate-900/40"
                  >
                    <button
                      type="button"
                      title="Remove filter"
                      className={cn(
                        "absolute right-1 top-1 rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                        vendorBaseFieldFilled(key)
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                      onClick={() => removeVendorBaseFilter(key)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {key === "nicheId" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <select
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          value={draft.nicheId}
                          onChange={(e) => setDraft((d) => ({ ...d, nicheId: e.target.value }))}
                        >
                          <option value="">Any</option>
                          {ref.niches.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {key === "countryId" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <select
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          value={draft.countryId}
                          onChange={(e) => setDraft((d) => ({ ...d, countryId: e.target.value }))}
                        >
                          <option value="">Any</option>
                          {ref.countries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {key === "languageId" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <select
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          value={draft.languageId}
                          onChange={(e) => setDraft((d) => ({ ...d, languageId: e.target.value }))}
                        >
                          <option value="">Any</option>
                          {ref.languages.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {key === "traffic" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <input
                          type="text"
                          placeholder="e.g. 1000 - 50000"
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                          value={draft.traffic}
                          onChange={(e) => setDraft((d) => ({ ...d, traffic: e.target.value }))}
                        />
                      </label>
                    ) : null}
                    {key === "dr" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <input
                          type="text"
                          placeholder="e.g. 20 - 70"
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                          value={draft.dr}
                          onChange={(e) => setDraft((d) => ({ ...d, dr: e.target.value }))}
                        />
                      </label>
                    ) : null}
                    {key === "gp" ? (
                      <label className="block text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                        <input
                          type="text"
                          placeholder="e.g. 50 - 200"
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                          value={draft.gp}
                          onChange={(e) => setDraft((d) => ({ ...d, gp: e.target.value }))}
                        />
                      </label>
                    ) : null}
                  </div>
                ),
              )}
            </div>

            {VENDOR_EXTRA_ORDER.some(({ key }) => activeVendorExtras.has(String(key))) ? (
              <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                {VENDOR_EXTRA_ORDER.filter(({ key }) => activeVendorExtras.has(String(key)))
                  .filter(({ key }) => key !== "dealStatus" || scopeAllowsDealFilter)
                  .map(({ key, label }) => (
                      <div
                        key={key}
                        className="group relative rounded-lg border border-slate-200/90 bg-white/70 p-2 pr-8 dark:border-slate-600 dark:bg-slate-900/40"
                      >
                        <button
                          type="button"
                          className={cn(
                            "absolute right-1 top-1 rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                            vendorExtraFieldFilled(key)
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                          title="Remove filter"
                          onClick={() => removeVendorExtra(key)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {key === "ne" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.ne}
                              onChange={(e) => setDraft((d) => ({ ...d, ne: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "mozDa" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.mozDa}
                              onChange={(e) => setDraft((d) => ({ ...d, mozDa: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "as" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.as}
                              onChange={(e) => setDraft((d) => ({ ...d, as: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "tat" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.tat}
                              onChange={(e) => setDraft((d) => ({ ...d, tat: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "ref" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.ref}
                              onChange={(e) => setDraft((d) => ({ ...d, ref: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "backlinks" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              placeholder="min - max"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.backlinks}
                              onChange={(e) => setDraft((d) => ({ ...d, backlinks: e.target.value }))}
                            />
                          </label>
                        ) : null}
                        {key === "paymentTerms" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
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
                        ) : null}
                        {key === "dealStatus" && scopeAllowsDealFilter ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
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
                  ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                onClick={() => {
                  applyFilters();
                  setFilterOpen(false);
                  setExtraPickerOpen(false);
                }}
              >
                Apply filters
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="text-sm text-brand-700 underline dark:text-cyan-400"
                  onClick={() => setExtraPickerOpen((o) => !o)}
                >
                  More filters
                </button>
                {extraPickerOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-30 cursor-default"
                      aria-label="Close"
                      onClick={() => setExtraPickerOpen(false)}
                    />
                    <ul className="absolute left-0 top-full z-40 mt-1 max-h-56 min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
                      {VENDOR_BASE_FILTER_KEYS.filter(({ key }) => !activeVendorBaseFilters.has(String(key))).map(
                        ({ key, label }) => (
                          <li key={`base-${String(key)}`}>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                              onClick={() => addVendorBaseFilter(key)}
                            >
                              {label}
                            </button>
                          </li>
                        ),
                      )}
                      {VENDOR_EXTRA_ORDER.filter(({ key }) => !activeVendorExtras.has(String(key)))
                        .filter(({ key }) => key !== "dealStatus" || scopeAllowsDealFilter)
                        .map(({ key, label }) => (
                          <li key={String(key)}>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                              onClick={() => addVendorExtra(key)}
                            >
                              {label}
                            </button>
                          </li>
                        ))}
                      {VENDOR_BASE_FILTER_KEYS.filter(({ key }) => !activeVendorBaseFilters.has(String(key)))
                        .length === 0 &&
                      VENDOR_EXTRA_ORDER.filter(({ key }) => !activeVendorExtras.has(String(key))).filter(
                        ({ key }) => key !== "dealStatus" || scopeAllowsDealFilter,
                      ).length === 0 ? (
                        <li className="px-3 py-2 text-slate-500">All filters are shown</li>
                      ) : null}
                    </ul>
                  </>
                ) : null}
              </div>
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

      {/* Bulk trash actions are shown in the top toolbar when rows are selected. */}

      {undoTrashBanner ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>Vendor moved to trash.</span>
          <button type="button" className="font-medium underline" onClick={() => void restoreVendorFromUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {isLoading && <p className="mt-4">Loading…</p>}

      <div className="data-table-shell mt-4">
        <table className="min-w-full text-center text-[11px]">
          <thead className="data-table-thead">
            <tr>
              <th className="w-10 p-2.5 align-middle">
                <input
                  type="checkbox"
                  className="mx-auto block"
                  checked={
                    allIds.length > 0 && selected.size === allIds.length
                  }
                  onChange={toggleAll}
                />
              </th>
              <th className="w-10 p-2.5">#</th>
              <th className="min-w-[10rem] p-2.5">Site URL</th>
              {cols.niche ? <th className="p-2.5">Niche</th> : null}
              {cols.country ? <th className="p-2.5">Country</th> : null}
              {cols.language ? <th className="p-2.5">Language</th> : null}
              {cols.traffic ? <th className="p-2.5">Traffic</th> : null}
              {cols.dr ? <th className="p-2.5">DR</th> : null}
              {cols.dealStatus ? <th className="p-2.5">Deal status</th> : null}
              {cols.gpPrice ? <th className="p-2.5">Price</th> : null}
              {cols.actions ? <th className="p-2.5">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              const price =
                typeof r.guestPostPrice === "object"
                  ? r.guestPostPrice.toString()
                  : r.guestPostPrice;
              const badge = r.completedOrderCount ?? 0;
              const badgeClass =
                badge >= 10 ? "text-green-600" : "text-red-600";
              const rowNum = (page - 1) * limit + rowIdx + 1;
              const nicheWord = nicheFirstWord(r.niches[0]?.niche.label);
              return (
                <tr
                  key={r.id}
                  className="data-table-row"
                >
                  <td className="data-table-td">
                    <input
                      type="checkbox"
                      className="mx-auto block"
                      checked={selected.has(r.id)}
                      onChange={() => {
                        const n = new Set(selected);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        setSelected(n);
                      }}
                    />
                  </td>
                  <td className="data-table-td tabular-nums text-slate-500 dark:text-slate-400">
                    {rowNum}
                  </td>
                  <td className="data-table-td max-w-[14rem]">
                    <div className="mx-auto flex max-w-full min-w-0 items-center justify-center gap-1">
                      <span className="inline-flex min-w-[1.1rem] shrink-0 justify-center rounded bg-slate-100 px-0.5 text-[10px] font-bold leading-tight dark:bg-slate-800">
                        <span className={badgeClass}>{badge}</span>
                      </span>
                      <a
                        href={r.siteUrl.startsWith("http") ? r.siteUrl : `https://${r.siteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {r.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                      <a
                        href={r.siteUrl.startsWith("http") ? r.siteUrl : `https://${r.siteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                        aria-label="Open site"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  {cols.niche ? (
                    <td className="data-table-td max-w-[8rem]" title={r.niches.map((n) => n.niche.label).join(", ")}>
                      <NicheTablePill text={nicheWord} />
                    </td>
                  ) : null}
                  {cols.country ? (
                    <td className="data-table-td max-w-[10rem]" title={r.countries.map((c) => c.country.name).join(", ")}>
                      <CountryFlagsCell countries={r.countries} />
                    </td>
                  ) : null}
                  {cols.language ? (
                    <td className="data-table-td max-w-[7rem] truncate">{r.language.name}</td>
                  ) : null}
                  {cols.traffic ? (
                    <td className="data-table-td">
                      <div className="inline-flex min-w-0 items-center justify-center gap-1.5 tabular-nums">
                        <TrafficSparkline value={r.traffic} seed={r.id} />
                        <span>{r.traffic.toLocaleString()}</span>
                      </div>
                    </td>
                  ) : null}
                  {cols.dr ? (
                    <td className="data-table-td">
                      <DrTableMeter dr={r.dr} />
                    </td>
                  ) : null}
                  {cols.dealStatus ? (
                    <td className="data-table-td">
                      <DealStatusTablePill
                        variant={r.dealStatus === "DEAL_DONE" ? "done" : "pending"}
                      >
                        {dealLabel(r.dealStatus)}
                      </DealStatusTablePill>
                    </td>
                  ) : null}
                  {cols.gpPrice ? (
                    <td className="data-table-td tabular-nums">
                      {r.currency.symbol}
                      {price}
                    </td>
                  ) : null}
                  {cols.actions ? (
                    <td className="data-table-td whitespace-nowrap">
                      <DataTableRowMenu
                        items={
                          scope !== "trash"
                            ? ([
                                { key: "v", type: "link", label: "View", href: `/vendors/${r.id}` },
                                { key: "e", type: "link", label: "Edit", href: `/vendors/${r.id}/edit` },
                                {
                                  key: "d",
                                  type: "button",
                                  label: "Delete",
                                  danger: true,
                                  onClick: () => void confirmSoftDeleteVendor(r.id),
                                },
                              ] satisfies RowMenuItem[])
                            : ([
                                {
                                  key: "r",
                                  type: "button",
                                  label: "Restore",
                                  onClick: () => {
                                    void (async () => {
                                      await fetch(apiUrl(`/vendors/${r.id}/restore`), {
                                        method: "POST",
                                        headers: { Authorization: `Bearer ${token}` },
                                      });
                                      void qc.invalidateQueries({ queryKey: ["vendors"] });
                                    })();
                                  },
                                },
                                {
                                  key: "p",
                                  type: "button",
                                  label: "Delete permanently",
                                  danger: true,
                                  onClick: () =>
                                    void (async () => {
                                      if (!(await showConfirm("Permanently delete this vendor? This cannot be undone."))) return;
                                      await runPermanentDelete([r.id]);
                                    })(),
                                },
                              ] satisfies RowMenuItem[])
                        }
                      />
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
        limit={limit}
        onPageChange={setPage}
        showLimitSelect={false}
      />

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
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
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
