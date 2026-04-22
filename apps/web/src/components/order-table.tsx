"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CalendarRange, ExternalLink, Eye, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch, apiUrl } from "@/lib/api";
import { ExportFormatMenu, type ExportChunk } from "@/components/export-format-menu";
import { TablePagination } from "@/components/table-pagination";
import { OrderStatusTablePill } from "@/components/table-status-badges";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

type OrderRow = {
  id: string;
  orderDate: string;
  status: string;
  linkType: string;
  totalPayment: string | { toString(): string };
  client: { siteUrl: string };
  vendor: { siteUrl: string };
  currency: { code: string; symbol: string };
};

type OrderListPayload = {
  data: OrderRow[];
  total: number;
  page: number;
  limit: number;
};

type OrderScope = "all" | "completed" | "pending" | "trash";

type DashboardOrderCounts = {
  completedOrders: number;
  pendingOrders: number;
};

function siteHref(u: string) {
  const t = u.trim();
  return t.startsWith("http") ? t : `https://${t}`;
}

function linkTypeLabel(lt: string) {
  if (lt === "GUEST_POST") return "Guest post";
  if (lt === "NICHE_EDIT") return "Niche edit";
  return lt;
}

function buildOrdersUrl(
  scope: OrderScope,
  page: number,
  searchUrl: string,
  dateFrom: string,
  dateTo: string,
) {
  const qs = new URLSearchParams();
  const scopeParam =
    scope === "completed"
      ? "completed"
      : scope === "pending"
        ? "pending"
        : scope === "trash"
          ? "trash"
          : "all";
  qs.set("scope", scopeParam);
  qs.set("page", String(page));
  qs.set("limit", String(PAGE_SIZE));
  if (searchUrl.trim()) qs.set("searchUrl", searchUrl.trim());
  if (dateFrom.trim()) qs.set("dateFrom", dateFrom.trim());
  if (dateTo.trim()) qs.set("dateTo", dateTo.trim());
  return `/orders?${qs.toString()}`;
}

