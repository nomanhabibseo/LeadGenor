"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, CheckCircle2, Mail, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { TablePagination } from "@/components/table-pagination";
import { FormSwitch } from "@/components/ui/form-switch";

type AccountRow = {
  id: string;
  displayName: string;
  fromEmail: string;
  tag: string;
  dailyLimit: number;
  sentToday: number;
  sentTotal: number;
  delayMinSec: number;
  delayMaxSec: number;
  provider: string;
  connectionStatus?: "connected" | "invalid";
  canSyncMailbox?: boolean;
  campaignsEnabled?: boolean;
};

const ACCOUNTS_PAGE_SIZE = 20;

function providerLabel(provider: string) {
  if (provider === "GMAIL_API") return "Gmail";
  if (provider === "OUTLOOK") return "Outlook";
  if (provider === "SMTP") return "SMTP";
  return provider;
}

function StatusCell({ status }: { status?: AccountRow["connectionStatus"] }) {
  if (status === "invalid") {
    return <span className="text-sm font-medium text-red-600 dark:text-red-400">Invalid</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Connected
    </span>
  );
}

export function EmailAccountsPage() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const undoBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [undoAccountRestore, setUndoAccountRestore] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [campaignsToggleId, setCampaignsToggleId] = useState<string | null>(null);
  const [accountSort, setAccountSort] = useState<"name_asc" | "name_desc" | "sent_desc">("name_asc");

  useEffect(() => {
    const oauth = searchParams.get("oauth");
    const err = searchParams.get("oauthError");
    if (oauth === "google" || oauth === "microsoft" || oauth === "done") {
      setBanner("Email account connected successfully.");
    }
    if (err === "norefresh") {
      setBanner(
        "Google did not return a refresh token. Remove the app from your Google account connections and try again, or use SMTP.",
      );
    }
    if (err && err !== "norefresh") {
      setBanner(`Connection issue (${err}). Check OAuth redirect URIs and environment variables on the server.`);
    }
  }, [searchParams]);

  const { data: accounts = [], isError, error, refetch } = useQuery({
    queryKey: ["email-accounts", userKey],
    queryFn: () => apiFetch<AccountRow[]>("/email-marketing/accounts", token),
    enabled: status === "authenticated" && !!token && !!userKey,
    retry: 2,
    /** Keep Sent today / Sent total in sync while campaigns send (UTC counters on the server). */
    refetchInterval: (query) => (query.state.status === "error" ? false : 8_000),
    refetchIntervalInBackground: false,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/email-marketing/accounts/${id}`, token, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-accounts", userKey] }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const patchCampaigns = useMutation({
    mutationFn: (p: { id: string; campaignsEnabled: boolean }) =>
      apiFetch(`/email-marketing/accounts/${p.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ campaignsEnabled: p.campaignsEnabled }),
      }),
    onMutate: (p) => {
      setCampaignsToggleId(p.id);
    },
    onSettled: () => {
      setCampaignsToggleId(null);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["email-accounts", userKey] }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.fromEmail.toLowerCase().includes(q) ||
        a.tag.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const sortedAccounts = useMemo(() => {
    const list = [...filteredAccounts];
    if (accountSort === "name_asc") {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
    } else if (accountSort === "name_desc") {
      list.sort((a, b) => b.displayName.localeCompare(a.displayName, undefined, { sensitivity: "base" }));
    } else {
      list.sort((a, b) => (b.sentToday ?? 0) - (a.sentToday ?? 0) || a.displayName.localeCompare(b.displayName));
    }
    return list;
  }, [filteredAccounts, accountSort]);

  useEffect(() => {
    setListPage(1);
  }, [search, accountSort]);

  const listTotal = sortedAccounts.length;
  const totalListPages = Math.max(1, Math.ceil(listTotal / ACCOUNTS_PAGE_SIZE));
  const pagedAccounts = useMemo(() => {
    const s = (listPage - 1) * ACCOUNTS_PAGE_SIZE;
    return sortedAccounts.slice(s, s + ACCOUNTS_PAGE_SIZE);
  }, [sortedAccounts, listPage]);
  const rangeFrom = listTotal === 0 ? 0 : (listPage - 1) * ACCOUNTS_PAGE_SIZE + 1;
  const rangeTo = Math.min(listPage * ACCOUNTS_PAGE_SIZE, listTotal);

  async function confirmRemoveAccount(id: string) {
    if (!(await showConfirm("Remove this email account?"))) return;
    await remove.mutateAsync(id);
    setUndoAccountRestore(id);
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    undoBannerTimerRef.current = setTimeout(() => setUndoAccountRestore(null), 20000);
  }

  async function restoreAccountFromUndo() {
    if (!undoAccountRestore || !token) return;
    await apiFetch(`/email-marketing/accounts/${undoAccountRestore}/restore`, token, { method: "POST" });
    if (undoBannerTimerRef.current) clearTimeout(undoBannerTimerRef.current);
    setUndoAccountRestore(null);
    void qc.invalidateQueries({ queryKey: ["email-accounts", userKey] });
  }

  if (status === "loading") {
    return <div className="em-page mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-5xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to manage email accounts.</p>
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
          <p className="font-medium">Could not load email accounts</p>
          <p className="mt-1 text-xs opacity-90">{error instanceof Error ? error.message : "Unknown error"}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Email accounts</h1>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="table-toolbar-search w-full pl-9"
              placeholder="Search by name, email, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:ms-auto">
            <div className="relative min-w-0 sm:min-w-[10.5rem]">
              <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <select
                className="em-btn-outline h-9 w-full cursor-pointer appearance-none rounded-xl border-slate-200 py-0 pl-8 pr-3 text-sm dark:border-slate-600"
                value={accountSort}
                onChange={(e) => setAccountSort(e.target.value as typeof accountSort)}
                aria-label="Sort accounts"
              >
                <option value="name_asc">Sort: A–Z</option>
                <option value="name_desc">Sort: Z–A</option>
                <option value="sent_desc">Sort: Sent today (high–low)</option>
              </select>
            </div>
            <Link href="/email-marketing/accounts/add" className="em-btn-primary inline-flex h-9 items-center gap-2 whitespace-nowrap px-4">
              <Plus className="h-4 w-4" aria-hidden />
              Add account
            </Link>
          </div>
        </div>
        {accounts.length > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">
              {rangeFrom} - {rangeTo} of {listTotal}
            </span>
          </p>
        ) : null}
      </div>

      {banner ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-100">
          {banner}
          <button type="button" className="ml-3 underline" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {undoAccountRestore ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/30 dark:text-emerald-100">
          <span>Account removed.</span>
          <button type="button" className="font-semibold underline" onClick={() => void restoreAccountFromUndo()}>
            Undo
          </button>
        </div>
      ) : null}

      {accounts.length === 0 ? (
        <div className="em-card py-12 text-center text-slate-600 dark:text-slate-400">
          No email accounts yet. Connect Gmail, Outlook, or SMTP to send campaigns.
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="em-card py-12 text-center text-slate-600 dark:text-slate-400">No accounts match your search.</div>
      ) : (
        <>
          <ul className="space-y-4">
            {pagedAccounts.map((a) => {
              const forCampaigns = a.campaignsEnabled !== false;
              return (
                <li key={a.id} className="em-card em-surface-hover">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md dark:bg-indigo-500">
                        <Mail className="h-7 w-7" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-lg font-semibold text-slate-900 dark:text-white">{a.displayName}</span>
                          <StatusCell status={a.connectionStatus} />
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                          {a.fromEmail}
                          {" · "}
                          {providerLabel(a.provider)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Tag: {a.tag}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 lg:shrink-0">
                      <div className="text-center">
                        <div className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                          {a.dailyLimit}
                        </div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Daily limit</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                          {a.sentToday}
                        </div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Sent today</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
                          {a.sentTotal ?? 0}
                        </div>
                        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Sent total</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 sm:min-w-[8.5rem]">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Campaigns</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400">{forCampaigns ? "On" : "Off"}</span>
                        <FormSwitch
                          on={forCampaigns}
                          aria-label={forCampaigns ? "Account enabled for campaigns" : "Account disabled for campaigns"}
                          disabled={campaignsToggleId === a.id}
                          onToggle={() => {
                            void patchCampaigns.mutateAsync({ id: a.id, campaignsEnabled: !forCampaigns });
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 justify-end gap-1.5 lg:justify-start">
                      <Link
                        href={`/email-marketing/accounts/${a.id}/edit`}
                        className="em-icon-btn"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        className="em-icon-btn em-icon-btn-danger"
                        title="Delete"
                        onClick={() => void confirmRemoveAccount(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <TablePagination
            page={listPage}
            totalPages={totalListPages}
            limit={ACCOUNTS_PAGE_SIZE}
            onPageChange={setListPage}
            showLimitSelect={false}
          />
        </>
      )}
    </div>
  );
}

export default EmailAccountsPage;
