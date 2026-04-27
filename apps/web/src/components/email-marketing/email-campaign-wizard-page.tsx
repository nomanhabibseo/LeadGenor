"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { pushNotification } from "@/lib/notifications";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { SequenceFlowEditor } from "@/components/email-marketing/sequence-flow-editor";
import { FormSwitch } from "@/components/ui/form-switch";
import {
  chainStepsToMainFlow,
  compileMainFlowToChain,
  defaultFollowUi,
  type ChainStep,
  type MainFlowStep,
} from "@/lib/campaign-flow";

type CheckRow = { email: string; reason: string; siteUrl: string };

type Campaign = {
  id: string;
  name: string;
  emailListId: string;
  wizardStep: number;
  status: string;
  /** Present on GET campaign; used to decide skipRecipientBuild when resuming. */
  recipients?: { id: string }[];
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
  checkListEntries?: unknown;
  pauseReason?: string | null;
  startedAt?: string | null;
};

type EmailList = { id: string; name: string };
type Account = {
  id: string;
  displayName: string;
  tag: string;
  campaignsEnabled?: boolean;
  connectionStatus?: string | null;
};
type Tpl = { id: string; name: string; folder: { name: string } };

const STEP_LABELS = ["Basics", "Senders", "Sequence", "Schedule", "Review"] as const;

const wizardBackLinkClass =
  "text-sm font-medium text-emerald-600 transition hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300";

/** Section title above controls; pair with `wizardOptionLabel` for checkboxes/radios. */
const wizardFieldTitle = "text-sm font-semibold text-slate-900 dark:text-slate-100";
const wizardOptionLabel = "flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400";

