"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Eye,
  Loader2,
  Pencil,
  Play,
  Search,
  Send,
  ListFilter,
  MailOpen,
  Reply,
  Pause,
  User,
  Trash2,
} from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/table-pagination";

type Camp = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pauseReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  emailList: { name: string };
  _count: { recipients: number };
  sentRecipients: number;
  remainingRecipients: number;
  openedRecipients: number;
  repliedRecipients: number;
  openRatePct: number;
  replyRatePct: number;
  senderAccountNames: string[];
};

const SENDER_CHIPS_MAX = 3;
const CAMPAIGNS_PAGE_SIZE = 20;

function SenderAccountChips({ names }: { names: string[] }) {
  if (!names.length) {
    return <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>;
  }
  const shown = names.slice(0, SENDER_CHIPS_MAX);
  const more = names.length > SENDER_CHIPS_MAX;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className="max-w-[6.5rem] truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
          title={n}
        >
          {n}
        </span>
      ))}
      {more ? <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">…</span> : null}
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "RUNNING":
      return "Running";
    case "PAUSED":
      return "Paused";
    case "DRAFT":
      return "Draft";
    case "SCHEDULED":
      return "Scheduled";
    case "COMPLETED":
      return "Completed";
    default:
      return status;
  }
}

function CampaignStatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  if (status === "COMPLETED") {
    return (
      <div className="flex flex-col items-center gap-0 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-50 px-2 py-px text-[10px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
          {label}
        </span>
      </div>
    );
  }
  if (status === "SCHEDULED") {
    return (
      <div className="flex flex-col items-center gap-0 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-amber-50 px-2 py-px text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          {label}
        </span>
      </div>
    );
  }
  if (status === "DRAFT") {
    return (
      <div className="flex flex-col items-center gap-0 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-2 py-px text-[10px] font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
          {label}
        </span>
      </div>
    );
  }
  if (status === "PAUSED") {
    return (
      <div className="flex flex-col items-center gap-0 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-amber-50 px-2 py-px text-[10px] font-medium text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          {label}
        </span>
      </div>
    );
  }
  if (status === "RUNNING") {
    return (
      <div className="flex flex-col items-center gap-0 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
        <span className="inline-flex items-center justify-center gap-1 rounded-full bg-sky-50 px-2 py-px text-[10px] font-medium text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
          {label}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0 text-center">
      <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</span>
      <span className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 px-2 py-px text-[10px] font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
        {label}
      </span>
    </div>
  );
}

type StatusFilter = "all" | "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED";

