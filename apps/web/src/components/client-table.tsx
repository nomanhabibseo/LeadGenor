"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";
import { TablePagination } from "@/components/table-pagination";
import { useReference } from "@/hooks/use-reference";
import { appendRangeParams } from "@/lib/range-query";
import { cn } from "@/lib/utils";
import { nicheFirstWord } from "@/lib/vendor-table-display";
import { DrTableMeter, NicheTablePill } from "@/components/table-status-badges";
import { CountryFlagsCell } from "@/components/country-flags-cell";
import { DataTableRowMenu, type RowMenuItem } from "@/components/data-table-row-menu";
import { TrafficSparkline } from "@/components/traffic-sparkline";

const DEFAULT_LIST_LIMIT = 20;

type Row = {
  id: string;
  siteUrl: string;
  email: string;
  dr: number;
  traffic: number;
  language: { name: string };
  niches: { niche: { label: string } }[];
  countries: { country: { name: string; code: string } }[];
  completedOrderCount?: number;
};

type ClientListPayload = {
  data: Row[];
  total: number;
  page: number;
  limit: number;
};

type ClientFilters = {
  nicheId: string;
  countryId: string;
  languageId: string;
  traffic: string;
  dr: string;
  mozDa: string;
  as: string;
  ref: string;
  backlinks: string;
};

const CLIENT_EXTRA_ORDER: { key: keyof ClientFilters; label: string }[] = [
  { key: "mozDa", label: "Moz DA (min – max)" },
  { key: "as", label: "Authority score (min – max)" },
  { key: "ref", label: "Ref. domains (min – max)" },
  { key: "backlinks", label: "Backlinks (min – max)" },
];

const CLIENT_BASE_FILTER_KEYS: { key: keyof ClientFilters; label: string }[] = [
  { key: "nicheId", label: "Niche" },
  { key: "countryId", label: "Country" },
  { key: "languageId", label: "Language" },
  { key: "traffic", label: "Traffic (min – max)" },
  { key: "dr", label: "DR (min – max)" },
];

const emptyFilters = (): ClientFilters => ({
  nicheId: "",
  countryId: "",
  languageId: "",
  traffic: "",
  dr: "",
  mozDa: "",
  as: "",
  ref: "",
  backlinks: "",
});

function siteHref(u: string) {
  const t = u.trim();
  return t.startsWith("http") ? t : `https://${t}`;
}

function buildClientListUrl(
  scopeParam: string,
  page: number,
  searchUrl: string,
  f: ClientFilters,
  listLimit: number,
) {
  const qs = new URLSearchParams();
  qs.set("scope", scopeParam);
  qs.set("page", String(page));
  qs.set("limit", String(listLimit));
  if (searchUrl.trim()) qs.set("searchUrl", searchUrl.trim());
  if (f.nicheId) qs.set("nicheIds", f.nicheId);
  if (f.countryId) qs.set("countryIds", f.countryId);
  if (f.languageId) qs.set("languageId", f.languageId);
  appendRangeParams(qs, "traffic", f.traffic);
  appendRangeParams(qs, "dr", f.dr);
  appendRangeParams(qs, "mozDa", f.mozDa);
  appendRangeParams(qs, "authorityScore", f.as);
  appendRangeParams(qs, "referringDomains", f.ref);
  appendRangeParams(qs, "backlinks", f.backlinks);
  return `/clients?${qs.toString()}`;
}

