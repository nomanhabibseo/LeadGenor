"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, Download, ExternalLink, Upload } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { DrTableMeter, NicheTablePill } from "@/components/table-status-badges";
import { DataTableRowMenu, type RowMenuItem } from "@/components/data-table-row-menu";
import { TrafficSparkline } from "@/components/traffic-sparkline";
import { countryShortLabel, nicheFirstWord } from "@/lib/vendor-table-display";
import { findEmailsFromUrl, findEmailsFromUrls } from "@/lib/email-finder";

type Item = {
  id: string;
  siteUrl: string;
  companyName: string;
  contactName: string;
  contactKind: string;
  niche: string;
  country: string;
  traffic: number;
  dr: number;
  emails: unknown;
};

type VendorRow = { id: string; companyName: string; siteUrl: string };
type ClientRow = { id: string; companyName: string; siteUrl: string };

function ListCountryFlagsCell({ raw }: { raw: string }) {
  if (!raw?.trim()) return <span className="text-slate-400">—</span>;
  const first = raw.split(/[;,]+/).map((s) => s.trim()).filter(Boolean)[0] ?? "";
  const upper = first.toUpperCase();
  const iso2 = (upper.split(/\s+/)[0] ?? "").trim();
  const isIso2 = /^[A-Z]{2}$/.test(iso2);
  const label = isIso2 ? countryShortLabel(iso2) : upper;
  return (
    <div className="inline-flex max-w-full items-center justify-center gap-1" title={raw}>
      <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200">{label}</span>
    </div>
  );
}

