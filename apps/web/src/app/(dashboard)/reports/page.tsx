"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Row = {
  id: string;
  name: string;
  totalSentEmails: number;
  status: "RUNNING" | "COMPLETED";
  startedAt: string | null;
  completedAt: string | null;
  emailList: { id: string; name: string };
  byAccount: { emailAccountId: string; fromEmail: string; displayName: string; sentEmails: number }[];
};

type Drill = {
  campaign: { id: string; name: string; status: string };
  emailAccountId: string;
  rows: {
    sentAt: string;
    replied: boolean;
    opened: boolean;
    targetEmail: string;
    companyName: string;
    siteUrl: string;
    country: string;
    emails: string[];
  }[];
};

function statusLabel(s: Row["status"]) {
  return s === "RUNNING" ? "Running" : "Completed";
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["reports", "campaigns", "sends"],
    queryFn: () => apiFetch<Row[]>("/email-marketing/campaigns/reports/sends", token),
    enabled: !!token,
  });

  const [pick, setPick] = useState<{ campaignId: string; accountId: string; label: string } | null>(null);

  const { data: drill, isLoading: drillLoading, error: drillError } = useQuery({
    queryKey: ["reports", "campaign", pick?.campaignId, "account", pick?.accountId],
    queryFn: () =>
      apiFetch<Drill>(
        `/email-marketing/campaigns/${encodeURIComponent(pick!.campaignId)}/reports/sends/accounts/${encodeURIComponent(
          pick!.accountId,
        )}?take=200`,
        token,
      ),
    enabled: !!token && !!pick?.campaignId && !!pick?.accountId,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Campaign sends (running + completed)</p>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : "Could not load reports."}
        </p>
      ) : null}

      {!isLoading && rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-600 dark:text-slate-400">
          No campaign sends yet.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/35">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 whitespace-nowrap">Started</th>
                <th className="px-4 py-3 whitespace-nowrap">Completed</th>
                <th className="px-4 py-3 whitespace-nowrap">Total sent emails</th>
                <th className="px-4 py-3">By account</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link
                      href={`/email-marketing/campaigns/${encodeURIComponent(r.id)}`}
                      className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
                    >
                      {r.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      List: {r.emailList?.name ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.status === "RUNNING"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200"
                      }`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-200">{r.totalSentEmails}</td>
                  <td className="px-4 py-3">
                    {r.byAccount.length ? (
                      <div className="flex flex-wrap gap-2">
                        {r.byAccount.map((a) => (
                          <button
                            key={a.emailAccountId}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                            title="View sent recipients for this account"
                            type="button"
                            onClick={() =>
                              setPick({
                                campaignId: r.id,
                                accountId: a.emailAccountId,
                                label: `${r.name} · ${a.fromEmail}`,
                              })
                            }
                          >
                            <span className="font-mono">{a.fromEmail}</span>
                            <span className="tabular-nums text-slate-500 dark:text-slate-400">
                              ({a.sentEmails})
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pick ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{pick.label}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Sent prospects (latest 200)</div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/email-marketing/mailbox?accountId=${encodeURIComponent(pick.accountId)}&autoSync=1`}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-900/60"
                >
                  Open mailbox
                </Link>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setPick(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(90vh-3.5rem)] overflow-auto">
              {drillLoading ? (
                <p className="p-4 text-sm text-slate-500">Loading…</p>
              ) : drillError ? (
                <p className="p-4 text-sm text-red-600 dark:text-red-400">
                  {drillError instanceof Error ? drillError.message : "Could not load report."}
                </p>
              ) : drill?.rows?.length ? (
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">URL</th>
                      <th className="px-4 py-3 whitespace-nowrap">Country</th>
                      <th className="px-4 py-3">Emails</th>
                      <th className="px-4 py-3 whitespace-nowrap">Sent</th>
                      <th className="px-4 py-3 whitespace-nowrap">Replied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drill.rows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {r.companyName?.trim() || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.siteUrl ? (
                            <a
                              className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                              href={r.siteUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.siteUrl}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.country || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                          <div className="space-y-0.5">
                            <div className="font-mono">{r.targetEmail}</div>
                            {r.emails?.length ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Also: {r.emails.slice(0, 3).join(", ")}
                                {r.emails.length > 3 ? ` (+${r.emails.length - 3})` : ""}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                          {new Date(r.sentAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.replied ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-4 text-sm text-slate-500">No sends yet for this account.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
