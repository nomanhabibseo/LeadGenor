"use client";

import { useState } from "react";
import { Clock, GitBranch, Info, Mail, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { FlowEmailTemplateSelect } from "@/components/email-flow-email-select";
import { NativeNumberInput } from "@/components/native-number-input";
import { cn } from "@/lib/utils";
import { newFlowId, type MainFlowStep } from "@/lib/campaign-flow";

type Tpl = { id: string; name: string; folder: { name: string } };

const flowCanvasBg =
  "rounded-2xl border border-sky-400/60 bg-slate-100/90 px-3 py-4 dark:border-sky-500/40 dark:bg-slate-800/55";
const flowCard =
  "relative border border-sky-400/75 bg-white shadow-sm dark:border-sky-500/50 dark:bg-slate-800/95";
const flowLine = "bg-slate-500 dark:bg-slate-400";

function newEmail(): MainFlowStep {
  return { id: newFlowId(), t: "email", templateId: "" };
}

function newDelay(): MainFlowStep {
  return { id: newFlowId(), t: "delay", days: 2 };
}

function newCondition(): MainFlowStep {
  return { id: newFlowId(), t: "condition", kind: "opened_email", waitDays: 3, yes: [], no: [] };
}

function replaceAt(steps: MainFlowStep[], index: number, node: MainFlowStep): MainFlowStep[] {
  return steps.map((s, i) => (i === index ? node : s));
}

function removeAt(steps: MainFlowStep[], index: number): MainFlowStep[] {
  return steps.filter((_, i) => i !== index);
}

function FlowArrowDown({ short, className }: { short?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", short ? "py-1" : "py-2", className)} aria-hidden>
      <div className={cn("w-0.5 rounded-full", short ? "h-4" : "h-7", flowLine)} />
      <div className="h-0 w-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-slate-500 dark:border-t-slate-400" />
    </div>
  );
}

function AddNextStepMenu({
  onPick,
  label = "+ Add next step",
  compact,
}: {
  onPick: (k: "email" | "delay" | "condition") => void;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        className={cn(
          "font-semibold text-indigo-600 underline decoration-indigo-400 dark:text-indigo-400",
          compact ? "text-[10px]" : "text-xs",
        )}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
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
                {k === "email" ? "Email" : k === "delay" ? "Delay" : "Condition"}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConditionSettingsPopover() {
  return (
    <div className="max-w-xs space-y-2 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
      <p>
        <span className="font-semibold text-slate-800 dark:text-slate-100">Opened email</span> — condition is evaluated after
        the recipient opens the tracked email.
      </p>
      <p>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Yes path</span>: opened prior emails, clicked a
        link in the message, and has not replied — follow this branch after the wait.
      </p>
      <p>
        <span className="font-semibold text-red-700 dark:text-red-400">No path</span>: opened but did not click a link — follow
        this branch after the wait.
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
};

export function SequenceFlowEditor({ value, onChange, templates, variant }: SequenceFlowEditorProps) {
  const { showConfirm } = useAppDialog();
  const isRoot = variant === "root";
  const isFollowExt = variant === "followExtension";
  const isBranch = variant === "branch";
  const flowStarted = value.length > 0;

  const innerMax = isFollowExt ? "max-w-[220px]" : isBranch ? "max-w-full" : "max-w-[280px]";

  if (isRoot && !flowStarted) {
    return (
      <div className={cn("flex min-h-[10rem] flex-col items-center justify-center", flowCanvasBg)}>
        <button
          type="button"
          className="rounded-full bg-emerald-400 px-10 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-emerald-500"
          onClick={() => onChange([newEmail()])}
        >
          Start
        </button>
      </div>
    );
  }

  if (isFollowExt && !flowStarted) {
    return (
      <div className={cn("mx-auto flex w-full flex-col items-center", innerMax)}>
        <AddNextStepMenu
          compact
          onPick={(k) => {
            const node = k === "email" ? newEmail() : k === "delay" ? newDelay() : newCondition();
            onChange([node]);
          }}
        />
      </div>
    );
  }

  const showTopStartRail = isRoot && flowStarted;
  /** Main sequence only: big canvas. Follow-up steps use plain layout so arrows + add sit below each card, not inside one panel. */
  const useCanvas = isRoot;
  const followExtBare = isFollowExt && flowStarted;
  const branchLike = isBranch;
  const lastStep = value.length > 0 ? value[value.length - 1] : null;
  /** After a condition, new steps attach only on Yes / No branches — not on the main spine. */
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
          <div className="pointer-events-none rounded-full bg-emerald-400 px-8 py-1.5 text-xs font-semibold text-slate-900 opacity-60">
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
                "w-full min-w-0 rounded-xl",
                branchLike ? "max-w-full" : "max-w-[220px]",
                flowCard,
              )}
            >
              <div className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-200 px-2 py-0.5 text-[9px] font-semibold text-sky-950 dark:bg-sky-900/80 dark:text-sky-100">
                  <Mail className="h-2.5 w-2.5" aria-hidden />
                  Email
                </span>
              </div>
              <div className="min-w-0 overflow-hidden px-2 pb-2 pt-3">
                <FlowEmailTemplateSelect
                  value={s.templateId}
                  templates={templates}
                  flowCardClass="w-full rounded-lg border-0 bg-transparent shadow-none"
                  emptyLabel="no subject"
                  showEmailPill={false}
                  compact
                  onChange={(templateId) => onChange(replaceAt(value, i, { ...s, templateId }))}
                />
              </div>
              <button
                type="button"
                title="Remove step"
                className="absolute right-0.5 top-0.5 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
                onClick={() =>
                  void (async () => {
                    if (!(await showConfirm("Remove this email step?"))) return;
                    onChange(removeAt(value, i));
                  })()
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {s.t === "delay" ? (
            <div
              className={cn(
                "relative w-full min-w-0 rounded-xl px-2 pb-2.5 pt-3.5 text-center",
                branchLike ? "max-w-full" : "max-w-[200px]",
                flowCard,
              )}
            >
              <div className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-semibold text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  Delay
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Wait up to{" "}
                <NativeNumberInput
                  className="mx-0.5 inline-block w-11 align-middle text-[11px]"
                  min={0}
                  value={s.days}
                  onChange={(n) => onChange(replaceAt(value, i, { ...s, days: n ?? 0 }))}
                  aria-label="Delay days"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100"> days</span>
              </p>
              <button
                type="button"
                title="Remove step"
                className="absolute right-0.5 top-0.5 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
                onClick={() =>
                  void (async () => {
                    if (!(await showConfirm("Remove this delay step?"))) return;
                    onChange(removeAt(value, i));
                  })()
                }
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : null}

          {s.t === "condition" ? (
            <ConditionStep
              s={s}
              onUpdate={(next) => onChange(replaceAt(value, i, next))}
              onRemove={() => onChange(removeAt(value, i))}
              templates={templates}
            />
          ) : null}
        </div>
      ))}

      {hideTrailingAddAfterCondition ? null : !(branchLike && value.length === 0) ? (
        <FlowArrowDown className={isFollowExt ? "pt-1" : undefined} />
      ) : null}
      {hideTrailingAddAfterCondition ? null : (
        <div className={cn("flex w-full flex-col items-center", isFollowExt ? "mt-0.5" : undefined)}>
          <AddNextStepMenu
            compact={isFollowExt || branchLike}
            onPick={(k) => {
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

  return <div className={cn(useCanvas ? flowCanvasBg : "rounded-lg border border-sky-400/50 bg-slate-100/80 px-1.5 py-2 dark:border-slate-600 dark:bg-slate-800/50")}>{inner}</div>;
}

function ConditionStep({
  s,
  onUpdate,
  onRemove,
  templates,
}: {
  s: Extract<MainFlowStep, { t: "condition" }>;
  onUpdate: (next: MainFlowStep) => void;
  onRemove: () => void;
  templates: Tpl[];
}) {
  const { showConfirm } = useAppDialog();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wd = s.waitDays ?? 3;

  return (
    <div className="group/step relative w-full max-w-[min(100%,42rem)]">
      <div className="mx-auto w-full max-w-[260px]">
        <div
          className={cn(
            "relative rounded-lg border border-slate-200/90 bg-white px-2 pb-2 pt-3 text-center shadow-sm dark:border-slate-600 dark:bg-slate-800/88",
            flowCard,
          )}
        >
        <div className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-200 px-2 py-0.5 text-[9px] font-semibold text-pink-950 dark:bg-pink-950/50 dark:text-pink-100">
            <GitBranch className="h-2.5 w-2.5" aria-hidden />
            Condition
          </span>
        </div>

        <div className="relative px-1 pt-1">
          <div className="flex flex-col items-center justify-center gap-0.5">
            <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">Opened email</p>
            <div className="flex items-center justify-center gap-1 text-[10px] text-slate-600 dark:text-slate-300">
              <span>wait</span>
              <NativeNumberInput
                className="w-10 text-[10px]"
                min={0}
                value={wd}
                onChange={(n) => onUpdate({ ...s, waitDays: n ?? (s.waitDays ?? 3) })}
                aria-label="Wait days after open"
              />
              <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">days</span>
            </div>
          </div>

          <div className="relative mt-2 flex justify-between px-1">
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">No</span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Yes</span>
          </div>

          <div className="absolute right-0 top-0">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white p-0.5 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
              aria-label="Condition details"
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <Info className="h-3 w-3" />
            </button>
            {settingsOpen ? (
              <>
                <button type="button" className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 top-full z-40 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-600 dark:bg-slate-800">
                  <ConditionSettingsPopover />
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
        </div>
      </div>

      <div className="mt-2 w-full px-0.5">
        <div className="grid w-full grid-cols-2 gap-6 sm:gap-10">
          <div className="flex min-w-0 flex-col items-center">
            <FlowArrowDown short />
            <SequenceFlowEditor variant="branch" value={s.no} templates={templates} onChange={(no) => onUpdate({ ...s, no })} />
          </div>
          <div className="flex min-w-0 flex-col items-center">
            <FlowArrowDown short />
            <SequenceFlowEditor variant="branch" value={s.yes} templates={templates} onChange={(yes) => onUpdate({ ...s, yes })} />
          </div>
        </div>
      </div>

      <button
        type="button"
        title="Remove step"
        className="absolute -right-1 -top-1 z-20 rounded border border-slate-200 bg-white p-0.5 text-red-600 opacity-0 shadow-sm transition hover:bg-red-50 group-hover/step:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-red-950/40"
        onClick={() =>
          void (async () => {
            if (!(await showConfirm("Remove this condition step?"))) return;
            onRemove();
          })()
        }
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