export function EmailListDetailPage({ listId }: { listId: string }) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showConfirm } = useAppDialog();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [view, setView] = useState<Item | null>(null);
  const [importKind, setImportKind] = useState<"menu" | "csv" | "sheet" | "bank" | null>(null);
  const [csvText, setCsvText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [bankTab, setBankTab] = useState<"vendors" | "clients">("vendors");
  const [bankSel, setBankSel] = useState<Set<string>>(new Set());
  const undoBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Item[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [findingIds, setFindingIds] = useState<Set<string>>(new Set());
  const [findStatus, setFindStatus] = useState<Record<string, "not_found" | "found">>({});
  const [bulkFinding, setBulkFinding] = useState(false);

  const { data: list } = useQuery({
    queryKey: ["email-list", userKey, listId],
    queryFn: () => apiFetch<{ id: string; name: string }>(`/email-marketing/lists/${listId}`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const { data: itemsPage, isLoading } = useQuery({
    queryKey: ["email-list-items", userKey, listId],
    queryFn: () =>
      apiFetch<{ items: Item[]; total: number }>(`/email-marketing/lists/${listId}/items?limit=200`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const vendorsQ = useQuery({
    queryKey: ["vendors-pending-import", userKey],
    queryFn: () =>
      apiFetch<{ data: VendorRow[]; total: number }>(
        "/vendors?dealStatus=PENDING&limit=200",
        token,
      ),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "vendors",
  });

  const clientsQ = useQuery({
    queryKey: ["clients-import", userKey],
    queryFn: () => apiFetch<{ data: ClientRow[]; total: number }>("/clients?limit=200", token),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "clients",
  });

  const importCsv = useMutation({
    mutationFn: () =>
      apiFetch(`/email-marketing/lists/${listId}/import/csv`, token, {
        method: "POST",
        body: JSON.stringify({ csv: csvText }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
      setImportKind(null);
      setCsvText("");
    },
  });

  const importSheet = useMutation({
    mutationFn: () =>
      apiFetch(`/email-marketing/lists/${listId}/import/sheet`, token, {
        method: "POST",
        body: JSON.stringify({ url: sheetUrl }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
      setImportKind(null);
      setSheetUrl("");
    },
  });

  const importVendors = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`/email-marketing/lists/${listId}/import/vendors`, token, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
      setImportKind(null);
      setBankSel(new Set());
    },
  });

  const importClients = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(`/email-marketing/lists/${listId}/import/clients`, token, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
      setImportKind(null);
      setBankSel(new Set());
    },
  });

  const removeItems = useMutation({
    mutationFn: (itemIds: string[]) =>
      apiFetch(`/email-marketing/lists/${listId}/items/remove`, token, {
        method: "POST",
        body: JSON.stringify({ itemIds }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] }),
  });

  const items = itemsPage?.items ?? [];
  const emailsStr = (em: unknown) => (Array.isArray(em) ? (em as string[]).join(", ") : "");
  const total = itemsPage?.total ?? items.length;
  const filteredItems = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const em = emailsStr(it.emails).toLowerCase();
      return it.siteUrl.toLowerCase().includes(q) || em.includes(q);
    });
  })();

  const itemsMissingEmail = useMemo(
    () => filteredItems.filter((it) => !emailsStr(it.emails).trim()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computed from filteredItems + helper
    [filteredItems],
  );

  async function findOne(it: Item) {
    if (!token) return;
    setFindingIds((s) => new Set(s).add(it.id));
    try {
      const r = await findEmailsFromUrl(token, it.siteUrl);
      if (!r.emails?.length) {
        setFindStatus((m) => ({ ...m, [it.id]: "not_found" }));
        return;
      }
      await apiFetch(`/email-marketing/lists/${listId}/items/${it.id}/emails`, token, {
        method: "PATCH",
        body: JSON.stringify({ emails: r.emails }),
      });
      setFindStatus((m) => ({ ...m, [it.id]: "found" }));
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
    } catch {
      setFindStatus((m) => ({ ...m, [it.id]: "not_found" }));
    } finally {
      setFindingIds((s) => {
        const n = new Set(s);
        n.delete(it.id);
        return n;
      });
    }
  }

  async function findAllMissing() {
    if (!token) return;
    if (!itemsMissingEmail.length) return;
    setBulkFinding(true);
    try {
      const urls = itemsMissingEmail.map((it) => it.siteUrl);
      const resp = await findEmailsFromUrls(token, urls);
      const byUrl = new Map(resp.results.map((r) => [r.url, r]));
      for (const it of itemsMissingEmail) {
        const r = byUrl.get(it.siteUrl);
        const emails = r?.emails ?? [];
        if (!emails.length) {
          setFindStatus((m) => ({ ...m, [it.id]: "not_found" }));
          continue;
        }
        await apiFetch(`/email-marketing/lists/${listId}/items/${it.id}/emails`, token, {
          method: "PATCH",
          body: JSON.stringify({ emails }),
        });
        setFindStatus((m) => ({ ...m, [it.id]: "found" }));
      }
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
    } finally {
      setBulkFinding(false);
    }
  }

  const toggleAll = () => {
    if (sel.size === filteredItems.length) setSel(new Set());
    else setSel(new Set(filteredItems.map((i) => i.id)));
  };

  const exportFile = async (format: "csv" | "pdf") => {
    const body = sel.size ? { itemIds: Array.from(sel) } : {};
    const blob = await apiFetchBlob(`/email-marketing/lists/${listId}/export/${format}`, token, body);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = format === "csv" ? "export.csv" : "export.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  function buildUndoImportCsv(rows: Item[]): string {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const header = "site_url,company_name,emails,niche,country,traffic,dr";
    const lines = rows.map((it) => {
      const em = emailsStr(it.emails);
      return [
        it.siteUrl,
        it.companyName,
        em,
        it.niche,
        it.country,
        String(it.traffic),
        String(it.dr),
      ]
        .map(esc)
        .join(",");
    });
    return `${header}\n${lines.join("\n")}`;
  }

  async function confirmRemoveSelected(ids: string[]) {
    if (!ids.length) return;
    if (!(await showConfirm(`Remove ${ids.length} row(s) from this list?`))) return;
    const snap = items.filter((i) => ids.includes(i.id));
    await removeItems.mutateAsync(ids);
    setSel(new Set());
    setUndoSnapshot(snap);
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoSnapshot(null), 25000);
  }

  async function undoListRemove() {
    if (!undoSnapshot?.length) return;
    await apiFetch(`/email-marketing/lists/${listId}/import/csv`, token, {
      method: "POST",
      body: JSON.stringify({ csv: buildUndoImportCsv(undoSnapshot) }),
    });
    setUndoSnapshot(null);
    void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, listId] });
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-6xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-6xl p-8 text-center">
        <p className="text-slate-600">Sign in to view this list.</p>
        <Link href="/login" className="mt-4 inline-block text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{list?.name ?? "…"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-toolbar-outline" onClick={() => setImportKind("menu")}>
            <Upload className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
            Import
          </button>
          {items.length > 0 ? (
            <div className="relative flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-toolbar-outline"
                onClick={() => setExportOpen((o) => !o)}
              >
                <Download className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                Export
                <ChevronDown className={`h-4 w-4 transition ${exportOpen ? "rotate-180" : ""}`} />
              </button>
              {exportOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        setExportOpen(false);
                        void exportFile("csv");
                      }}
                    >
                      Export as CSV
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        setExportOpen(false);
                        void exportFile("pdf");
                      }}
                    >
                      Export as PDF
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">
              1 - {filteredItems.length} of {total}
            </span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <input
                type="search"
                className="table-toolbar-search w-full"
                placeholder="Search website URL or emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {sel.size > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                  onClick={() => void confirmRemoveSelected(Array.from(sel))}
                >
                  Delete selected rows
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {undoSnapshot?.length ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>
            Removed {undoSnapshot.length} row(s). You can bring them back or leave as is.
          </span>
          <button type="button" className="font-semibold underline" onClick={() => void undoListRemove()}>
            Undo
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : filteredItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600">
          No sites in this list yet. Use Import to add rows.
        </p>
      ) : (
        <div className="data-table-shell">
          <table className="min-w-full text-center text-[11px]">
            <thead className="data-table-thead">
              <tr>
                <th className="w-10 p-2.5 align-middle">
                  <input
                    type="checkbox"
                    className="mx-auto block"
                    checked={filteredItems.length > 0 && sel.size === filteredItems.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="w-10 p-2.5">#</th>
                <th className="min-w-[10rem] p-2.5">Site URL</th>
                <th className="p-2.5">Company name</th>
                <th className="p-2.5">Niche</th>
                <th className="p-2.5">Country</th>
                <th className="p-2.5">Traffic</th>
                <th className="p-2.5">DR</th>
                <th className="p-2.5">
                  <button
                    type="button"
                    onClick={() => void findAllMissing()}
                    disabled={bulkFinding || itemsMissingEmail.length === 0}
                    className="mx-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                    title="Find emails for all rows missing emails"
                  >
                    {bulkFinding ? "Finding…" : "Find emails"}
                  </button>
                </th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, rowIdx) => (
                <tr key={it.id} className="data-table-row">
                  <td className="data-table-td">
                    <input
                      type="checkbox"
                      className="mx-auto block"
                      checked={sel.has(it.id)}
                      onChange={() => {
                        const n = new Set(sel);
                        if (n.has(it.id)) n.delete(it.id);
                        else n.add(it.id);
                        setSel(n);
                      }}
                    />
                  </td>
                  <td className="data-table-td tabular-nums text-slate-500 dark:text-slate-400">{rowIdx + 1}</td>
                  <td className="data-table-td max-w-[14rem]">
                    <div className="mx-auto flex max-w-full min-w-0 items-center justify-center gap-1">
                      <a
                        href={it.siteUrl.startsWith("http") ? it.siteUrl : `https://${it.siteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {it.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                      <a
                        href={it.siteUrl.startsWith("http") ? it.siteUrl : `https://${it.siteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                        aria-label="Open site"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="data-table-td max-w-[10rem] truncate" title={it.companyName}>
                    {it.companyName}
                  </td>
                  <td className="data-table-td max-w-[8rem]" title={it.niche || ""}>
                    <NicheTablePill text={nicheFirstWord(it.niche?.split(/[;]/)[0])} />
                  </td>
                  <td className="data-table-td max-w-[9rem]" title={it.country || ""}>
                    <ListCountryFlagsCell raw={it.country} />
                  </td>
                  <td className="data-table-td">
                    <div className="inline-flex min-w-0 items-center justify-center gap-1.5 tabular-nums">
                      <TrafficSparkline value={it.traffic} seed={it.id} />
                      <span>{it.traffic.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="data-table-td">
                    <DrTableMeter dr={it.dr} />
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    {emailsStr(it.emails).trim() ? (
                      <span className="text-slate-400">—</span>
                    ) : findingIds.has(it.id) ? (
                      <span className="text-slate-500">Finding…</span>
                    ) : findStatus[it.id] === "not_found" ? (
                      <span className="inline-flex items-center justify-center rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-white dark:text-red-700">
                        Not found
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void findOne(it)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Find email
                      </button>
                    )}
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    <DataTableRowMenu
                      a11yLabel="Row actions"
                      items={[
                        { key: "v", type: "button", label: "View", onClick: () => setView(it) },
                        { key: "d", type: "button", label: "Delete", onClick: () => void confirmRemoveSelected([it.id]) },
                      ] satisfies RowMenuItem[]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importKind === "menu" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Import</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" className="rounded-xl border border-slate-200 py-2 text-left px-4 dark:border-slate-600" onClick={() => setImportKind("csv")}>
                Upload CSV
              </button>
              <button type="button" className="rounded-xl border border-slate-200 py-2 text-left px-4 dark:border-slate-600" onClick={() => setImportKind("sheet")}>
                Paste Google Sheets link
              </button>
              <button type="button" className="rounded-xl border border-slate-200 py-2 text-left px-4 dark:border-slate-600" onClick={() => setImportKind("bank")}>
                From My DataBanks
              </button>
            </div>
            <button type="button" className="mt-4 text-sm text-slate-500" onClick={() => setImportKind(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {importKind === "csv" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Import CSV</h2>
            <p className="mt-2 text-xs text-slate-500">Paste CSV with headers (site_url, company_name, emails, …).</p>
            <textarea
              className="mt-3 h-48 w-full rounded-lg border border-slate-200 p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="mt-4 flex justify-between gap-2">
              <button type="button" className="text-sm text-cyan-600" onClick={() => setImportKind("sheet")}>
                Use Google Sheet link instead
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setImportKind(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-save-primary-sm" onClick={() => void importCsv.mutate()}>
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {importKind === "sheet" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Google Sheet</h2>
            <input
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImportKind("menu")}>
                Back
              </button>
              <button type="button" className="btn-save-primary-sm" onClick={() => void importSheet.mutate()}>
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importKind === "bank" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">From My DataBanks</h2>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={cnTab(bankTab === "vendors")}
                onClick={() => setBankTab("vendors")}
              >
                Vendors (Pending deals)
              </button>
              <button
                type="button"
                className={cnTab(bankTab === "clients")}
                onClick={() => setBankTab("clients")}
              >
                Clients (Total)
              </button>
            </div>
            {bankTab === "vendors" ? (
              <BankTable
                rows={vendorsQ.data?.data ?? []}
                empty={!vendorsQ.data?.data?.length}
                selected={bankSel}
                onToggle={(id) => {
                  const n = new Set(bankSel);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  setBankSel(n);
                }}
                onSelectAll={() => {
                  const ids = (vendorsQ.data?.data ?? []).map((r) => r.id);
                  setBankSel(new Set(ids));
                }}
                onClearAll={() => setBankSel(new Set())}
              />
            ) : (
              <BankTable
                rows={clientsQ.data?.data ?? []}
                empty={!clientsQ.data?.data?.length}
                selected={bankSel}
                onToggle={(id) => {
                  const n = new Set(bankSel);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  setBankSel(n);
                }}
                onSelectAll={() => {
                  const ids = (clientsQ.data?.data ?? []).map((r) => r.id);
                  setBankSel(new Set(ids));
                }}
                onClearAll={() => setBankSel(new Set())}
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImportKind("menu")}>
                Back
              </button>
              <button
                type="button"
                className="btn-save-primary-sm"
                disabled={!bankSel.size}
                onClick={() =>
                  bankTab === "vendors"
                    ? void importVendors.mutate(Array.from(bankSel))
                    : void importClients.mutate(Array.from(bankSel))
                }
              >
                Add to list
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {view ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Site details</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Site URL" v={view.siteUrl} />
              <Row k="Company" v={view.companyName} />
              <Row k="Contact" v={view.contactName} />
              <Row k="Kind" v={view.contactKind} />
              <Row k="Niche" v={view.niche || "—"} />
              <Row k="Country" v={view.country || "—"} />
              <Row k="Traffic" v={String(view.traffic)} />
              <Row k="DR" v={String(view.dr)} />
              <Row k="Emails" v={emailsStr(view.emails)} />
            </dl>
            <button type="button" className="mt-6 text-sm text-cyan-600" onClick={() => setView(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function cnTab(active: boolean) {
  return active
    ? "rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white"
    : "rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600";
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1 dark:border-slate-800">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-900 dark:text-slate-100">{v}</dd>
    </div>
  );
}

function BankTable({
  rows,
  empty,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  rows: { id: string; companyName: string; siteUrl: string }[];
  empty: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  if (empty) {
    return <p className="mt-6 text-center text-slate-500">Your databank is empty.</p>;
  }
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        <tr className="border-b dark:border-slate-700">
          <th className="py-2">
            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => (allSelected ? onClearAll() : onSelectAll())}
                />
                Select all
              </label>
            </div>
          </th>
          <th className="py-2">Company</th>
          <th className="py-2">URL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} />
            </td>
            <td className="py-2">{r.companyName}</td>
            <td className="max-w-xs truncate py-2 font-mono text-xs">{r.siteUrl}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
