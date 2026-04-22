"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import {
  compileMainFlowToChain,
  chainStepsToMainFlow,
  parseFollowUi,
  type ChainStep,
  type FollowUiState,
  type MainFlowStep,
} from "@/lib/campaign-flow";

type Campaign = {
  id: string;
  name: string;
  emailListId: string;
  wizardStep: number;
  status: string;
  senderAccountIds: unknown;
  mainSequence: unknown;
  mainFlowGraph?: unknown;
  followUpSequence: unknown;
  followUpStartRule?: unknown;
  doNotSendUnverified: boolean;
  doNotSendRisky: boolean;
  doNotSendInvalid: boolean;
  multiEmailPolicy: string;
  skipIfInOtherCampaign: boolean;
  missingVariablePolicy: string;
  stopFollowUpsOnReply: boolean;
  stopCampaignOnCompanyReply: boolean;
  dailyCampaignLimit: number | null;
  scheduledAt: string | null;
  pauseReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

type EmailList = { id: string; name: string };
type Account = { id: string; displayName: string; tag: string };
type Tpl = { id: string; name: string; folder: { name: string } };

function isMainFlowGraph(x: unknown): x is MainFlowStep[] {
  return Array.isArray(x) && x.length > 0 && typeof (x[0] as MainFlowStep)?.t === "string";
}

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

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "text-emerald-600 dark:text-emerald-400";
    case "RUNNING":
    case "SCHEDULED":
      return "text-sky-600 dark:text-sky-400";
    case "PAUSED":
      return "text-amber-700 dark:text-amber-300";
    case "DRAFT":
      return "text-slate-600 dark:text-slate-400";
    default:
      return "text-slate-700 dark:text-slate-200";
  }
}

export function EmailCampaignViewPage({ campaignId }: { campaignId: string }) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);

  const { data: camp, isLoading } = useQuery({
    queryKey: ["campaign", userKey, campaignId],
    queryFn: () => apiFetch<Campaign>(`/email-marketing/campaigns/${campaignId}`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["email-lists", userKey],
    queryFn: () => apiFetch<EmailList[]>("/email-marketing/lists", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["email-accounts", userKey],
    queryFn: () => apiFetch<Account[]>("/email-marketing/accounts", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-all", userKey],
    queryFn: () => apiFetch<Tpl[]>("/email-marketing/templates/all", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const mainCompiled = useMemo(() => {
    if (!camp) return [] as ChainStep[];
    let graph: MainFlowStep[];
    if (isMainFlowGraph(camp.mainFlowGraph)) {
      graph = camp.mainFlowGraph as MainFlowStep[];
    } else {
      const chain = ((camp.mainSequence as ChainStep[]) ?? []).filter((x) => x.templateId);
      graph = chain.length ? chainStepsToMainFlow(chain) : [];
    }
    return compileMainFlowToChain(graph);
  }, [camp]);

  const followUi = useMemo((): FollowUiState | null => {
    if (!camp) return null;
    return parseFollowUi(camp.followUpStartRule, Math.max(1, mainCompiled.length));
  }, [camp, mainCompiled.length]);

  const senderIds = useMemo(() => {
    const raw = camp?.senderAccountIds;
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
    return [] as string[];
  }, [camp?.senderAccountIds]);

  const senderSummary =
    senderIds.length === 0
      ? "None selected"
      : accounts
          .filter((a) => senderIds.includes(a.id))
          .map((a) => `${a.displayName} (${a.tag})`)
          .join(", ");

  if (status === "loading" || isLoading) {
    return <div className="mx-auto max-w-4xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token || !camp) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to view this campaign.</p>
        <Link href="/login" className="mt-4 inline-block text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{camp.name || "Campaign"}</h1>
          <span
            className={cn(
              "shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800",
              statusClass(camp.status),
            )}
          >
            {statusLabel(camp.status)}
          </span>
          {camp.status === "PAUSED" && camp.pauseReason ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">Reason: {camp.pauseReason}</span>
          ) : null}
        </div>
        <Link
          href={`/email-marketing/campaigns/${campaignId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <Pencil className="h-4 w-4" />
          Edit campaign
        </Link>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm dark:border-slate-700 dark:bg-slate-800/65">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Basics</h2>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">List</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {lists.find((l) => l.id === camp.emailListId)?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Multiple emails</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{camp.multiEmailPolicy}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Filters</dt>
              <dd className="text-slate-700 dark:text-slate-200">
                {[
                  camp.doNotSendUnverified && "Skip unverified",
                  camp.doNotSendRisky && "Skip risky",
                  camp.doNotSendInvalid && "Skip invalid",
                ]
                  .filter(Boolean)
                  .join(" · ") || "None"}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Senders</h2>
          <p className="mt-2 text-slate-800 dark:text-slate-100">{senderSummary}</p>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Main sequence</h2>
          <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">
            {mainCompiled.length
              ? mainCompiled.map((m, i) => (
                  <span key={i}>
                    {i > 0 ? " → " : ""}
                    {templates.find((t) => t.id === m.templateId)?.name ?? m.templateId}
                  </span>
                ))
              : "—"}
          </p>
        </section>

        {followUi ? (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Follow-ups</h2>
            <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
              <li>
                Not opened:{" "}
                {followUi.notOpened.enabled
                  ? `${templates.find((t) => t.id === followUi.notOpened.templateId)?.name ?? "—"} (${followUi.notOpened.days}d)`
                  : "Off"}
              </li>
              <li>
                Opened, no action:{" "}
                {followUi.openedNoAction.enabled
                  ? `${templates.find((t) => t.id === followUi.openedNoAction.templateId)?.name ?? "—"} (${followUi.openedNoAction.days}d)`
                  : "Off"}
              </li>
              <li>Stop follow-ups on reply: {camp.stopFollowUpsOnReply ? "Yes" : "No"}</li>
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule & limits</h2>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Scheduled</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {camp.scheduledAt ? new Date(camp.scheduledAt).toLocaleString() : "Start when launched"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Daily campaign cap</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {camp.dailyCampaignLimit != null && camp.dailyCampaignLimit > 0 ? camp.dailyCampaignLimit : "None"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Stop on company reply</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {camp.stopCampaignOnCompanyReply ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </section>

        {(camp.startedAt || camp.completedAt) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Timeline</h2>
            <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {camp.startedAt ? (
                <div>
                  <dt className="inline text-slate-500">Started: </dt>
                  <dd className="inline">{new Date(camp.startedAt).toLocaleString()}</dd>
                </div>
              ) : null}
              {camp.completedAt ? (
                <div>
                  <dt className="inline text-slate-500">Completed: </dt>
                  <dd className="inline">{new Date(camp.completedAt).toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
