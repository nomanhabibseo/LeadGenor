"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { FileEdit, Inbox, RefreshCw, Send } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { cn } from "@/lib/utils";

type AccountRow = {
  id: string;
  displayName: string;
  fromEmail: string;
  provider: string;
  canSyncMailbox?: boolean;
};

type Msg = {
  id: string;
  folder: string;
  snippet: string;
  fromAddr: string;
  subject: string;
  receivedAt: string;
  bodyPreview: string;
  emailAccount: { displayName: string; fromEmail: string } | null;
};

const FOLDERS = [
  { id: "inbox" as const, label: "Inbox", icon: Inbox },
  { id: "sent" as const, label: "Sent", icon: Send },
  { id: "drafts" as const, label: "Drafts", icon: FileEdit },
];

function folderBadge(folder: string) {
  const u = folder.toUpperCase();
  if (u.includes("INBOX")) return "INBOX";
  if (u.includes("SENT")) return "SENT";
  return folder.slice(0, 12).toUpperCase();
}

export function EmailMailboxPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const [accountId, setAccountId] = useState<string>("");
  const [folder, setFolder] = useState<(typeof FOLDERS)[number]["id"]>("inbox");

  const { data: accounts = [], isError: accountsError, error: accountsErr, refetch: refetchAccounts } = useQuery({
    queryKey: ["email-accounts", userKey],
    queryFn: () => apiFetch<AccountRow[]>("/email-marketing/accounts", token),
    enabled: status === "authenticated" && !!token && !!userKey,
    retry: 2,
  });

  const syncableAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.canSyncMailbox === true ||
          (a.canSyncMailbox === undefined && (a.provider === "GMAIL_API" || a.provider === "OUTLOOK")),
      ),
    [accounts],
  );

  const q = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "100");
    if (accountId) p.set("accountId", accountId);
    p.set("folder", folder);
    return p.toString();
  }, [accountId, folder]);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["mailbox", userKey, accountId, folder],
    queryFn: () => apiFetch<Msg[]>(`/email-marketing/inbox?${q}`, token),
    enabled: status === "authenticated" && !!token && !!userKey && !!accountId,
  });

  const sync = useMutation({
    mutationFn: () =>
      apiFetch<{ synced: number; byFolder?: Record<string, number>; folder?: string }>(
        "/email-marketing/inbox/sync",
        token,
        {
          method: "POST",
          body: JSON.stringify({ accountId, folder: "all" }),
        },
      ),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["mailbox", userKey, accountId] });
      const parts =
        r.byFolder && typeof r.byFolder === "object"
          ? Object.entries(r.byFolder)
              .map(([k, n]) => `${k}: ${n}`)
              .join(", ")
          : "";
      void showAlert(parts ? `Synced ${r.synced} message(s) — ${parts}.` : `Synced ${r.synced} message(s).`);
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  if (status === "loading") {
    return <div className="em-page mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-5xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to open Mailbox.</p>
        <Link href="/login" className="mt-4 inline-block text-indigo-600 underline dark:text-indigo-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="em-page mx-auto max-w-5xl space-y-6 px-2 pb-16 sm:px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Mailbox</h1>
      </div>

      {accountsError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-medium">Could not load email accounts</p>
          <p className="mt-1 text-xs opacity-90">{accountsErr instanceof Error ? accountsErr.message : "Unknown error"}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void refetchAccounts()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="em-card flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-[200px] flex-1 text-sm">
          <span className="font-medium text-slate-600 dark:text-slate-300">Email account</span>
          <select
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-indigo-400"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName} ({a.fromEmail}) — {a.provider}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="em-btn-primary"
          disabled={!accountId || sync.isPending || !syncableAccounts.some((a) => a.id === accountId)}
          title={
            !accountId
              ? "Select an account"
              : !syncableAccounts.some((a) => a.id === accountId)
                ? "Sync needs Gmail/Outlook OAuth, or SMTP with IMAP saved on the account"
                : "Pull inbox, sent, and drafts from the provider into LeadGenor"
          }
          onClick={() => void sync.mutateAsync()}
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          Sync now
        </button>
      </div>

      <div className="inline-flex rounded-xl bg-slate-100/90 p-1 dark:bg-slate-800/80">
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          const active = folder === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolder(f.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
                active
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 opacity-80" />
              {f.label}
            </button>
          );
        })}
      </div>

      {!accountId ? (
        <p className="em-card py-12 text-center text-slate-600 dark:text-slate-400">
          Select an email account to load messages.
        </p>
      ) : isFetching ? (
        <p className="text-sm text-slate-500">Loading messages…</p>
      ) : rows.length === 0 ? (
        <p className="em-card py-12 text-center text-slate-600 dark:text-slate-400">
          No messages in this view. Click <strong>Sync now</strong> after selecting a sync-capable account (add IMAP on the
          SMTP account under Email accounts → edit if needed).
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li
              key={m.id}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/65"
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500 dark:bg-indigo-400" aria-hidden />
              <div className="pl-5 pr-4 pt-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-slate-500">
                      {new Date(m.receivedAt).toLocaleString()}
                      {m.emailAccount ? (
                        <span className="ml-2 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                          {m.emailAccount.fromEmail}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">{m.subject || "(no subject)"}</div>
                    <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">From {m.fromAddr || "—"}</div>
                  </div>
                  <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                    {folderBadge(m.folder)}
                  </span>
                </div>
                {m.bodyPreview || m.snippet ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {m.bodyPreview || m.snippet}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