export function EmailCampaignsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [deletedNote, setDeletedNote] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [listPage, setListPage] = useState(1);

  const { data: rows = [], isError, error, refetch, isFetching } = useQuery({
    queryKey: ["campaigns", userKey],
    queryFn: () => apiFetch<Camp[]>("/email-marketing/campaigns", token),
    enabled: status === "authenticated" && !!token && !!userKey,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const data = q.state.data as Camp[] | undefined;
      if (data?.some((c) => c.status === "RUNNING" || c.status === "SCHEDULED")) return 10_000;
      return false;
    },
  });

  const displayRows = useMemo(() => {
    let list = rows.slice();
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const senderHit = (c.senderAccountNames ?? []).some((n) => n.toLowerCase().includes(q));
        return c.name.toLowerCase().includes(q) || c.emailList.name.toLowerCase().includes(q) || senderHit;
      });
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  }, [rows, search, statusFilter]);

  useEffect(() => {
    setListPage(1);
  }, [search, statusFilter]);

  const listTotal = displayRows.length;
  const totalListPages = Math.max(1, Math.ceil(listTotal / CAMPAIGNS_PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (listPage - 1) * CAMPAIGNS_PAGE_SIZE;
    return displayRows.slice(start, start + CAMPAIGNS_PAGE_SIZE);
  }, [displayRows, listPage]);
  const rangeFrom = listTotal === 0 ? 0 : (listPage - 1) * CAMPAIGNS_PAGE_SIZE + 1;
  const rangeTo = Math.min(listPage * CAMPAIGNS_PAGE_SIZE, listTotal);

  const start = useMutation({
    mutationFn: ({ id, skipRecipientBuild }: { id: string; skipRecipientBuild: boolean }) =>
      apiFetch(`/email-marketing/campaigns/${id}/start`, token, {
        method: "POST",
        body: JSON.stringify({ skipRecipientBuild }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns", userKey] }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const pause = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/campaigns/${id}/pause`, token, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaigns", userKey] }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/campaigns/${id}`, token, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["campaigns", userKey] });
      const prev = qc.getQueryData<Camp[]>(["campaigns", userKey]);
      qc.setQueryData<Camp[]>(["campaigns", userKey], (old) => (old ?? []).filter((c) => c.id !== id));
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["campaigns", userKey], ctx.prev);
      void showAlert(e instanceof Error ? e.message : "Could not delete campaign.");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["campaigns", userKey] }),
  });

  async function onPause(c: Camp) {
    const ok = await showConfirm(
      [
        "Do you want to pause this campaign?",
        "",
        "If you confirm, sending will stop and no further campaign emails will go out until you resume.",
        "Pausing can also break follow-up timing or sequencing for recipients who were mid-sequence.",
      ].join("\n"),
    );
    if (!ok) return;
    await pause.mutateAsync(c.id);
  }

  function onEditClick(e: React.MouseEvent, c: Camp) {
    if (c.status === "RUNNING") {
      e.preventDefault();
      void showAlert(
        "You cannot edit a campaign while it is running. Pause the campaign first, then you can make changes.",
      );
    }
  }

  async function onDeleteClick(c: Camp) {
    if (c.status === "RUNNING") {
      await showAlert("You cannot delete a campaign while it is running. Pause the campaign first, then you can delete it.");
      return;
    }
    if (!(await showConfirm(`Delete campaign “${c.name}”? This cannot be undone.`))) return;
    await remove.mutateAsync(c.id);
    setDeletedNote(`Campaign “${c.name}” was deleted.`);
    window.setTimeout(() => setDeletedNote(null), 9000);
  }

  if (status === "loading") {
    return <div className="em-page mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-5xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to manage campaigns.</p>
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
          <p className="font-medium">Could not load campaigns</p>
          <p className="mt-1 text-xs opacity-90">{error instanceof Error ? error.message : "Unknown error"}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
        {isFetching && !isError ? (
          <span className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing…
          </span>
        ) : null}
      </div>

      {deletedNote ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
          {deletedNote}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:ms-auto">
          <div className="relative min-w-0 sm:min-w-[9rem]">
            <ListFilter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <select
              className="em-btn-outline h-9 w-full min-w-0 cursor-pointer appearance-none rounded-xl border-slate-200 py-0 pl-8 pr-3 text-sm dark:border-slate-600"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All status</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="RUNNING">Running</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <Link
            href="/email-marketing/campaigns/new"
            className="em-btn-primary inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap px-4"
          >
            + New campaign
          </Link>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        <span className="tabular-nums">
          {rangeFrom} - {rangeTo} of {listTotal}
        </span>
      </p>

      {displayRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
          {rows.length === 0 ? "No campaigns yet. Create your first campaign to get started." : "No campaigns match your filters."}
        </div>
      ) : (
        <ul className="space-y-4">
          {pagedRows.map((c, i) => {
            const created = new Date(c.createdAt);
            const rowNo = rangeFrom + i;
            const leftAccent =
              c.status === "COMPLETED"
                ? "from-emerald-200/80 to-white"
                : c.status === "SCHEDULED"
                  ? "from-amber-200/80 to-white"
                  : "from-indigo-200/70 to-white";
            const senderNames = c.senderAccountNames ?? [];
            const primaryBtn =
              "inline-flex items-center justify-center gap-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold shadow-none transition-colors disabled:opacity-50";
            return (
              <li key={c.id} className="flex items-stretch gap-3">
                <div className="w-10 shrink-0 pt-3 text-center text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {rowNo}
                </div>
                <div
                  tabIndex={0}
                  className={cn(
                    "group em-surface-hover min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
                    "focus-within:outline-none dark:border-slate-700 dark:bg-slate-800/50",
                  )}
                >
                <div className="grid grid-cols-1 gap-2 border-b border-violet-200/70 p-2.5 sm:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1fr)_minmax(7rem,auto)_1fr] sm:items-center sm:gap-3 dark:border-violet-800/40">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br to-white ring-1 ring-slate-200/80 dark:ring-slate-600",
                      leftAccent,
                    )}
                  >
                    <Send className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Campaign name</p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="mt-0.5 flex max-w-prose items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <User className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">List: {c.emailList.name}</span>
                    </p>
                  </div>
                  <div className="min-w-0 sm:pl-1">
                    <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sender accounts</p>
                    <div className="mt-0.5">
                      <SenderAccountChips names={senderNames} />
                    </div>
                  </div>
                  <div className="flex justify-center justify-self-center sm:min-w-[7.5rem]">
                    <CampaignStatusPill status={c.status} />
                  </div>
                  <div className="flex min-w-0 items-start justify-end gap-2 sm:ml-auto sm:min-w-0 sm:max-w-[14rem]">
                    <div className="shrink-0 text-right">
                      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Created</div>
                      <div className="text-[11px] leading-tight text-slate-800 dark:text-slate-200">
                        {created.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}{" "}
                        {created.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                      <Link
                        href={`/email-marketing/campaigns/${c.id}/view`}
                        className="inline-flex rounded-md p-1.5 text-violet-600 hover:bg-violet-100/80 dark:text-violet-300 dark:hover:bg-violet-950/50"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/email-marketing/campaigns/${c.id}`}
                        className="inline-flex rounded-md p-1.5 text-violet-600 hover:bg-violet-100/80 dark:text-violet-300 dark:hover:bg-violet-950/50"
                        title="Edit"
                        onClick={(e) => onEditClick(e, c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-2.5 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
                    <div className="flex flex-col items-center rounded-md border border-slate-200/80 bg-slate-50/95 px-2 py-1.5 text-center dark:border-slate-600/70 dark:bg-slate-800/60">
                      <div className="text-[8px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sent</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Send className="h-3 w-3 shrink-0 text-sky-500" />
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{c.sentRecipients ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center rounded-md border border-slate-200/80 bg-slate-50/95 px-2 py-1.5 text-center dark:border-slate-600/70 dark:bg-slate-800/60">
                      <div className="text-[8px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0 text-amber-500" />
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">{c.remainingRecipients ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center rounded-md border border-slate-200/80 bg-slate-50/95 px-2 py-1.5 text-center dark:border-slate-600/70 dark:bg-slate-800/60">
                      <div className="text-[8px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Opened</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1">
                        <MailOpen className="h-3 w-3 shrink-0 text-emerald-500" />
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                          {c.openedRecipients ?? 0}{" "}
                          <span className="text-[10px] font-medium text-slate-500">({(c.openRatePct ?? 0)}%)</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center rounded-md border border-slate-200/80 bg-slate-50/95 px-2 py-1.5 text-center dark:border-slate-600/70 dark:bg-slate-800/60">
                      <div className="text-[8px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Replied</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1">
                        <Reply className="h-3 w-3 shrink-0 text-violet-500" />
                        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                          {c.repliedRecipients ?? 0}{" "}
                          <span className="text-[10px] font-medium text-slate-500">({(c.replyRatePct ?? 0)}%)</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 self-center sm:self-end">
                    {c.status === "DRAFT" ? (
                        <button
                          type="button"
                          className={cn(
                            primaryBtn,
                            "text-sky-700 hover:border-sky-500 hover:bg-sky-50/80 dark:text-sky-300 dark:hover:border-sky-500 dark:hover:bg-sky-950/40",
                          )}
                          disabled={start.isPending}
                          onClick={() =>
                            void start.mutateAsync({
                              id: c.id,
                              skipRecipientBuild: false,
                            })
                          }
                        >
                          {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Run Campaign
                        </button>
                      ) : null}
                      {c.status === "RUNNING" ? (
                        <button
                          type="button"
                          className={cn(
                            primaryBtn,
                            "text-amber-800 hover:border-amber-500 hover:bg-amber-50/80 dark:text-amber-200 dark:hover:border-amber-500 dark:hover:bg-amber-950/30",
                          )}
                          disabled={pause.isPending}
                          onClick={() => void onPause(c)}
                        >
                          {pause.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
                          Pause
                        </button>
                      ) : null}
                      {c.status === "PAUSED" ? (
                        <button
                          type="button"
                          className={cn(
                            primaryBtn,
                            "text-sky-700 hover:border-sky-500 hover:bg-sky-50/80 dark:text-sky-300 dark:hover:border-sky-500 dark:hover:bg-sky-950/40",
                          )}
                          disabled={start.isPending}
                          onClick={() =>
                            void start.mutateAsync({
                              id: c.id,
                              skipRecipientBuild: c._count.recipients > 0,
                            })
                          }
                        >
                          {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          Resume
                        </button>
                      ) : null}
                    <button
                      type="button"
                      className="inline-flex rounded-md p-1.5 text-red-600 hover:bg-red-50/90 dark:text-red-400 dark:hover:bg-red-950/40"
                      title="Delete"
                      onClick={() => void onDeleteClick(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TablePagination
        page={listPage}
        totalPages={totalListPages}
        limit={CAMPAIGNS_PAGE_SIZE}
        onPageChange={setListPage}
        showLimitSelect={false}
      />
    </div>
  );
}
