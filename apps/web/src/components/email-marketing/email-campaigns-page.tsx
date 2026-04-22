"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Eye, Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { cn } from "@/lib/utils";

type Camp = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  pauseReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  emailList: { name: string };
  _count: { recipients: number };
  sentRecipients: number;
  remainingRecipients: number;
};

function statusLabel(status: string) {
  switch (status) {
    case "RUNNING":
      return "Active";
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
      <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
        {label}
      </span>
    );
  }
  const palette =
    status === "RUNNING" || status === "SCHEDULED"
      ? "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
      : status === "PAUSED"
        ? "bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100"
        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", palette)}>{label}</span>
  );
}

export function EmailCampaignsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [pauseFor, setPauseFor] = useState<Camp | null>(null);
  const [pauseReasonInput, setPauseReasonInput] = useState("");
  const [deletedNote, setDeletedNote] = useState<string | null>(null);

  const { data: rows = [], isError, error, refetch, isFetching } = useQuery({
    queryKey: ["campaigns", userKey],
    queryFn: () => apiFetch<Camp[]>("/email-marketing/campaigns", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/email-marketing/campaigns/${id}/pause`, token, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
      setPauseFor(null);
      setPauseReasonInput("");
    },
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
    onError: (_e, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(["campaigns", userKey], ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["campaigns", userKey] }),
  });

  async function confirmDeleteCampaign(c: Camp) {
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          {isFetching && !isError ? (
            <span className="inline-flex items-center gap-1 text-xs text-cyan-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </span>
          ) : null}
        </div>
        <Link href="/email-marketing/campaigns/new" className="em-btn-primary inline-flex items-center gap-2">
          + New campaign
        </Link>
      </div>

      {deletedNote ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
          {deletedNote}
        </div>
      ) : null}

      {pauseFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pause campaign</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Optionally tell us why you are pausing.</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              rows={3}
              value={pauseReasonInput}
              onChange={(e) => setPauseReasonInput(e.target.value)}
              placeholder="Reason (optional)"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setPauseFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="em-btn-primary inline-flex items-center gap-2"
                disabled={pause.isPending}
                onClick={() => void pause.mutateAsync({ id: pauseFor.id, reason: pauseReasonInput })}
              >
                {pause.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pause
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/65">
        <table className="w-full text-center text-[11px]">
          <thead className="em-table-thead">
            <tr>
              <th className="px-3 py-3">Campaign name</th>
              <th className="px-3 py-3">Target list</th>
              <th className="px-3 py-3">Date created</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Sent</th>
              <th className="px-3 py-3">Pending</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/90 dark:border-slate-800 dark:hover:bg-slate-800/40">
                <td className="px-3 py-3 text-left align-middle text-[11px] font-medium text-slate-900 dark:text-white">
                  {c.name}
                </td>
                <td className="px-3 py-3 align-middle">
                  <span className="inline-flex max-w-[12rem] truncate rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                    {c.emailList.name}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle text-[11px] text-slate-600 dark:text-slate-400">
                  {new Date(c.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="flex flex-col items-center gap-0.5">
                    <CampaignStatusPill status={c.status} />
                    {c.status === "PAUSED" && c.pauseReason ? (
                      <span className="max-w-[10rem] text-[10px] text-slate-500">Reason: {c.pauseReason}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3 align-middle tabular-nums text-slate-800 dark:text-slate-200">
                  {c.sentRecipients ?? 0}
                </td>
                <td className="px-3 py-3 align-middle tabular-nums text-slate-800 dark:text-slate-200">
                  {c.remainingRecipients ?? 0}
                </td>
                <td className="px-3 py-3 align-middle">
                  <div className="inline-flex flex-nowrap items-center justify-center gap-1.5">
                    <Link
                      href={`/email-marketing/campaigns/${c.id}/view`}
                      className="inline-flex rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/email-marketing/campaigns/${c.id}`}
                      className="inline-flex rounded p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {c.status === "RUNNING" || c.status === "SCHEDULED" ? (
                      <button
                        type="button"
                        className="inline-flex rounded p-1 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
                        title="Pause"
                        onClick={() => {
                          setPauseReasonInput("");
                          setPauseFor(c);
                        }}
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    ) : null}
                    {c.status !== "COMPLETED" && c.status !== "RUNNING" && c.status !== "SCHEDULED" ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded border border-cyan-600 px-2 py-0.5 text-xs font-medium text-cyan-700 disabled:opacity-40 dark:text-cyan-300"
                        disabled={start.isPending}
                        title={c.startedAt ? "Continue campaign" : "Start campaign"}
                        onClick={() =>
                          void start.mutateAsync({
                            id: c.id,
                            skipRecipientBuild: c.status === "PAUSED" && c._count.recipients > 0,
                          })
                        }
                      >
                        {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {c.startedAt ? "Continue" : "Start"}
                      </button>
                    ) : null}
                    {c.status !== "RUNNING" ? (
                      <button
                        type="button"
                        className="inline-flex rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                        title="Delete"
                        onClick={() => void confirmDeleteCampaign(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