export function OrderTable({
  scope,
  title,
}: {
  scope: OrderScope;
  title: string;
}) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateOpen, setDateOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const undoBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoTrashBanner, setUndoTrashBanner] = useState<{ id: string } | null>(null);

  const isTrash = scope === "trash";

  const listUrl = useMemo(
    () => buildOrdersUrl(scope, page, searchUrl, appliedFrom, appliedTo),
    [scope, page, searchUrl, appliedFrom, appliedTo],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["orders", scope, page, searchUrl, appliedFrom, appliedTo],
    queryFn: () =>
      apiFetch<{
        data: OrderRow[];
        total: number;
        page: number;
        limit: number;
      }>(listUrl, token),
    enabled: !!token,
  });

  const { data: dashStats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: () => apiFetch<DashboardOrderCounts>("/stats/dashboard", token),
    enabled: !!token && !isTrash,
  });

  const rows = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.total ?? 0;
  const limit = data?.limit ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const dateFilterActive = Boolean(appliedFrom.trim() || appliedTo.trim());

  const applyDateFilter = useCallback(() => {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setPage(1);
    setDateOpen(false);
  }, [draftFrom, draftTo]);

  const clearDateFilter = useCallback(() => {
    setDraftFrom("");
    setDraftTo("");
    setAppliedFrom("");
    setAppliedTo("");
    setPage(1);
    setDateOpen(false);
  }, []);

  function toggleAll() {
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
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
      const body: Record<string, unknown> = {
        format,
        scope,
        dateFrom: appliedFrom || undefined,
        dateTo: appliedTo || undefined,
        searchUrl: searchUrl.trim() || undefined,
      };
      if (selected.size > 0) {
        body.ids = [...selected];
      } else if (chunk) {
        body.limit = chunk.limit;
        body.offset = chunk.offset ?? 0;
      } else {
        body.ids = exportIds;
      }
      const res = await fetch(apiUrl("/import-export/orders/export"), {
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
      let filename = format === "xlsx" ? "orders.xlsx" : "orders.csv";
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
    if (!rows.length) return;
    const ids = exportIds;
    const toPrint = rows.filter((r) => ids.includes(r.id));
    const head = ["Client site", "Vendor site", "Link type", "Status", "Total price", "Date"];
    const trs = toPrint
      .map((r) => {
        const tp =
          typeof r.totalPayment === "object"
            ? r.totalPayment.toString()
            : r.totalPayment;
        const cells = [
          r.client.siteUrl,
          r.vendor.siteUrl,
          linkTypeLabel(r.linkType),
          r.status,
          `${r.currency.symbol}${tp}`,
          String(r.orderDate).slice(0, 10),
        ];
        return `<tr>${cells.map((c) => `<td>${String(c).replace(/</g, "&lt;")}</td>`).join("")}</tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Orders</title>
<style>body{font-family:system-ui,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:5px;text-align:left}th{background:#f1f5f9}</style></head><body>
<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  async function softDeleteOrder(id: string) {
    if (!token) return;
    if (!(await showConfirm("Move this order to trash?"))) return;
    const snapshots = qc.getQueriesData<OrderListPayload>({ queryKey: ["orders"] });
    qc.setQueriesData<OrderListPayload>({ queryKey: ["orders"] }, (old) => {
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
    const res = await fetch(apiUrl(`/orders/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      void showAlert((await res.text()) || "Delete failed");
      return;
    }
    setUndoTrashBanner({ id });
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoTrashBanner(null), 20000);
    void qc.invalidateQueries({ queryKey: ["orders"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function restoreOrderFromUndo() {
    if (!undoTrashBanner || !token) return;
    const ok = await restoreOrder(undoTrashBanner.id);
    if (!ok) return;
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    setUndoTrashBanner(null);
  }

  async function restoreOrder(id: string): Promise<boolean> {
    if (!token) return false;
    const res = await fetch(apiUrl(`/orders/${id}/restore`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      void showAlert((await res.text()) || "Restore failed");
      return false;
    }
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    void qc.invalidateQueries({ queryKey: ["orders"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
    return true;
  }

  async function permanentDeleteOrder(id: string) {
    if (!token) return;
    if (!(await showConfirm("Permanently delete this order? This cannot be undone."))) return;
    const res = await fetch(apiUrl(`/orders/${id}/permanent`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      void showAlert((await res.text()) || "Delete failed");
      return;
    }
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    void qc.invalidateQueries({ queryKey: ["orders"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  return (
    <div className="-mx-1 max-w-none px-1 md:-mx-2 md:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          {!isTrash ? (
            <Link href="/orders/new" className="btn-toolbar-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Create order
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-400">
        <p>
          <span className="text-[11px] font-medium">
            {from}–{to} of {total}
          </span>
          {selected.size > 0 ? ` — ${selected.size} selected` : ""}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className="table-toolbar-search self-start sm:self-center"
            value={searchUrl}
            placeholder="Search client or vendor site…"
            aria-label="Search"
            onChange={(e) => {
              setPage(1);
              setSearchUrl(e.target.value);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {!isTrash ? (
              <>
                {statsLoading || !dashStats ? (
                  <span className="text-[11px] text-slate-400">Loading lists…</span>
                ) : (
                  <>
                    <Link
                      href="/orders"
                      className={cn("scope-pill", scope === "all" && "scope-pill-active")}
                    >
                      All (
                      {dashStats.completedOrders + dashStats.pendingOrders}
                      )
                    </Link>
                    <Link
                      href="/orders/completed"
                      className={cn(
                        "scope-pill",
                        scope === "completed" && "scope-pill-active",
                      )}
                    >
                      Completed ({dashStats.completedOrders})
                    </Link>
                    <Link
                      href="/orders/pending"
                      className={cn("scope-pill", scope === "pending" && "scope-pill-active")}
                    >
                      Pending ({dashStats.pendingOrders})
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className={cn("btn-filter h-8 py-1", dateOpen && "btn-filter-active")}
                  onClick={() => {
                    if (!dateOpen) {
                      setDraftFrom(appliedFrom);
                      setDraftTo(appliedTo);
                    }
                    setDateOpen((o) => !o);
                  }}
                >
                  <CalendarRange className="h-4 w-4" />
                  Filter by date
                  {dateFilterActive ? (
                    <span className="rounded-full bg-white/25 px-1.5 text-[10px] text-white">
                      on
                    </span>
                  ) : null}
                </button>

                {dateFilterActive ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => clearDateFilter()}
                  >
                    Clear date filter
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {!isTrash && dateOpen ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/55">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Date from
              <input
                type="date"
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
              Date to
              <input
                type="date"
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              onClick={() => applyDateFilter()}
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>

      {!isTrash && undoTrashBanner ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>Order moved to trash.</span>
          <button type="button" className="font-medium underline" onClick={() => void restoreOrderFromUndo()}>
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
              <th className="min-w-[9rem] p-2.5">Client site</th>
              <th className="min-w-[9rem] p-2.5">Vendor site</th>
              <th className="p-2.5">Link type</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Total price</th>
              <th className="p-2.5">Date</th>
              <th className="p-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rowIdx) => {
              const tp =
                typeof r.totalPayment === "object"
                  ? r.totalPayment.toString()
                  : r.totalPayment;
              const rowNum = (page - 1) * limit + rowIdx + 1;
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
                  <td className="data-table-td max-w-[11rem] align-top">
                    <div className="mx-auto flex max-w-full min-w-0 items-center justify-center gap-1">
                      <a
                        href={siteHref(r.client.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {r.client.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                      <a
                        href={siteHref(r.client.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-sky-600"
                        aria-label="Open client site"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="data-table-td max-w-[11rem] align-top">
                    <div className="mx-auto flex max-w-full min-w-0 items-center justify-center gap-1">
                      <a
                        href={siteHref(r.vendor.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate font-medium text-sky-700 hover:underline dark:text-sky-400"
                      >
                        {r.vendor.siteUrl.replace(/^https?:\/\//, "")}
                      </a>
                      <a
                        href={siteHref(r.vendor.siteUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-slate-400 hover:text-sky-600"
                        aria-label="Open vendor site"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    {linkTypeLabel(r.linkType)}
                  </td>
                  <td className="data-table-td align-middle">
                    <OrderStatusTablePill status={r.status} />
                  </td>
                  <td className="data-table-td whitespace-nowrap tabular-nums">
                    {r.currency.symbol}
                    {tp}
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    {String(r.orderDate).slice(0, 10)}
                  </td>
                  <td className="data-table-td whitespace-nowrap">
                    <div className="inline-flex flex-nowrap items-center justify-center gap-1">
                      {!isTrash ? (
                        <>
                          <Link
                            href={`/orders/${r.id}`}
                            className="inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/orders/${r.id}/edit`}
                            className="inline-flex rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="Delete"
                            onClick={() => void softDeleteOrder(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="inline-flex rounded p-1.5 text-sky-600 hover:bg-slate-100 dark:text-sky-400 dark:hover:bg-slate-800"
                            title="Restore"
                            onClick={() => void restoreOrder(r.id)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="inline-flex rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="Delete permanently"
                            onClick={() => void permanentDeleteOrder(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
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
    </div>
  );
}
