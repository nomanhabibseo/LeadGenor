"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, FileUp, Filter, LayoutGrid, Plus } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { ExportFormatMenu, type ExportChunk } from "@/components/export-format-menu";
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";
import { TablePagination } from "@/components/table-pagination";
import { useReference } from "@/hooks/use-reference";
import { appendRangeParams } from "@/lib/range-query";
import { cn } from "@/lib/utils";
import {
  countriesShortList,
  nicheFirstWord,
} from "@/lib/vendor-table-display";

const PAGE_SIZE = 100;

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

function buildClientListUrl(
  scopeParam: string,
  page: number,
  searchUrl: string,
  f: ClientFilters,
) {
  const qs = new URLSearchParams();
  qs.set("scope", scopeParam);
  qs.set("page", String(page));
  qs.set("limit", String(PAGE_SIZE));
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
  const { data: ref, isLoading: refLoading } = useReference();
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmPermanent, setConfirmPermanent] = useState<{
    ids: string[];
    qty: number;
  } | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [draft, setDraft] = useState<ClientFilters>(emptyFilters);
  const [applied, setApplied] = useState<ClientFilters>(emptyFilters);

  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);

  const scopeParam = scope === "active" ? "active" : "trash";

  const listUrl = useMemo(
    () => buildClientListUrl(scopeParam, page, searchUrl, applied),
    [scopeParam, page, searchUrl, applied],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["clients", scopeParam, page, searchUrl, applied],
    queryFn: () =>
      apiFetch<{ data: Row[]; total: number; page: number; limit: number }>(
        listUrl,
        token,
      ),
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

  const hasActiveFilters = useMemo(() => {
    const z = emptyFilters();
    return JSON.stringify(applied) !== JSON.stringify(z);
  }, [applied]);

  function toggleAll() {
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
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
        alert((await res.text()) || "Export failed");
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
    setConfirmPermanent(null);
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  return (
    <div className="-mx-1 max-w-none px-1 md:-mx-2 md:px-2">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>

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
            {from}–{to} of {total}
          </span>
          {selected.size > 0 ? ` — ${selected.size} selected` : ""}
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
                placeholder="Search URL…"
                onChange={(e) => {
                  setPage(1);
                  setSearchUrl(e.target.value);
                }}
              />
            </label>

            <button
              type="button"
              className={cn("btn-filter", filterOpen && "btn-filter-active")}
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
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  clearFilters();
                  setFilterOpen(false);
                }}
              >
                Clear filter
              </button>
            ) : null}

            {scope === "active" && (
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
                  showPdf={false}
                  onExportCsv={(c) => void downloadExport("csv", c)}
                  onExportExcel={(c) => void downloadExport("xlsx", c)}
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
                <div className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900">
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

            {scope === "active" ? (
              <div className="ml-auto flex shrink-0">
                <Link href="/clients/new" className="btn-toolbar-primary">
                  <Plus className="h-4 w-4" aria-hidden />
                  Add new client
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
                        setDraft((d) => ({
                          ...d,
                          languageId: e.target.value,
                        }))
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
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                      value={draft.traffic}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, traffic: e.target.value }))
                      }
                      placeholder="min - max"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      DR (min – max)
                    </span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                      value={draft.dr}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, dr: e.target.value }))
                      }
                      placeholder="min - max"
                    />
                  </label>
                </div>

                {moreFilters && (
                  <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Moz DA (min – max)
                      </span>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={draft.mozDa}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, mozDa: e.target.value }))
                        }
                        placeholder="min - max"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Authority score (min – max)
                      </span>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={draft.as}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, as: e.target.value }))
                        }
                        placeholder="min - max"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Ref. domains (min – max)
                      </span>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={draft.ref}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, ref: e.target.value }))
                        }
                        placeholder="min - max"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        Backlinks (min – max)
                      </span>
                      <input
                        type="text"
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={draft.backlinks}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            backlinks: e.target.value,
                          }))
                        }
                        placeholder="min - max"
                      />
                    </label>
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

      {isLoading && <p className="mt-4">Loading…</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
            <tr>
              {scope === "active" && (
                <th className="p-2">
                  <input
                    type="checkbox"
                    checked={
                      allIds.length > 0 && selected.size === allIds.length
                    }
                    onChange={toggleAll}
                  />
                </th>
              )}
              {scope === "trash" && (
                <th className="p-2">
                  <input
                    type="checkbox"
                    checked={
                      allIds.length > 0 && selected.size === allIds.length
                    }
                    onChange={toggleAll}
                  />
                </th>
              )}
              <th className="p-2">Site URL</th>
              <th className="p-2">Niche</th>
              <th className="p-2">Country</th>
              <th className="p-2">Language</th>
              <th className="p-2">Traffic</th>
              <th className="p-2">DR</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const badge = r.completedOrderCount ?? 0;
              const cls =
                badge >= 10 ? "text-green-600" : "text-red-600";
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 dark:border-slate-700"
                >
                  <td className="p-2">
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
                  <td className="p-2 text-sm font-medium text-sky-700 dark:text-sky-400">
                    <span
                      className={`mr-1.5 inline-flex min-w-[1rem] justify-center rounded bg-slate-100 px-0.5 text-[10px] font-bold leading-tight dark:bg-slate-800 ${cls}`}
                    >
                      {badge}
                    </span>
                    {r.siteUrl}
                  </td>
                  <td
                    className="max-w-[8rem] truncate p-2 text-xs text-slate-700 dark:text-slate-300"
                    title={r.niches.map((n) => n.niche.label).join(", ")}
                  >
                    {nicheFirstWord(r.niches[0]?.niche.label)}
                  </td>
                  <td
                    className="max-w-[7rem] truncate p-2 text-xs text-slate-700 dark:text-slate-300"
                    title={r.countries.map((c) => c.country.name).join(", ")}
                  >
                    {countriesShortList(r.countries)}
                  </td>
                  <td className="max-w-[7rem] truncate p-2 text-xs text-slate-700 dark:text-slate-300">
                    {r.language.name}
                  </td>
                  <td className="p-2 text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    {r.traffic}
                  </td>
                  <td className="p-2 text-xs tabular-nums text-slate-700 dark:text-slate-300">
                    {r.dr}
                  </td>
                  <td className="space-x-2 whitespace-nowrap p-2 text-xs">
                    <Link
                      href={`/clients/${r.id}`}
                      className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                      View
                    </Link>
                    {scope === "active" ? (
                      <>
                        <Link
                          href={`/clients/${r.id}/edit`}
                          className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={async () => {
                            await fetch(apiUrl(`/clients/${r.id}`), {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            void qc.invalidateQueries({ queryKey: ["clients"] });
                            void qc.invalidateQueries({ queryKey: ["stats"] });
                          }}
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
                            await fetch(apiUrl(`/clients/${r.id}/restore`), {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            void qc.invalidateQueries({ queryKey: ["clients"] });
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