export function ClientTable({
  scope,
  title,
}: {
  scope: "active" | "trash";
  title: string;
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

  const [filterOpen, setFilterOpen] = useState(false);
  const [activeClientExtras, setActiveClientExtras] = useState<Set<string>>(() => new Set());
  const [activeClientBaseFilters, setActiveClientBaseFilters] = useState<Set<string>>(
    () => new Set(CLIENT_BASE_FILTER_KEYS.map((x) => String(x.key))),
  );
  const [clientExtraPickerOpen, setClientExtraPickerOpen] = useState(false);
  const [draft, setDraft] = useState<ClientFilters>(emptyFilters);
  const [applied, setApplied] = useState<ClientFilters>(emptyFilters);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);

  const scopeParam = scope === "active" ? "active" : "trash";

  const listUrl = useMemo(
    () => buildClientListUrl(scopeParam, page, searchUrl, applied, listLimit),
    [scopeParam, page, searchUrl, applied, listLimit],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["clients", scopeParam, page, listLimit, searchUrl, applied],
    queryFn: () =>
      apiFetch<{ data: Row[]; total: number; page: number; limit: number }>(
        listUrl,
        token,
      ),
    enabled: !!token,
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
    setClientExtraPickerOpen(false);
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
    setActiveClientExtras(new Set());
    setActiveClientBaseFilters(new Set(CLIENT_BASE_FILTER_KEYS.map((x) => String(x.key))));
    setClientExtraPickerOpen(false);
    setPage(1);
  }, []);

  function addClientExtra(key: keyof ClientFilters) {
    setActiveClientExtras((prev) => new Set(prev).add(String(key)));
    setClientExtraPickerOpen(false);
  }

  function removeClientExtra(key: keyof ClientFilters) {
    setActiveClientExtras((prev) => {
      const n = new Set(prev);
      n.delete(String(key));
      return n;
    });
    const blank = emptyFilters();
    setDraft((d) => ({ ...d, [key]: blank[key] }));
  }

  function removeClientBaseFilter(key: keyof ClientFilters) {
    setActiveClientBaseFilters((prev) => {
      const n = new Set(prev);
      n.delete(String(key));
      return n;
    });
    const blank = emptyFilters();
    setDraft((d) => ({ ...d, [key]: blank[key] }));
  }

  function addClientBaseFilter(key: keyof ClientFilters) {
    setActiveClientBaseFilters((prev) => new Set(prev).add(String(key)));
    setClientExtraPickerOpen(false);
  }

  function clientBaseFieldFilled(key: keyof ClientFilters): boolean {
    const v = draft[key];
    return typeof v === "string" && v.trim() !== "";
  }

  function clientExtraFieldFilled(key: keyof ClientFilters): boolean {
    const v = draft[key];
    return typeof v === "string" && v.trim() !== "";
  }

  const hasActiveFilters = useMemo(() => {
    const z = emptyFilters();
    return JSON.stringify(applied) !== JSON.stringify(z);
  }, [applied]);

  function toggleAll() {
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function confirmSoftDeleteClient(id: string) {
    if (!(await showConfirm("Move this client to trash?"))) return;
    if (!token) return;
    const snapshots = qc.getQueriesData<ClientListPayload>({ queryKey: ["clients"] });
    qc.setQueriesData<ClientListPayload>({ queryKey: ["clients"] }, (old) => {
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
    const res = await fetch(apiUrl(`/clients/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      void showAlert((await res.text()) || "Delete failed.");
      return;
    }
    setUndoTrashBanner({ id });
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoTrashBanner(null), 20000);
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function restoreClientFromUndo() {
    if (!undoTrashBanner || !token) return;
    const res = await fetch(apiUrl(`/clients/${undoTrashBanner.id}/restore`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      void showAlert((await res.text()) || "Could not restore client.");
      return;
    }
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    setUndoTrashBanner(null);
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  const exportIds = useMemo(() => {
    if (selected.size > 0) return [...selected];
    return rows.map((r) => r.id);
  }, [selected, rows]);

  async function downloadExport(format: "csv" | "xlsx", chunk?: ExportChunk) {
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
      const res = await fetch(apiUrl("/import-export/clients/export"), {
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
      let filename = format === "xlsx" ? "clients.xlsx" : "clients.csv";
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

  async function onImportCsv(file: File | null) {
    setImportMsg(null);
    if (!file || !token) return;
    const text = await file.text();
    const res = await fetch(apiUrl("/import-export/clients/csv"), {
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
      const errText = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(errText || "Import failed.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} client(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function onImportFromSheet() {
    setImportMsg(null);
    if (!token || !sheetUrl.trim()) return;
    const res = await fetch(apiUrl("/import-export/clients/from-sheet"), {
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
      const errText = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(errText || "Could not fetch sheet.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} client(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function runPermanentDelete(ids: string[]) {
    if (!token) return;
    for (const id of ids) {
      await fetch(apiUrl(`/clients/${id}/permanent`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  return (
    <div className="-mx-1 max-w-none px-1 md:-mx-2 md:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {scope === "active" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              showPdf={false}
              onExportCsv={(c) => void downloadExport("csv", c)}
              onExportExcel={(c) => void downloadExport("xlsx", c)}
            />
            <Link href="/clients/new" className="btn-toolbar-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Add client
            </Link>
          </div>
        ) : null}
      </div>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import clients"
        subtitle="CSV file or a public Google Sheet link"
        token={token}
        sheetUrl={sheetUrl}
        onSheetUrlChange={setSheetUrl}
        importMsg={importMsg}
        onPickCsv={(f) => void onImportCsv(f)}
        onImportFromSheet={() => void onImportFromSheet()}
      />

      <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>
          <span className="text-[11px] font-medium">
            {from} - {to} of {total}
          </span>
          {selected.size > 0 ? ` — ${selected.size} selected` : ""}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="table-toolbar-search self-start sm:self-center"
            value={searchUrl}
            placeholder="Search URL, niche, country…"
            aria-label="Search"
            onChange={(e) => {
              setPage(1);
              setSearchUrl(e.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">

          <button
            type="button"
            className={cn("btn-filter h-8 py-1", filterOpen && "btn-filter-active")}
            onClick={() =>
              filterOpen ? setFilterOpen(false) : openFilterPanel()
            }
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
              <div className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Table columns are fixed in this view.
                </p>
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
                  {CLIENT_BASE_FILTER_KEYS.filter(({ key }) => activeClientBaseFilters.has(String(key))).map(
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
                            clientBaseFieldFilled(key)
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100",
                          )}
                          onClick={() => removeClientBaseFilter(key)}
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
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.traffic}
                              onChange={(e) => setDraft((d) => ({ ...d, traffic: e.target.value }))}
                              placeholder="min - max"
                            />
                          </label>
                        ) : null}
                        {key === "dr" ? (
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft.dr}
                              onChange={(e) => setDraft((d) => ({ ...d, dr: e.target.value }))}
                              placeholder="min - max"
                            />
                          </label>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>

                {CLIENT_EXTRA_ORDER.some(({ key }) => activeClientExtras.has(String(key))) ? (
                  <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                    {CLIENT_EXTRA_ORDER.filter(({ key }) => activeClientExtras.has(String(key))).map(
                      ({ key, label }) => (
                        <div
                          key={key}
                          className="group relative rounded-lg border border-slate-200/90 bg-white/70 p-2 pr-8 dark:border-slate-600 dark:bg-slate-900/40"
                        >
                          <button
                            type="button"
                            className={cn(
                              "absolute right-1 top-1 rounded p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100",
                              clientExtraFieldFilled(key)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100",
                            )}
                            title="Remove filter"
                            onClick={() => removeClientExtra(key)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <label className="block text-xs">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
                            <input
                              type="text"
                              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                              value={draft[key] as string}
                              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                              placeholder="min - max"
                            />
                          </label>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                    onClick={() => {
                      applyFilters();
                      setFilterOpen(false);
                      setClientExtraPickerOpen(false);
                    }}
                  >
                    Apply filters
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      className="text-sm text-brand-700 underline dark:text-cyan-400"
                      onClick={() => setClientExtraPickerOpen((o) => !o)}
                    >
                      More filters
                    </button>
                    {clientExtraPickerOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-30 cursor-default"
                          aria-label="Close"
                          onClick={() => setClientExtraPickerOpen(false)}
                        />
                        <ul className="absolute left-0 top-full z-40 mt-1 max-h-56 min-w-[12rem] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
                          {CLIENT_BASE_FILTER_KEYS.filter(({ key }) => !activeClientBaseFilters.has(String(key))).map(
                            ({ key, label }) => (
                              <li key={`base-${String(key)}`}>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                                  onClick={() => addClientBaseFilter(key)}
                                >
                                  {label}
                                </button>
                              </li>
                            ),
                          )}
                          {CLIENT_EXTRA_ORDER.filter(({ key }) => !activeClientExtras.has(String(key))).map(
                            ({ key, label }) => (
                              <li key={String(key)}>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
                                  onClick={() => addClientExtra(key)}
                                >
                                  {label}
                                </button>
                              </li>
                            ),
                          )}
                          {CLIENT_BASE_FILTER_KEYS.filter(({ key }) => !activeClientBaseFilters.has(String(key)))
                            .length === 0 &&
                          CLIENT_EXTRA_ORDER.filter(({ key }) => !activeClientExtras.has(String(key))).length ===
                            0 ? (
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

      {scope === "trash" && selected.size > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
            onClick={() => {
              const ids = [...selected];
              void (async () => {
                if (!ids.length) return;
                if (!(await showConfirm(`Permanently delete ${ids.length} site(s)? This cannot be undone.`)))
                  return;
                await runPermanentDelete(ids);
              })();
            }}
          >
            Delete selected permanently
          </button>
        </div>
      )}

      {undoTrashBanner && scope === "active" ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>Client moved to trash.</span>
          <button type="button" className="font-medium underline" onClick={() => void restoreClientFromUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {isLoading && <p className="mt-4">Loading…</p>}

      <div className="data-table-shell mt-4">
        <table className="min-w-full text-center text-[11px]">
          <thead className="data-table-thead">
            <tr>
              {scope === "active" && (
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
              )}
              {scope === "trash" && (
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
              )}
              <th className="w-10 p-2.5">#</th>
              <th className="min-w-[10rem] p-2.5">Site URL</th>
              <th className="p-2.5">Niche</th>
              <th className="p-2.5">Country</th>
              <th className="p-2.5">Language</th>
              <th className="p-2.5">Traffic</th>
              <th className="p-2.5">DR</th>
              <th className="p-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              const badge = r.completedOrderCount ?? 0;
              const cls =
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
                        <span className={cls}>{badge}</span>
                      </span>
                      <a
                        href={siteHref(r.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {r.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                      <a
                        href={siteHref(r.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                        aria-label="Open site"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td
                    className="data-table-td max-w-[8rem]"
                    title={r.niches.map((n) => n.niche.label).join(", ")}
                  >
                    <NicheTablePill text={nicheWord} />
                  </td>
                  <td className="data-table-td max-w-[10rem]" title={r.countries.map((c) => c.country.name).join(", ")}>
                    <CountryFlagsCell countries={r.countries} />
                  </td>
                  <td className="data-table-td max-w-[7rem] truncate">
                    {r.language.name}
                  </td>
                  <td className="data-table-td">
                    <div className="inline-flex min-w-0 items-center justify-center gap-1.5 tabular-nums">
                      <TrafficSparkline value={r.traffic} seed={r.id} />
                      <span>{r.traffic.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="data-table-td">
                    <DrTableMeter dr={r.dr} />
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    <DataTableRowMenu
                      items={
                        scope === "active"
                          ? ([
                              { key: "v", type: "link", label: "View", href: `/clients/${r.id}` },
                              { key: "e", type: "link", label: "Edit", href: `/clients/${r.id}/edit` },
                              {
                                key: "d",
                                type: "button",
                                label: "Delete",
                                danger: true,
                                onClick: () => void confirmSoftDeleteClient(r.id),
                              },
                            ] satisfies RowMenuItem[])
                          : ([
                              {
                                key: "r",
                                type: "button",
                                label: "Restore",
                                onClick: () => {
                                  void (async () => {
                                    await fetch(apiUrl(`/clients/${r.id}/restore`), {
                                      method: "POST",
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    void qc.invalidateQueries({ queryKey: ["clients"] });
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
                                    if (!(await showConfirm("Permanently delete this client? This cannot be undone."))) return;
                                    await runPermanentDelete([r.id]);
                                  })(),
                              },
                            ] satisfies RowMenuItem[])
                      }
                    />
                  </td>
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
