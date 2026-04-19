"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useMemo, useState } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { ExportFormatMenu, type ExportChunk } from "@/components/export-format-menu";
import { TablePagination } from "@/components/table-pagination";
import { StatusPill } from "@/components/status-pill";
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

type OrderScope = "all" | "completed" | "pending" | "trash";

function linkTypeLabel(lt: string) {
  if (lt === "GUEST_POST") return "Guest post";
  if (lt === "NICHE_EDIT") return "Niche edit";
  return lt;
}

function orderStatusPill(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") {
    return <StatusPill variant="done">Done</StatusPill>;
  }
  if (s === "PENDING") {
    return <StatusPill variant="pending">Pending</StatusPill>;
  }
  return (
    <span className="inline-block rounded-full bg-slate-500 px-3 py-1 text-xs font-semibold text-white">
      {status}
    </span>
  );
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
  const [searchUrl, setSearchUrl] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dateOpen, setDateOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

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
        alert((await res.text()) || "Export failed");
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
    if (!confirm("Move this order to trash?")) return;
    const res = await fetch(apiUrl(`/orders/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert((await res.text()) || "Delete failed");
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

  async function restoreOrder(id: string) {
    if (!token) return;
    const res = await fetch(apiUrl(`/orders/${id}/restore`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert((await res.text()) || "Restore failed");
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

  async function permanentDeleteOrder(id: string) {
    if (!token) return;
    if (!confirm("Permanently delete this order? This cannot be undone.")) return;
    const res = await fetch(apiUrl(`/orders/${id}/permanent`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert((await res.text()) || "Delete failed");
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
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>

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
                placeholder="Client or vendor site…"
                onChange={(e) => {
                  setPage(1);
                  setSearchUrl(e.target.value);
                }}
              />
            </label>

            {!isTrash ? (
              <>
                <button
                  type="button"
                  className={cn("btn-filter", dateOpen && "btn-filter-active")}
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
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                    onClick={() => clearDateFilter()}
                  >
                    Clear date filter
                  </button>
                ) : null}
              </>
            ) : null}

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
              <div className="ml-auto flex shrink-0">
                <Link href="/orders/new" className="btn-toolbar-primary">
                  <Plus className="h-4 w-4" aria-hidden />
                  Create new order
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {!isTrash && dateOpen ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/50">
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

      {isLoading && <p className="mt-4">Loading…</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
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
              <th className="p-2">Client site</th>
              <th className="p-2">Vendor site</th>
              <th className="p-2">Link type</th>
              <th className="p-2">Status</th>
              <th className="p-2">Total price</th>
              <th className="p-2">Date</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const tp =
                typeof r.totalPayment === "object"
                  ? r.totalPayment.toString()
                  : r.totalPayment;
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
                  <td className="max-w-[10rem] truncate p-2 text-xs text-sky-700 dark:text-sky-400">
                    {r.client.siteUrl}
                  </td>
                  <td className="max-w-[10rem] truncate p-2 text-xs text-sky-700 dark:text-sky-400">
                    {r.vendor.siteUrl}
                  </td>
                  <td className="whitespace-nowrap p-2 text-xs">
                    {linkTypeLabel(r.linkType)}
                  </td>
                  <td className="p-2 align-middle">{orderStatusPill(r.status)}</td>
                  <td className="whitespace-nowrap p-2 text-xs tabular-nums">
                    {r.currency.symbol}
                    {tp}
                  </td>
                  <td className="whitespace-nowrap p-2 text-xs">
                    {String(r.orderDate).slice(0, 10)}
                  </td>
                  <td className="space-x-3 whitespace-nowrap p-2 text-xs">
                    {!isTrash ? (
                      <>
                        <Link
                          href={`/orders/${r.id}`}
                          className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="text-red-600 hover:underline dark:text-red-400"
                          onClick={() => void softDeleteOrder(r.id)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-sky-600 hover:underline dark:text-sky-400"
                          onClick={() => void restoreOrder(r.id)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline dark:text-red-400"
                          onClick={() => void permanentDeleteOrder(r.id)}
                        >
                          Delete permanently
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
    </div>
  );
}