function CreateCampaignStepper({ currentStep, heading }: { currentStep: number; heading: string }) {
  return (
    <div className="mb-8">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{heading}</h1>
      <div className="mx-auto w-full max-w-xl min-w-0 pb-1">
        <div className="flex items-start justify-center">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = currentStep > n;
            const active = currentStep === n;
            const lineDone = (a: number) => currentStep > a;
            return (
              <div key={n} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="flex w-full items-center justify-center">
                  {n > 1 ? (
                    <div
                      className={`h-px min-w-[6px] max-w-10 flex-1 rounded-full sm:max-w-12 ${
                        lineDone(n - 1) ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-600"
                      }`}
                    />
                  ) : (
                    <div className="w-1 shrink-0 sm:w-2" />
                  )}
                  <div className="relative z-10 mx-0.5 shrink-0">
                    {done ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow sm:h-9 sm:w-9">
                        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
                      </span>
                    ) : active ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-md dark:bg-indigo-500 sm:h-9 sm:w-9 sm:text-sm">
                        {n}
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500 sm:h-9 sm:w-9 sm:text-xs">
                        {n}
                      </span>
                    )}
                  </div>
                  {n < 5 ? (
                    <div
                      className={`h-px min-w-[6px] max-w-10 flex-1 rounded-full sm:max-w-12 ${
                        lineDone(n) ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-600"
                      }`}
                    />
                  ) : (
                    <div className="w-1 shrink-0 sm:w-2" />
                  )}
                </div>
                <span
                  className={`mt-1.5 max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight sm:max-w-[5.25rem] sm:text-[11px] ${
                    done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : active
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isMainFlowGraph(x: unknown): x is MainFlowStep[] {
  return Array.isArray(x) && x.length > 0 && typeof (x[0] as MainFlowStep)?.t === "string";
}

function FlowReviewTree({
  steps,
  templates,
  depth = 0,
}: {
  steps: MainFlowStep[];
  templates: Tpl[];
  depth?: number;
}): ReactNode {
  const tplName = (id: string) => {
    const n = templates.find((t) => t.id === id)?.name?.trim();
    return n || id || "(template not set)";
  };

  if (!steps.length) {
    return <span className="italic text-slate-400 dark:text-slate-500">Empty</span>;
  }

  return (
    <ul
      className={`space-y-1.5 text-xs text-slate-800 dark:text-slate-100 ${
        depth > 0 ? "ml-2.5 border-l border-slate-200 pl-2.5 dark:border-slate-600" : ""
      }`}
    >
      {steps.map((s) => (
        <li key={s.id}>
          {s.t === "email" ? (
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Email</span> · {tplName(s.templateId)}
            </div>
          ) : s.t === "delay" ? (
            <div>
              <span className="font-semibold text-slate-500 dark:text-slate-400">Delay</span> · {s.days} day(s)
            </div>
          ) : (
            <div className="space-y-1.5">
              <div>
                <span className="font-semibold text-fuchsia-800 dark:text-fuchsia-300">Follow-Ups</span>
                <span className="text-slate-500 dark:text-slate-400"> — </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Wait {s.waitDays ?? 0}d after the {(s.afterEmailIndex ?? 0) + 1}th main email, then split.
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">Opened but not replied</div>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">Opened, no reply yet.</p>
                <FlowReviewTree steps={s.yes} templates={templates} depth={depth + 1} />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-rose-700 dark:text-rose-400">Not opened</div>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">Delivered, not opened.</p>
                <FlowReviewTree steps={s.no} templates={templates} depth={depth + 1} />
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const FOLLOWUP_CONFIG_ALERT =
  'First select after which email the follow-ups should start and how many days to wait. Go to the "Follow-Ups" field and select the email and wait days.';

function sequenceBlocksContinue(flow: MainFlowStep[]): string | null {
  for (const s of flow) {
    if (s.t === "email" && !s.templateId.trim()) {
      return "Select an email template for every email in the sequence before continuing.";
    }
    if (s.t === "condition") {
      if (s.kind !== "opened_email" && !s.configComplete) {
        return FOLLOWUP_CONFIG_ALERT;
      }
      const a = sequenceBlocksContinue(s.yes);
      if (a) return a;
      const b = sequenceBlocksContinue(s.no);
      if (b) return b;
    }
  }
  return null;
}

export function EmailCampaignWizardPage({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [step, setStep] = useState(1);
  const [ignoreSchedule, setIgnoreSchedule] = useState(true);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [senderPickerOpen, setSenderPickerOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<null | "save" | "run" | "schedule">(null);
  const [newRunPending, setNewRunPending] = useState(false);

  const { data: camp } = useQuery({
    queryKey: ["campaign", userKey, campaignId],
    queryFn: () => apiFetch<Campaign>(`/email-marketing/campaigns/${campaignId}`, token),
    enabled: !!token && !!userKey && campaignId !== "new",
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["email-lists", userKey],
    queryFn: () => apiFetch<EmailList[]>("/email-marketing/lists", token),
    enabled: !!token && !!userKey,
  });

  const {
    data: accounts = [],
    isError: accountsQueryError,
    error: accountsQueryErr,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ["email-accounts", userKey],
    queryFn: () => apiFetch<Account[]>("/email-marketing/accounts", token),
    enabled: !!token && !!userKey,
    retry: 2,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-all", userKey],
    queryFn: () => apiFetch<Tpl[]>("/email-marketing/templates/all", token),
    enabled: !!token && !!userKey,
  });

  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [senders, setSenders] = useState<string[]>([]);
  const [mainFlow, setMainFlow] = useState<MainFlowStep[]>([]);
  const [flags, setFlags] = useState({
    doNotSendUnverified: false,
    doNotSendRisky: false,
    doNotSendInvalid: false,
    multiEmailPolicy: "FIRST",
    skipIfInOtherCampaign: false,
    missingVariablePolicy: "TO_CHECK_LIST",
    stopFollowUpsOnReply: true,
    stopCampaignOnCompanyReply: true,
    dailyCampaignLimit: "" as string | number,
  });

  async function warnIfSenderProblems() {
    if (!senders.length) return;
    const picked = senders.map((id) => accounts.find((a) => a.id === id)).filter(Boolean) as Account[];
    const missing = senders.filter((id) => !accounts.some((a) => a.id === id));
    const problems: string[] = [];
    for (const a of picked) {
      if (a.campaignsEnabled === false) {
        problems.push(`"${a.displayName}" is disabled for campaigns.`);
      }
      if (String(a.connectionStatus ?? "").toLowerCase() === "invalid") {
        problems.push(`"${a.displayName}" connection is invalid.`);
      }
    }
    for (const id of missing) problems.push(`Sender account not found (${id}).`);
    if (!problems.length) return;

    const message =
      "This campaign is using one or more sender accounts with problems:\n\n" +
      problems.map((p) => `- ${p}`).join("\n") +
      "\n\nFix: Email marketing → Email accounts.";

    await showAlert(message);
    await pushNotification(token, {
      kind: "warning",
      title: "Sender account issue detected",
      message,
      href: "/email-marketing/accounts",
    });
  }

  useEffect(() => {
    if (!camp) return;
    setName(camp.name);
    setListId(camp.emailListId);
    {
      const w = camp.wizardStep || 1;
      // `wizardStep` is 1-based and matches the UI steps:
      // 1 Basics, 2 Senders, 3 Sequence, 4 Schedule, 5 Review
      setStep(Math.min(5, Math.max(1, w)));
    }
    setSenders((camp.senderAccountIds as string[]) ?? []);
    let graph: MainFlowStep[];
    if (isMainFlowGraph(camp.mainFlowGraph)) {
      graph = camp.mainFlowGraph as MainFlowStep[];
    } else {
      const chain = ((camp.mainSequence as ChainStep[]) ?? []).filter((x) => x.templateId);
      graph = chain.length ? chainStepsToMainFlow(chain) : [];
    }
    setMainFlow(graph);
    setFlags({
      doNotSendUnverified: camp.doNotSendUnverified,
      doNotSendRisky: camp.doNotSendRisky,
      doNotSendInvalid: camp.doNotSendInvalid,
      multiEmailPolicy: camp.multiEmailPolicy,
      skipIfInOtherCampaign: camp.skipIfInOtherCampaign,
      missingVariablePolicy: camp.missingVariablePolicy,
      stopFollowUpsOnReply: camp.stopFollowUpsOnReply,
      stopCampaignOnCompanyReply: camp.stopCampaignOnCompanyReply,
      dailyCampaignLimit: camp.dailyCampaignLimit ?? "",
    });
    if (camp.scheduledAt) {
      setScheduleLocal(toLocalInput(camp.scheduledAt));
      setIgnoreSchedule(false);
    } else {
      setScheduleLocal("");
      setIgnoreSchedule(true);
    }
  }, [camp]);

  useEffect(() => {
    if (step !== 4 || ignoreSchedule) return;
    if (scheduleLocal.trim()) return;
    const t = new Date();
    t.setTime(t.getTime() + 12 * 60 * 60 * 1000);
    setScheduleLocal(toLocalInput(t.toISOString()));
  }, [step, ignoreSchedule]);

  /** New campaign route: keep everything local until Step 5 Save/Run/Schedule. */
  const isNewCampaign = campaignId === "new";

  /** Running → paused: resume continues existing sends; only daily campaign cap may be edited. */
  const isPausedFromRunning = Boolean(camp?.status === "PAUSED" && camp?.startedAt);

  useEffect(() => {
    if (!isNewCampaign || !lists.length) return;
    setListId((prev) => prev || lists[0]!.id);
  }, [isNewCampaign, lists]);

  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      return apiFetch(`/email-marketing/campaigns/${campaignId}`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      if (!isNewCampaign) void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] });
    },
  });

  async function createAndSaveNewCampaign(payload: Record<string, unknown>) {
    const created = await apiFetch<{ id: string }>("/email-marketing/campaigns", token, {
      method: "POST",
      body: JSON.stringify({
        name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : undefined,
      }),
    });
    await apiFetch(`/email-marketing/campaigns/${created.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    void qc.invalidateQueries({ queryKey: ["campaign", userKey, created.id] });
    return created.id;
  }

  const build = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; checkList: CheckRow[] }>(`/email-marketing/campaigns/${campaignId}/build-recipients`, token, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] }),
  });

  const startCamp = useMutation({
    mutationFn: (body: { skipRecipientBuild: boolean; scheduledAt?: string | null }) =>
      apiFetch(`/email-marketing/campaigns/${campaignId}/start`, token, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const pause = useMutation({
    mutationFn: (reason?: string) =>
      apiFetch(`/email-marketing/campaigns/${campaignId}/pause`, token, {
        method: "POST",
        body: JSON.stringify({ reason: reason ?? "" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] });
      void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    },
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/email-marketing/campaigns/${campaignId}`, token, { method: "DELETE" }),
    onSuccess: () => {
      router.push("/email-marketing/campaigns");
      router.refresh();
    },
  });

  function schedulePayload() {
    if (ignoreSchedule) return { scheduledAt: null as string | null };
    if (!scheduleLocal) return { scheduledAt: null as string | null };
    return { scheduledAt: new Date(scheduleLocal).toISOString() };
  }

  function buildBody(wizardStep: number): Record<string, unknown> {
    const mainSeq = compileMainFlowToChain(mainFlow);
    const followRule = defaultFollowUi();
    return {
      name,
      emailListId: listId,
      wizardStep,
      senderAccountIds: senders,
      mainSequence: mainSeq,
      mainFlowGraph: mainFlow,
      followUpSequence: [],
      followUpStartRule: followRule,
      ...flags,
      stopFollowUpsOnReply: flags.stopFollowUpsOnReply,
      dailyCampaignLimit: (() => {
        if (flags.dailyCampaignLimit === "") return null;
        const n = Number(flags.dailyCampaignLimit);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
      })(),
      ...schedulePayload(),
    };
  }

  async function persistStep(nextStep: number) {
    if (!isNewCampaign && !isPausedFromRunning) {
      await save.mutateAsync(buildBody(nextStep));
    }
    setStep(nextStep);
  }

  async function validateStep(s: number): Promise<boolean> {
    if (s === 1) {
      if (!name.trim() || !listId) {
        await showAlert("Complete this step to continue to the next one. Add a campaign name and select a list.");
        return false;
      }
      return true;
    }
    if (s === 2) {
      if (!senders.length) {
        await showAlert("Complete this step to continue to the next one. Select at least one sender account.");
        return false;
      }
      return true;
    }
    if (s === 3) {
      const seq = compileMainFlowToChain(mainFlow);
      if (!seq.length) {
        await showAlert("Complete this step to continue to the next one. Add at least one email template to the sequence.");
        return false;
      }
      const block = sequenceBlocksContinue(mainFlow);
      if (block) {
        await showAlert(block);
        return false;
      }
      return true;
    }
    if (s === 4) {
      if (isPausedFromRunning) return true;
      if (!ignoreSchedule && !scheduleLocal) {
        await showAlert(
          'Complete this step to continue. Either turn on "Start campaign now and ignore schedule" or pick a schedule date and time.',
        );
        return false;
      }
      return true;
    }
    return true;
  }

  async function persistBack() {
    const prev = Math.max(1, step - 1);
    if (!isNewCampaign && !isPausedFromRunning) {
      await save.mutateAsync(buildBody(prev));
    }
    setStep(prev);
  }

  async function goNext() {
    if (!(await validateStep(step))) return;
    if (step >= 5) return;
    const next = step + 1;
    try {
      await persistStep(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save this step. Please try again.";
      await showAlert(msg);
    }
  }

  async function saveCampaignFinalize() {
    for (let s = 1; s <= 4; s++) {
      if (!(await validateStep(s))) return;
    }
    const payload: Record<string, unknown> = buildBody(5);
    // Save-only action: keep in DRAFT and do not start sending.
    payload.status = "DRAFT";
    if (isNewCampaign) {
      await createAndSaveNewCampaign(payload);
    } else {
      await save.mutateAsync(payload);
    }
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    router.push("/email-marketing/campaigns");
    router.refresh();
  }

  async function saveScheduleOnly() {
    for (let s = 1; s <= 4; s++) {
      if (!(await validateStep(s))) return;
    }
    await warnIfSenderProblems();
    const payload: Record<string, unknown> = buildBody(5);
    payload.status = "SCHEDULED";
    if (isNewCampaign) {
      const id = await createAndSaveNewCampaign(payload);
      await apiFetch(`/email-marketing/campaigns/${id}/start`, token, {
        method: "POST",
        body: JSON.stringify({
          skipRecipientBuild: false,
          scheduledAt: typeof payload.scheduledAt === "string" ? (payload.scheduledAt as string) : undefined,
        }),
      });
    } else {
      await save.mutateAsync(payload);
      await startCamp.mutateAsync({
        skipRecipientBuild: false,
        scheduledAt: typeof payload.scheduledAt === "string" ? (payload.scheduledAt as string) : undefined,
      });
    }
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    if (!isNewCampaign) void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] });
    router.push("/email-marketing/campaigns");
    router.refresh();
  }

  async function saveAndLaunchCampaign() {
    for (let s = 1; s <= 4; s++) {
      if (!(await validateStep(s))) return;
    }
    await warnIfSenderProblems();
    if (camp?.status === "RUNNING") {
      await showAlert("Campaign is already running.");
      return;
    }
    if (camp?.status === "COMPLETED") {
      await showAlert("This campaign is already completed.");
      return;
    }
    const payload: Record<string, unknown> = buildBody(5);
    if (camp?.status === "DRAFT") payload.status = "DRAFT";
    const id = isNewCampaign ? await createAndSaveNewCampaign(payload) : campaignId;
    const resumePausedRunning = camp?.status === "PAUSED" && camp.startedAt;
    if (!isNewCampaign && !resumePausedRunning) {
      await save.mutateAsync(payload);
    }
    const skipRecipientBuild =
      camp?.status === "PAUSED" && Array.isArray(camp.recipients) && camp.recipients.length > 0;
    if (isNewCampaign) {
      setNewRunPending(true);
      try {
        await apiFetch(`/email-marketing/campaigns/${id}/start`, token, {
          method: "POST",
          body: JSON.stringify({ skipRecipientBuild: false }),
        });
      } finally {
        setNewRunPending(false);
      }
    } else {
      await startCamp.mutateAsync({ skipRecipientBuild });
    }
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    if (!isNewCampaign) void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] });
    router.push("/email-marketing/campaigns");
    router.refresh();
  }

  async function savePausedFromRunningOnly() {
    if (reviewAction) return;
    setReviewAction("save");
    try {
      const dailyCampaignLimit = (() => {
        if (flags.dailyCampaignLimit === "") return null;
        const n = Number(flags.dailyCampaignLimit);
        if (!Number.isFinite(n) || n <= 0) return null;
        return n;
      })();
      await save.mutateAsync({ dailyCampaignLimit, wizardStep: 5 });
      void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
      if (!isNewCampaign) void qc.invalidateQueries({ queryKey: ["campaign", userKey, campaignId] });
      router.push("/email-marketing/campaigns");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save changes.";
      await showAlert(msg);
    } finally {
      setReviewAction(null);
    }
  }

  async function onReviewSaveDraft() {
    if (reviewAction) return;
    setReviewAction("save");
    try {
      await saveCampaignFinalize();
    } finally {
      setReviewAction(null);
    }
  }

  async function onReviewRunNow() {
    if (reviewAction) return;
    setReviewAction("run");
    try {
      await saveAndLaunchCampaign();
    } finally {
      setReviewAction(null);
    }
  }

  async function onReviewSaveSchedule() {
    if (reviewAction) return;
    setReviewAction("schedule");
    try {
      await saveScheduleOnly();
    } finally {
      setReviewAction(null);
    }
  }

  const storedCheckList: CheckRow[] = Array.isArray(camp?.checkListEntries)
    ? (camp!.checkListEntries as CheckRow[])
    : [];

  const senderSummary =
    senders.length === 0
      ? "None selected"
      : accounts
          .filter((a) => senders.includes(a.id))
          .map((a) => `${a.displayName} (${a.tag})`)
          .join(", ");

  const campaignSenderAccounts = useMemo(
    () => accounts.filter((a) => a.campaignsEnabled !== false),
    [accounts],
  );

  const canUseReviewSaves = step === 5;
  /** Step 5: a real datetime is set (not “start now”). Primary CTA label becomes “Save Schedule”. */
  const reviewUsesScheduledStart = !ignoreSchedule && Boolean(scheduleLocal.trim());
  const reviewSchedulePendingLabel =
    reviewAction === "schedule" && (startCamp.isPending || save.isPending) ? "Scheduling…" : "Save Schedule";
  const reviewRunPendingLabel =
    reviewAction === "run" && (startCamp.isPending || save.isPending || newRunPending) ? "Starting…" : "Run Campaign";
  const reviewSavePendingLabel = reviewAction === "save" && save.isPending ? "Saving…" : "Save Campaign";
  const reviewPausedOnlySaveLabel = reviewAction === "save" && save.isPending ? "Saving…" : "Save changes";

  const doNotSendSummary = (() => {
    const parts: string[] = [];
    if (flags.doNotSendUnverified) parts.push("Unverified");
    if (flags.doNotSendRisky) parts.push("Risky");
    if (flags.doNotSendInvalid) parts.push("Invalid");
    return parts.length
      ? `Excluded: ${parts.join(", ")}.`
      : "None — unverified, risky, and invalid addresses are not auto-skipped by these toggles.";
  })();

  const multiEmailSummary =
    flags.multiEmailPolicy === "ALL"
      ? "Send to all emails on the prospect"
      : "Send only to the first email on the prospect";

  const missingVarSummary =
    flags.missingVariablePolicy === "TO_CHECK_LIST"
      ? "Send to to-check list (do not send until resolved)"
      : "Send campaign anyway";

  const scheduleSummary = ignoreSchedule
    ? "Start campaign now — scheduled date/time is ignored for the first send window"
    : scheduleLocal
      ? `Scheduled start (local): ${new Date(scheduleLocal).toLocaleString()}`
      : "No schedule set (pick a date on the Schedule step or turn on “start now”)";

  const dailyLimitSummary = (() => {
    if (flags.dailyCampaignLimit === "") return "None — only each sender account’s daily limit applies.";
    const n = Number(flags.dailyCampaignLimit);
    if (!Number.isFinite(n) || n <= 0) return "None — only each sender account’s daily limit applies.";
    return `${n} sends max per UTC day for this campaign (stricter of this and sender limits wins).`;
  })();

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {camp?.status === "RUNNING" ? (
          <button
            type="button"
            className="text-sm text-amber-700 underline dark:text-amber-300"
            onClick={() => {
              const reason = window.prompt("Pause campaign — reason (optional):") ?? "";
              void pause.mutateAsync(reason);
            }}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            className="text-sm text-red-600 hover:underline"
            onClick={() => {
              void (async () => {
                if (isNewCampaign) {
                  if (await showConfirm("Leave without saving? Your campaign is not created until you save.")) {
                    router.push("/email-marketing/campaigns");
                  }
                  return;
                }
                if (await showConfirm("Delete this campaign?")) void remove.mutate();
              })();
            }}
          >
            {isNewCampaign ? "Close" : "Delete"}
          </button>
        )}
      </div>

      <CreateCampaignStepper currentStep={step} heading={name.trim() || "Create campaign"} />

      {camp?.status === "RUNNING" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10">
          This campaign is running. Pause before editing core settings or deleting.
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => {
              const reason = window.prompt("Pause campaign — reason (optional):") ?? "";
              void pause.mutateAsync(reason);
            }}
          >
            Pause
          </button>
        </div>
      ) : null}

      {isPausedFromRunning ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
          This campaign is paused after a running send. Only the{" "}
          <span className="font-semibold">daily sending limit for this campaign</span> can be changed (Schedule step or Review). On
          the last step, use <span className="font-semibold">Save changes</span>. Resuming continues from the same point in the
          sequence — it does not restart the campaign.
        </div>
      ) : null}

      {storedCheckList.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-800/65">
          <h3 className="font-semibold text-slate-900 dark:text-white">To-check list (last build)</h3>
          <p className="text-xs text-slate-500">Prospects skipped when variables were missing or filters applied.</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {storedCheckList.slice(0, 80).map((row, i) => (
              <li key={i}>
                <span className="font-mono text-slate-600">{row.siteUrl}</span> — {row.reason}
                {row.email ? ` (${row.email})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {senderPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 dark:bg-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select sender accounts</h3>
            <p className="mt-1 text-xs text-slate-500">Names and tags for this campaign. You can pick several.</p>
            <ul className="mt-4 space-y-2">
              {campaignSenderAccounts.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={senders.includes(a.id)}
                      onChange={() =>
                        setSenders((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))
                      }
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{a.displayName}</div>
                      <div className="text-xs text-slate-500">Tag: {a.tag}</div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setSenderPickerOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Basics</h2>
          <div>
            <label className={`block ${wizardFieldTitle}`}>Campaign name</label>
            <input
              className={`mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 ${
                isPausedFromRunning ? "cursor-not-allowed bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400" : ""
              }`}
              value={name}
              readOnly={isPausedFromRunning}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={`block ${wizardFieldTitle}`}>List</label>
            <select
              className={`mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 ${
                isPausedFromRunning ? "cursor-not-allowed bg-slate-100 text-slate-600 opacity-80 dark:bg-slate-800/50" : ""
              }`}
              value={listId}
              disabled={isPausedFromRunning}
              onChange={(e) => setListId(e.target.value)}
            >
              <option value="">Select…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/email-marketing/campaigns" className={wizardBackLinkClass}>
              ← Back
            </Link>
            <button
              type="button"
              className="btn-save-primary-sm inline-flex items-center gap-2"
              disabled={save.isPending}
              onClick={() => void goNext()}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? "Saving…" : "Next"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Senders</h2>

          {accountsQueryError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
              <p className="font-medium">Could not load email accounts</p>
              <p className="mt-1 text-xs opacity-90">
                {accountsQueryErr instanceof Error ? accountsQueryErr.message : "Unknown error"}
              </p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline"
                onClick={() => void refetchAccounts()}
              >
                Retry
              </button>
            </div>
          ) : null}

          <div>
            <label className={`block ${wizardFieldTitle}`}>Select sender accounts for this campaign</label>
            <div
              role="button"
              tabIndex={isPausedFromRunning ? -1 : 0}
              className={`mt-1.5 flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-sm outline-none dark:border-slate-600 dark:bg-slate-800 ${
                isPausedFromRunning
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer transition hover:border-slate-300 hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
              }`}
              onClick={(e) => {
                if (isPausedFromRunning) return;
                if ((e.target as HTMLElement).closest("[data-sender-chip-remove]")) return;
                setSenderPickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (isPausedFromRunning) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSenderPickerOpen(true);
                }
              }}
            >
              {senders.length === 0 ? (
                <span className="text-slate-400 dark:text-slate-500">None selected — click to add</span>
              ) : (
                accounts
                  .filter((a) => senders.includes(a.id))
                  .map((a) => (
                    <span
                      key={a.id}
                      className="group/chip inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200/90 bg-slate-100/95 pl-2 pr-0.5 py-0.5 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-700/90 dark:text-slate-100"
                    >
                      <span className="max-w-[14rem] truncate">
                        {a.displayName} ({a.tag})
                      </span>
                      <button
                        type="button"
                        data-sender-chip-remove
                        title="Remove"
                        className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-slate-200 hover:text-slate-900 group-hover/chip:opacity-100 dark:hover:bg-slate-600 dark:hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPausedFromRunning) return;
                          setSenders((prev) => prev.filter((id) => id !== a.id));
                        }}
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <p className={wizardFieldTitle}>Do not send to</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/40">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Unverified emails</span>
                <FormSwitch
                  on={flags.doNotSendUnverified}
                  onToggle={() => setFlags({ ...flags, doNotSendUnverified: !flags.doNotSendUnverified })}
                  aria-label="Do not send to unverified emails"
                  disabled={isPausedFromRunning}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/40">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Risky emails</span>
                <FormSwitch
                  on={flags.doNotSendRisky}
                  onToggle={() => setFlags({ ...flags, doNotSendRisky: !flags.doNotSendRisky })}
                  aria-label="Do not send to risky emails"
                  disabled={isPausedFromRunning}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/40">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Invalid emails</span>
                <FormSwitch
                  on={flags.doNotSendInvalid}
                  onToggle={() => setFlags({ ...flags, doNotSendInvalid: !flags.doNotSendInvalid })}
                  aria-label="Do not send to invalid emails"
                  disabled={isPausedFromRunning}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <p className={wizardFieldTitle}>If prospect has multiple emails</p>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              <label className={wizardOptionLabel}>
                <input
                  type="radio"
                  name="multiEmail"
                  checked={flags.multiEmailPolicy === "ALL"}
                  disabled={isPausedFromRunning}
                  onChange={() => setFlags({ ...flags, multiEmailPolicy: "ALL" })}
                />
                All emails
              </label>
              <label className={wizardOptionLabel}>
                <input
                  type="radio"
                  name="multiEmail"
                  checked={flags.multiEmailPolicy === "FIRST"}
                  disabled={isPausedFromRunning}
                  onChange={() => setFlags({ ...flags, multiEmailPolicy: "FIRST" })}
                />
                First email
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className={wizardFieldTitle}>Skip recipient added to other active campaigns</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  When enabled, recipients already in another running or scheduled campaign are skipped here.
                </p>
              </div>
              <FormSwitch
                on={flags.skipIfInOtherCampaign}
                onToggle={() => setFlags({ ...flags, skipIfInOtherCampaign: !flags.skipIfInOtherCampaign })}
                aria-label="Skip if recipient is in another active campaign"
                disabled={isPausedFromRunning}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <p className={wizardFieldTitle}>If a prospect has a missing merge variable</p>
            <div className="mt-2 space-y-2">
              <label className={wizardOptionLabel}>
                <input
                  type="radio"
                  name="missVar"
                  checked={flags.missingVariablePolicy === "TO_CHECK_LIST"}
                  disabled={isPausedFromRunning}
                  onChange={() => setFlags({ ...flags, missingVariablePolicy: "TO_CHECK_LIST" })}
                />
                Send to to-check list (do not send until resolved)
              </label>
              <label className={wizardOptionLabel}>
                <input
                  type="radio"
                  name="missVar"
                  checked={flags.missingVariablePolicy === "SEND_ANYWAY"}
                  disabled={isPausedFromRunning}
                  onChange={() => setFlags({ ...flags, missingVariablePolicy: "SEND_ANYWAY" })}
                />
                Send campaign anyway
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={wizardBackLinkClass} onClick={() => void persistBack()}>
              ← Back
            </button>
            <button
              type="button"
              className="btn-save-primary-sm inline-flex items-center gap-2"
              disabled={save.isPending}
              onClick={() => void goNext()}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? "Saving…" : "Next"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Sequence</h2>
          <p className="text-xs text-slate-500">
            Tap <strong>Start</strong>, add your first email, then use <strong>+ Add next step</strong> to add Email, Delay, or
            Follow-Ups. Delete appears when you hover a step.
          </p>
          <SequenceFlowEditor
            readOnly={isPausedFromRunning}
            variant="root"
            value={mainFlow}
            onChange={setMainFlow}
            templates={templates}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={wizardBackLinkClass} onClick={() => void persistBack()}>
              ← Back
            </button>
            <button
              type="button"
              className="btn-save-primary-sm inline-flex items-center gap-2"
              disabled={save.isPending}
              onClick={() => void goNext()}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? "Saving…" : "Next"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Schedule</h2>
          <div
            className={`rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55 ${
              isPausedFromRunning ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={`${wizardFieldTitle} mb-1`}>Start campaign now and ignore schedule</p>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  When this is on, the scheduled date below is ignored for the first send window.
                </p>
              </div>
              <FormSwitch
                on={ignoreSchedule}
                onToggle={() => setIgnoreSchedule((v) => !v)}
                aria-label="Start campaign now and ignore schedule"
                disabled={isPausedFromRunning}
              />
            </div>
          </div>
          <div
            className={`${ignoreSchedule ? "pointer-events-none opacity-50" : ""} ${
              isPausedFromRunning ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <label className={`block ${wizardFieldTitle}`}>Schedule start (local date &amp; time)</label>
            <input
              type="datetime-local"
              disabled={ignoreSchedule || isPausedFromRunning}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              value={scheduleLocal}
              onChange={(e) => setScheduleLocal(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={wizardFieldTitle}>Stop campaign for the company on an early reply</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  When enabled, further emails to that prospect stop if they reply.
                </p>
              </div>
              <FormSwitch
                on={flags.stopCampaignOnCompanyReply}
                onToggle={() =>
                  setFlags({ ...flags, stopCampaignOnCompanyReply: !flags.stopCampaignOnCompanyReply })
                }
                aria-label="Stop campaign when the company replies early"
                disabled={isPausedFromRunning}
              />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-800/55">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={wizardFieldTitle}>Stop follow-ups for prospects who replied</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  When enabled, follow-up emails stop for prospects who reply after a follow-up has started.
                </p>
              </div>
              <FormSwitch
                on={flags.stopFollowUpsOnReply}
                onToggle={() => setFlags({ ...flags, stopFollowUpsOnReply: !flags.stopFollowUpsOnReply })}
                aria-label="Stop follow-ups for prospects who replied"
                disabled={isPausedFromRunning}
              />
            </div>
          </div>
          <div>
            <label className={`block ${wizardFieldTitle}`}>Daily sending limit for this campaign</label>
            <p className="mt-0.5 max-w-md text-xs text-slate-500 dark:text-slate-400">
              Optional cap on total sends per UTC day for this campaign. Leave empty to use only each sender account’s daily
              limit (whichever is stricter applies first).
            </p>
            <input
              type="number"
              min={1}
              placeholder="e.g. 100"
              className="mt-1.5 w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              value={flags.dailyCampaignLimit === "" ? "" : flags.dailyCampaignLimit}
              onChange={(e) => setFlags({ ...flags, dailyCampaignLimit: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={wizardBackLinkClass} onClick={() => void persistBack()}>
              ← Back
            </button>
            <button
              type="button"
              className="btn-save-primary-sm inline-flex items-center gap-2"
              disabled={save.isPending}
              onClick={() => void goNext()}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {save.isPending ? "Saving…" : "Next"}
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Review</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isPausedFromRunning ? (
              <>
                Review only — other fields are locked. Adjust the <strong>daily campaign limit</strong> in Schedule or below, then
                use <strong>Save changes</strong>.
              </>
            ) : (
              <>
                Full campaign summary before you save or run. If anything looks wrong, use <strong>Back</strong> to fix the earlier
                steps.
              </>
            )}
          </p>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-600 dark:bg-slate-800/55">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Basics</h3>
              <dl className="mt-2 space-y-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Campaign name</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{name.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">List</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {lists.find((l) => l.id === listId)?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Senders</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{senderSummary}</dd>
                </div>
              </dl>
            </section>

            <hr className="border-slate-200 dark:border-slate-600" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Recipients &amp; safety
              </h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Do not send to </span>
                  {doNotSendSummary}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Multiple emails per prospect: </span>
                  {multiEmailSummary}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Skip if in another active campaign: </span>
                  {flags.skipIfInOtherCampaign ? "Yes" : "No"}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Missing merge variable: </span>
                  {missingVarSummary}
                </li>
              </ul>
            </section>

            <hr className="border-slate-200 dark:border-slate-600" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sequence</h3>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Same layout as the Sequence step (read-only preview).</p>
              <div className="mt-2 max-h-[min(28rem,70vh)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-100 bg-slate-50/80 px-1 py-2 dark:border-slate-600/80 dark:bg-slate-900/40">
                <SequenceFlowEditor readOnly variant="root" value={mainFlow} onChange={() => {}} templates={templates} />
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-600" />

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Schedule &amp; limits</h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Schedule: </span>
                  {scheduleSummary}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Stop campaign for the company on an early reply: </span>
                  {flags.stopCampaignOnCompanyReply ? "Yes" : "No"}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Stop follow-ups for prospects who replied: </span>
                  {flags.stopFollowUpsOnReply ? "Yes" : "No"}
                </li>
                <li>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Daily campaign limit: </span>
                  {isPausedFromRunning ? (
                    <span className="mt-2 block">
                      <input
                        type="number"
                        min={1}
                        placeholder="e.g. 100"
                        className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                        value={flags.dailyCampaignLimit === "" ? "" : flags.dailyCampaignLimit}
                        onChange={(e) =>
                          setFlags({ ...flags, dailyCampaignLimit: e.target.value === "" ? "" : Number(e.target.value) })
                        }
                      />
                      <span className="mt-1 block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        {dailyLimitSummary}
                      </span>
                    </span>
                  ) : (
                    dailyLimitSummary
                  )}
                </li>
              </ul>
            </section>
          </div>

          {isPausedFromRunning ? null : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/40">
            <h3 className="text-sm font-semibold">Validate recipients (optional)</h3>
            <button
              type="button"
              className="mt-2 rounded-lg border border-cyan-600 px-3 py-1.5 text-sm text-cyan-700 disabled:opacity-50 dark:text-cyan-300"
              disabled={build.isPending}
              onClick={() => void build.mutate()}
            >
              {build.isPending ? "Building…" : "Build / refresh check list"}
            </button>
            {build.data ? (
              <p className="mt-2 text-xs">
                Last build: <strong>{build.data.created}</strong> recipient row(s). Check list entries:{" "}
                <strong>{build.data.checkList.length}</strong>.
              </p>
            ) : null}
            {build.data?.checkList?.length ? (
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
                {build.data.checkList.slice(0, 40).map((row, i) => (
                  <li key={i}>
                    {row.siteUrl} — {row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className={wizardBackLinkClass} onClick={() => void persistBack()}>
              ← Back
            </button>
            {isPausedFromRunning ? (
              <button
                type="button"
                className="btn-save-primary-sm inline-flex items-center gap-2"
                disabled={!canUseReviewSaves || !!reviewAction || save.isPending}
                onClick={() => void savePausedFromRunningOnly()}
              >
                {reviewAction === "save" && save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {reviewPausedOnlySaveLabel}
              </button>
            ) : reviewUsesScheduledStart ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1 text-sm font-medium text-white shadow-sm disabled:opacity-40 dark:border-indigo-500 dark:bg-indigo-600"
                disabled={
                  !canUseReviewSaves ||
                  !!reviewAction ||
                  save.isPending ||
                  startCamp.isPending ||
                  camp?.status === "COMPLETED"
                }
                title="Save schedule — campaign will start at the scheduled date/time"
                onClick={() => void onReviewSaveSchedule()}
              >
                {reviewAction === "schedule" && (startCamp.isPending || save.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {reviewSchedulePendingLabel}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-save-primary-sm inline-flex items-center gap-2"
                  disabled={!canUseReviewSaves || !!reviewAction || save.isPending}
                  onClick={() => void onReviewSaveDraft()}
                >
                  {reviewAction === "save" && save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {reviewSavePendingLabel}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1 text-sm font-medium text-white shadow-sm disabled:opacity-40 dark:border-emerald-500 dark:bg-emerald-600"
                  disabled={
                    !canUseReviewSaves ||
                    !!reviewAction ||
                    save.isPending ||
                    startCamp.isPending ||
                    newRunPending ||
                    camp?.status === "RUNNING" ||
                    camp?.status === "COMPLETED"
                  }
                  title="Run campaign now (builds recipients from the list)"
                  onClick={() => void onReviewRunNow()}
                >
                  {reviewAction === "run" && (startCamp.isPending || save.isPending || newRunPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {reviewRunPendingLabel}
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
