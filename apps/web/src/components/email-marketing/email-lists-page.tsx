"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { TablePagination } from "@/components/table-pagination";

type EmailListRow = {
  id: string;
  name: string;
  autoUpdate: "OFF" | "DAILY" | "WEEKLY" | "MONTHLY";
  _count: { items: number; campaigns: number };
  campaigns: { completedAt: string }[];
};

const LISTS_PAGE_SIZE = 30;

const AUTO_OPTS = [
  { v: "OFF" as const, label: "Off" },
  { v: "DAILY" as const, label: "Daily" },
  { v: "WEEKLY" as const, label: "Weekly" },
  { v: "MONTHLY" as const, label: "Monthly" },
];

function autoLabel(v: EmailListRow["autoUpdate"]) {
  return AUTO_OPTS.find((o) => o.v === v)?.label ?? v;
}

export function EmailListsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<{
    id: string;
    name: string;
    autoUpdate: EmailListRow["autoUpdate"];
  } | null>(null);
  const undoBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoListRestore, setUndoListRestore] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);

  const { data: lists = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["email-lists", userKey],
    queryFn: () => apiFetch<EmailListRow[]>("/email-marketing/lists", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const filteredLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) => l.name.toLowerCase().includes(q));
  }, [lists, search]);

  const sortedLists = useMemo(() => {
    const list = [...filteredLists];
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list;
  }, [filteredLists]);

  useEffect(() => {
    setListPage(1);
  }, [search]);

  const listTotal = sortedLists.length;
  const totalListPages = Math.max(1, Math.ceil(listTotal / LISTS_PAGE_SIZE));
  const pagedLists = useMemo(() => {
    const s = (listPage - 1) * LISTS_PAGE_SIZE;
    return sortedLists.slice(s, s + LISTS_PAGE_SIZE);
  }, [sortedLists, listPage]);
  const rangeFrom = listTotal === 0 ? 0 : (listPage - 1) * LISTS_PAGE_SIZE + 1;
  const rangeTo = Math.min(listPage * LISTS_PAGE_SIZE, listTotal);

  function onNewListNext() {
    const n = name.trim();
    if (!n) return;
    setNewOpen(false);
    setName("");
    router.push(`/email-marketing/lists/new?listName=${encodeURIComponent(n)}`);
  }

  const patch = useMutation({
    mutationFn: async (p: { id: string; autoUpdate?: EmailListRow["autoUpdate"]; name?: string }) =>
      apiFetch(`/email-marketing/lists/${p.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ autoUpdate: p.autoUpdate, name: p.name }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-lists", userKey] }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const [autoBusyId, setAutoBusyId] = useState<string | null>(null);

  async function setListAutoUpdate(id: string, autoUpdate: EmailListRow["autoUpdate"]) {
    setAutoBusyId(id);
    try {
      await patch.mutateAsync({ id, autoUpdate });
    } finally {
      setAutoBusyId(null);
    }
  }

  const remove = useMutation({
    mutationFn: async (id: string) => apiFetch(`/email-marketing/lists/${id}`, token, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["email-lists", userKey] });
      const prev = qc.getQueryData<EmailListRow[]>(["email-lists", userKey]);
      qc.setQueryData<EmailListRow[]>(["email-lists", userKey], (old) => (old ?? []).filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["email-lists", userKey], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["email-lists", userKey] }),
  });

  async function confirmDeleteList(id: string) {
    if (!(await showConfirm("Move this list to trash?"))) return;
    await remove.mutateAsync(id);
    setUndoListRestore(id);
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoListRestore(null), 20000);
  }

  async function restoreListFromUndo() {
    if (!undoListRestore || !token) return;
    await apiFetch(`/email-marketing/lists/${undoListRestore}/restore`, token, { method: "POST" });
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    setUndoListRestore(null);
    void qc.invalidateQueries({ queryKey: ["email-lists", userKey] });
  }

  if (status === "loading") {
    return <div className="em-page mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-5xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to manage lists.</p>
        <Link href="/login" className="mt-4 inline-block text-indigo-600 underline dark:text-indigo-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="em-page mx-auto max-w-5xl space-y-6 px-2 pb-16 sm:px-4">
      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-medium">Could not load lists</p>
          <p className="mt-1 text-xs opacity-90">{error instanceof Error ? error.message : "Unknown error"}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">My lists</h1>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-indigo-400"
              placeholder="Search lists by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:ms-auto">
            <button
              type="button"
              className="em-btn-primary inline-flex h-9 items-center gap-2 whitespace-nowrap px-4"
              onClick={() => {
                setName("");
                setNewOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New list
            </button>
          </div>
        </div>
        {lists.length > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">
              {rangeFrom} - {rangeTo} of {listTotal}
            </span>
          </p>
        ) : null}
      </div>

      {undoListRestore ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>List moved to trash.</span>
          <button type="button" className="font-semibold underline" onClick={() => void restoreListFromUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : isError ? null : lists.length === 0 ? (
        <div className="em-card py-14 text-center text-slate-600 dark:text-slate-400">
          No lists yet. Create one to import contacts and target campaigns.
        </div>
      ) : sortedLists.length === 0 ? (
        <div className="em-card py-14 text-center text-slate-600 dark:text-slate-400">No lists match your search.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pagedLists.map((row) => {
              const lastSent = row.campaigns[0]?.completedAt
                ? new Date(row.campaigns[0].completedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";
              return (
                <div key={row.id} className="em-card em-surface-hover flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900 dark:text-white">{row.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Auto-update:{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-300">{autoLabel(row.autoUpdate)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="relative">
                        <select
                          className="max-w-[7.5rem] cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-7 text-center text-[11px] font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          value={row.autoUpdate}
                          title="Auto-update schedule"
                          disabled={autoBusyId === row.id}
                          onChange={(e) => {
                            const v = e.target.value as EmailListRow["autoUpdate"];
                            void setListAutoUpdate(row.id, v);
                          }}
                        >
                          {AUTO_OPTS.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {autoBusyId === row.id ? (
                          <Loader2 className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-slate-500" />
                        ) : (
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">
                            ▼
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="em-icon-btn h-8 w-8"
                        title="Edit list"
                        onClick={() =>
                          setEdit({ id: row.id, name: row.name, autoUpdate: row.autoUpdate })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="em-icon-btn em-icon-btn-danger h-8 w-8"
                        title="Delete"
                        onClick={() => void confirmDeleteList(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 py-2.5 text-center dark:border-slate-600 dark:bg-slate-800/40">
                      <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                        {row._count.items}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">Sites</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 py-2.5 text-center dark:border-slate-600 dark:bg-slate-800/40">
                      <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                        {row._count.campaigns}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">Campaigns</div>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 py-2.5 text-center dark:border-slate-600 dark:bg-slate-800/40">
                      <div className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {lastSent}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">Last sent</div>
                    </div>
                  </div>
                  <Link
                    href={`/email-marketing/lists/${row.id}`}
                    className="mt-4 text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Open list
                  </Link>
                </div>
              );
            })}
          </div>
          <TablePagination
            page={listPage}
            totalPages={totalListPages}
            limit={LISTS_PAGE_SIZE}
            onPageChange={setListPage}
            showLimitSelect={false}
          />
        </>
      )}

      {newOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New list</h2>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">List name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 outreach"
            />
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  setNewOpen(false);
                  setName("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn-primary"
                disabled={!name.trim()}
                onClick={() => onNewListNext()}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit list</h2>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">List name</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">Auto-update</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={edit.autoUpdate}
              onChange={(e) =>
                setEdit({
                  ...edit,
                  autoUpdate: e.target.value as EmailListRow["autoUpdate"],
                })
              }
            >
              {AUTO_OPTS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn-primary"
                onClick={() =>
                  void patch
                    .mutateAsync({
                      id: edit.id,
                      name: edit.name.trim(),
                      autoUpdate: edit.autoUpdate,
                    })
                    .then(() => setEdit(null))
                }
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
