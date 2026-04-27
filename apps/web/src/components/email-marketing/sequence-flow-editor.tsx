"use client";

import { useState } from "react";
import { Clock, GitBranch, Info, Mail, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { FlowEmailTemplateSelect } from "@/components/email-flow-email-select";
import { NativeNumberInput } from "@/components/native-number-input";
import { cn } from "@/lib/utils";
import { newFlowId, type MainFlowStep } from "@/lib/campaign-flow";

type Tpl = { id: string; name: string; folder: { name: string } };

const FOLLOWUP_SETUP_ALERT =
  'First select after which email the follow-ups should start and how many days to wait. Go to the "Follow-Ups" field and select the email and wait days.';

const flowCard =
  "relative rounded-xl border border-sky-300/50 bg-white shadow-sm dark:border-sky-500/35 dark:bg-slate-800/95";

const dottedCanvas =
  "rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-4 dark:border-slate-600 dark:bg-slate-900/40 [background-image:radial-gradient(circle_at_1px_1px,rgb(148_163_184/0.35)_1px,transparent_0)] [background-size:14px_14px] dark:[background-image:radial-gradient(circle_at_1px_1px,rgb(71_85_105/0.5)_1px,transparent_0)]";

const flowLine = "bg-violet-500/55 dark:bg-violet-400/45";
const flowArrowHead = "border-t-violet-500/65 dark:border-t-violet-400/50";

function newEmail(): MainFlowStep {
  return { id: newFlowId(), t: "email", templateId: "" };
}

function newDelay(): MainFlowStep {
  return { id: newFlowId(), t: "delay", days: 2 };
}

function newCondition(): MainFlowStep {
  return {
    id: newFlowId(),
    t: "condition",
    kind: "follow_ups",
    afterEmailIndex: 0,
    waitDays: 0,
    configComplete: false,
    yes: [],
    no: [],
  };
}

function replaceAt(steps: MainFlowStep[], index: number, node: MainFlowStep): MainFlowStep[] {
  return steps.map((s, i) => (i === index ? node : s));
}

function removeAt(steps: MainFlowStep[], index: number): MainFlowStep[] {
  return steps.filter((_, i) => i !== index);
}

function emailStepsBeforeIndex(steps: MainFlowStep[], endExclusive: number): number {
  let n = 0;
  for (let i = 0; i < endExclusive && i < steps.length; i++) {
    if (steps[i]!.t === "email") n++;
  }
  return n;
}

function FlowArrowDown({ short, className }: { short?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", short ? "py-1" : "py-2", className)} aria-hidden>
      <div className={cn("w-0.5 rounded-full", short ? "h-4" : "h-8", flowLine)} />
      <div className={cn("h-0 w-0 border-x-[7px] border-x-transparent border-t-[8px]", flowArrowHead)} />
    </div>
  );
}

function AddNextStepMenu({
  onPick,
  label = "+ Add next step",
  compact,
  blockReason,
  onBlocked,
}: {
  onPick: (k: "email" | "delay" | "condition") => void;
  label?: string;
  compact?: boolean;
  blockReason?: string | null;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const disabled = Boolean(blockReason);
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        title={blockReason ?? undefined}
        className={cn(
          "font-semibold text-indigo-600 underline decoration-indigo-400 dark:text-indigo-400",
          "whitespace-nowrap",
          compact ? "text-[10px]" : "text-xs",
          disabled && "cursor-not-allowed opacity-40 no-underline",
        )}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            onBlocked?.();
            return;
          }
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open && !disabled ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-full z-20 mt-1 w-max min-w-[9rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            {(["email", "delay", "condition"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[11px] capitalize hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  onPick(k);
                  setOpen(false);
                }}
              >
                {k === "email" ? "Email" : k === "delay" ? "Delay" : "Follow-ups"}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function FollowUpsSettingsPopover() {
  return (
    <div className="max-w-xs space-y-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
      <p>
        <span className="font-semibold text-slate-800 dark:text-slate-100">Follow-Ups</span> — after the wait period from the
        anchor email, recipients are split:
      </p>
      <p>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Opened but not replied</span>: they received
        and opened, but have not replied — use this path for further emails.
      </p>
      <p>
        <span className="font-semibold text-rose-700 dark:text-rose-400">Not opened</span>: email was delivered (100%) but
        they have not opened — use this path.
      </p>
    </div>
  );
}

export type SequenceVariant = "root" | "nested" | "followExtension" | "branch";

type SequenceFlowEditorProps = {
  value: MainFlowStep[];
  onChange: (next: MainFlowStep[]) => void;
  templates: Tpl[];
  variant: SequenceVariant;
  readOnly?: boolean;
  blockAdd?: string | null;
  onAddBlocked?: () => void;
};

export function SequenceFlowEditor({
  value,
  onChange,
  templates,
  variant,
  readOnly = false,
  blockAdd = null,
  onAddBlocked,
}: SequenceFlowEditorProps) {
  const { showAlert } = useAppDialog();
  const isRoot = variant === "root";
  const isFollowExt = variant === "followExtension";
  const isBranch = variant === "branch";
  const flowStarted = value.length > 0;

  // Root canvas needs to allow wide Follow-Ups node (condition card).
  const innerMax = isFollowExt
    ? "max-w-[220px]"
    : isBranch
      ? "max-w-[220px]"
      : isRoot
        ? "max-w-[min(100%,400px)]"
        : "max-w-[280px]";

  const last = value.length ? value[value.length - 1]! : null;
  const addBlockForEmail =
    last?.t === "email" && !last.templateId.trim()
      ? "Select a template in the email step above, then you can add the next step."
      : null;
  const addBlock = blockAdd || addBlockForEmail;

  if (isRoot && !flowStarted) {
    if (readOnly) {
      return (
        <div className={cn("flex min-h-[8rem] flex-col items-center justify-center text-sm text-slate-500", dottedCanvas)}>
          No sequence
        </div>
      );
    }
    return (
      <div className={cn("flex min-h-[10rem] flex-col items-center justify-center", dottedCanvas)}>
        <button
          type="button"
          className="rounded-full bg-emerald-500 px-10 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          onClick={() => onChange([newEmail()])}
        >
          Start
        </button>
      </div>
    );
  }

  if (isFollowExt && !flowStarted) {
    if (readOnly) return null;
    return (
      <div className={cn("mx-auto flex w-full flex-col items-center", innerMax)}>
        <AddNextStepMenu
          compact
          blockReason={addBlock}
          onBlocked={onAddBlocked}
          onPick={(k) => {
            const node = k === "email" ? newEmail() : k === "delay" ? newDelay() : newCondition();
            onChange([node]);
          }}
        />
      </div>
    );
  }

  const showTopStartRail = isRoot && flowStarted;
  const useCanvas = isRoot;
  const followExtBare = isFollowExt && flowStarted;
  const branchLike = isBranch;
  const lastStep = value.length > 0 ? value[value.length - 1] : null;
  const hideTrailingAddAfterCondition = !branchLike && lastStep?.t === "condition";

  const inner = (
    <div
      className={cn(
        "mx-auto flex w-full flex-col items-center",
        isFollowExt || branchLike || useCanvas ? innerMax : "max-w-[260px]",
      )}
    >
      {showTopStartRail ? (
        <>
          <div className="pointer-events-none rounded-full bg-sky-500/20 px-8 py-1.5 text-xs font-semibold text-sky-800 opacity-80 dark:text-sky-200">
            Start
          </div>
          <FlowArrowDown />
        </>
      ) : null}

      {value.map((s, i) => (
        <div key={s.id} className="group/step relative flex w-full flex-col items-center">
          {i > 0 ? <FlowArrowDown className={isFollowExt ? "pt-1" : undefined} /> : null}
          {s.t === "email" ? (
            <div
              className={cn(
                "relative w-full min-w-0 rounded-xl p-0",
                branchLike ? "max-w-full" : "max-w-[240px]",
                flowCard,
              )}
            >
              <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100/90 px-2 py-0.5 text-[9px] font-semibold text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">
                  <Mail className="h-2.5 w-2.5" aria-hidden />
                  Email
                </span>
              </div>
              <div className="min-w-0 overflow-hidden px-2 pb-2 pt-4">
                <FlowEmailTemplateSelect
                  value={s.templateId}
                  templates={templates}
                  flowCardClass="w-full rounded-lg border-0 bg-transparent shadow-none"
                  emptyLabel="select template"
                  showEmailPill={false}
                  compact
                  readOnly={readOnly}
                  onChange={(templateId) => onChange(replaceAt(value, i, { ...s, templateId }))}
                />
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  title="Remove step"
                  className="absolute right-0.5 top-6 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
                  onClick={() => onChange(removeAt(value, i))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          {s.t === "delay" ? (
            <div
              className={cn(
                "relative w-full min-w-0 rounded-xl border border-amber-200/80 bg-amber-50/50 px-2 pb-2.5 pt-3.5 text-center dark:border-amber-900/50 dark:bg-amber-950/30",
                branchLike ? "max-w-full" : "max-w-[200px]",
                flowCard,
              )}
            >
              <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-semibold text-amber-950 dark:bg-amber-900/50 dark:text-amber-100">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  Delay
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Wait up to{" "}
                {readOnly ? (
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{s.days}</span>
                ) : (
                  <NativeNumberInput
                    className="mx-0.5 inline-block w-11 align-middle text-[11px]"
                    min={0}
                    value={s.days}
                    onChange={(n) => onChange(replaceAt(value, i, { ...s, days: n ?? 0 }))}
                    aria-label="Delay days"
                  />
                )}{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100"> days</span>
              </p>
              {!readOnly ? (
                <button
                  type="button"
                  title="Remove step"
                  className="absolute right-0.5 top-0.5 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
                  onClick={() => onChange(removeAt(value, i))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          {s.t === "condition" ? (
            <ConditionStep
              s={s}
              mainSpine={value}
              selfIndex={i}
              onUpdate={(next) => onChange(replaceAt(value, i, next))}
              onRemove={() => onChange(removeAt(value, i))}
              templates={templates}
              readOnly={readOnly}
            />
          ) : null}
        </div>
      ))}

      {readOnly || hideTrailingAddAfterCondition ? null : !(branchLike && value.length === 0) ? (
        <FlowArrowDown className={isFollowExt ? "pt-1" : undefined} />
      ) : null}
      {readOnly || hideTrailingAddAfterCondition ? null : (
        <div className={cn("flex w-full flex-col items-center", isFollowExt ? "mt-0.5" : undefined)}>
          <AddNextStepMenu
            compact={isFollowExt || branchLike}
            blockReason={addBlock}
            onBlocked={onAddBlocked ?? (() => void showAlert(blockAdd || "Complete the step above first."))}
            onPick={(k) => {
              if (k === "condition" && !value.some((x) => x.t === "email")) {
                void showAlert("Add at least one email step before you add Follow-Ups.");
                return;
              }
              const node = k === "email" ? newEmail() : k === "delay" ? newDelay() : newCondition();
              onChange([...value, node]);
            }}
          />
        </div>
      )}
    </div>
  );

  if (branchLike) {
    return <div className={cn("flex w-full flex-col items-center", innerMax)}>{inner}</div>;
  }

  if (followExtBare) {
    return <div className={cn("flex w-full flex-col items-center", innerMax)}>{inner}</div>;
  }

  return (
    <div
      className={cn(
        useCanvas
          ? dottedCanvas
          : "rounded-lg border border-slate-200/80 bg-slate-50/80 px-1.5 py-2 dark:border-slate-600 dark:bg-slate-800/50",
      )}
    >
      {inner}
    </div>
  );
}

const ordinal = (i: number) => {
  const o = [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "5th",
    "6th",
    "7th",
    "8th",
    "9th",
    "10th",
    "11th",
    "12th",
    "13th",
    "14th",
  ];
  return o[i] ?? `${i + 1}th`;
};

function ConditionStep({
  s,
  mainSpine,
  selfIndex,
  onUpdate,
  onRemove,
  templates: _tpl,
  readOnly,
}: {
  s: Extract<MainFlowStep, { t: "condition" }>;
  mainSpine: MainFlowStep[];
  selfIndex: number;
  onUpdate: (next: MainFlowStep) => void;
  onRemove: () => void;
  templates: Tpl[];
  readOnly: boolean;
}) {
  const { showAlert } = useAppDialog();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const nEmailsBefore = emailStepsBeforeIndex(mainSpine, selfIndex);
  const safeAfter = Math.min(Math.max(0, s.afterEmailIndex ?? 0), Math.max(0, nEmailsBefore - 1));
  const waitDays = Math.min(14, Math.max(0, s.waitDays ?? 0));
  const hasBranchContent = (s.yes?.length ?? 0) + (s.no?.length ?? 0) > 0;
  const waitValid = waitDays >= 1;
  const followConfigured =
    nEmailsBefore > 0 && waitValid && (Boolean(s.configComplete) || hasBranchContent || readOnly);
  const blockChildAdds = nEmailsBefore > 0 && (!followConfigured || !waitValid) && !readOnly;
  const displayBefore = nEmailsBefore > 0 ? safeAfter : 0;
  return (
    <div className="group/step relative mx-auto w-full max-w-[min(100%,400px)]">
      <div className="mx-auto w-full max-w-[400px] px-2 sm:px-0">
        <div
          className={cn(
            "relative rounded-xl border border-pink-200/80 bg-white px-3 pb-4 pt-3.5 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800/90",
            flowCard,
          )}
        >
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[9px] font-semibold text-fuchsia-900 dark:bg-fuchsia-900/50 dark:text-fuchsia-100">
              <GitBranch className="h-2.5 w-2.5" aria-hidden />
              Follow-Ups
            </span>
          </div>
          <div className="mt-1 inline-flex max-w-full items-center justify-center gap-0.5 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-medium text-violet-950 dark:bg-violet-950/50 dark:text-violet-100">
            <span className="font-semibold">Wait</span>
            {readOnly ? (
              <span className="font-bold tabular-nums">{waitDays}</span>
            ) : (
              <NativeNumberInput
                className="w-12 text-[10px] tabular-nums"
                min={0}
                max={14}
                value={waitDays}
                onChange={(n) => {
                  const v = Math.min(14, Math.max(0, n ?? 0));
                  onUpdate({ ...s, waitDays: v, configComplete: nEmailsBefore > 0 && v >= 1 });
                }}
                aria-label="Wait days"
              />
            )}
            <span>days after</span>
            {nEmailsBefore === 0 ? (
              <span className="text-amber-700 dark:text-amber-300">(add an email first)</span>
            ) : readOnly ? (
              <span className="font-semibold">{ordinal(displayBefore)} email</span>
            ) : (
              <select
                className="max-w-[9rem] rounded border border-violet-200 bg-white px-1 py-0.5 text-[9px] dark:border-violet-900/60 dark:bg-slate-900"
                value={String(displayBefore)}
                onChange={(e) => {
                  const v = Math.min(Math.max(0, Number(e.target.value)), nEmailsBefore - 1);
                  onUpdate({ ...s, afterEmailIndex: v, configComplete: waitDays >= 1 });
                }}
                aria-label="After which email"
              >
                {Array.from({ length: nEmailsBefore }, (_, j) => (
                  <option key={j} value={j}>
                    {ordinal(j)} email
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 items-center gap-x-3 px-1">
            <div className="justify-self-start">
              <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                Not opened
              </span>
            </div>
            <div className="justify-self-end">
              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                Opened but not replied
              </span>
            </div>
          </div>
          {!readOnly ? (
            <div className="absolute right-0.5 top-1 z-20 flex items-center gap-0.5">
              <button
                type="button"
                className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 dark:border-slate-600 dark:bg-slate-800"
                aria-label="Help"
                onClick={() => setSettingsOpen((o) => !o)}
              >
                <Info className="h-3 w-3" />
              </button>
            </div>
          ) : null}
          {settingsOpen && !readOnly ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                aria-label="Close"
                onClick={() => setSettingsOpen(false)}
              />
              <div className="absolute right-0 top-full z-40 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-600 dark:bg-slate-800">
                <FollowUpsSettingsPopover />
                <button
                  type="button"
                  className="mt-2 w-full rounded-md bg-slate-100 py-1.5 text-[11px] font-medium dark:bg-slate-800"
                  onClick={() => setSettingsOpen(false)}
                >
                  Done
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {nEmailsBefore > 0 ? (
        <div className="mt-2 w-full">
          <div className="mx-auto grid w-full min-w-0 max-w-[400px] grid-cols-2 gap-x-3">
            <div className="flex w-full min-w-0 flex-col items-start">
              <div className="ml-1 flex flex-col items-center" aria-hidden>
                <div className={cn("h-9 w-0.5 rounded-full", flowLine)} />
                <div className={cn("h-0 w-0 border-x-[6px] border-x-transparent border-t-[7px]", flowArrowHead)} />
              </div>
              <div className="ml-1 flex w-max justify-start">
                <SequenceFlowEditor
                  readOnly={readOnly}
                  variant="branch"
                  value={s.no}
                  templates={_tpl}
                  onChange={(no) => onUpdate({ ...s, no })}
                  blockAdd={blockChildAdds ? FOLLOWUP_SETUP_ALERT : null}
                  onAddBlocked={() => void showAlert(FOLLOWUP_SETUP_ALERT)}
                />
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-col items-end">
              <div className="mr-1 flex flex-col items-center" aria-hidden>
                <div className={cn("h-9 w-0.5 rounded-full", flowLine)} />
                <div className={cn("h-0 w-0 border-x-[6px] border-x-transparent border-t-[7px]", flowArrowHead)} />
              </div>
              <div className="mr-1 flex w-max justify-end">
                <SequenceFlowEditor
                  readOnly={readOnly}
                  variant="branch"
                  value={s.yes}
                  templates={_tpl}
                  onChange={(yes) => onUpdate({ ...s, yes })}
                  blockAdd={blockChildAdds ? FOLLOWUP_SETUP_ALERT : null}
                  onAddBlocked={() => void showAlert(FOLLOWUP_SETUP_ALERT)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : !readOnly ? (
        <p className="mt-2 text-center text-[10px] text-amber-700 dark:text-amber-300">
          Add at least one email above before branches appear.
        </p>
      ) : null}

      {!readOnly ? (
        <button
          type="button"
          title="Remove step"
          className="absolute -right-1 -top-1 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
