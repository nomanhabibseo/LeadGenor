/** UI flow nodes for campaign main sequence (Step 3). Compiled to API `ChainStep[]` for sending. */

export type MainFlowStep =
  | { id: string; t: "email"; templateId: string }
  | { id: string; t: "delay"; days: number }
  | {
      id: string;
      t: "condition";
      /**
       * Follow-Ups: after Nth main-sequence email (0 = 1st) + wait, branch by engagement.
       * `yes` = opened but not replied; `no` = delivered and not opened.
       */
      kind?: "follow_ups" | "opened_email";
      /** 0 = 1st email in spine before this node, 1 = 2nd, … */
      afterEmailIndex?: number;
      /** Wait this many days after the anchor email (0–14), then start branch sends. */
      waitDays?: number;
      /** User finished wait + email anchor in the card (enables + next on branches). */
      configComplete?: boolean;
      /** Legacy: opened_email without anchor; use yes/no as before. */
      yes: MainFlowStep[];
      no: MainFlowStep[];
    };

export type ChainStep = { templateId: string; delayDaysBeforeNext: number };

/** Stored in `Campaign.followUpStartRule` when the sequence uses a Follow-Ups condition node. */
export type FollowUpRuleV2 = {
  v: 2;
  waitDays: number;
  /** 0-based index into main `ChainStep[]` — wait starts after this email is sent. */
  afterEmailIndex: number;
  /** Right column in UI: opened but not replied. */
  yesChain: ChainStep[];
  /** Left column: not opened. */
  noChain: ChainStep[];
};

export function isFollowUpRuleV2(x: unknown): x is FollowUpRuleV2 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 2 &&
    typeof o.waitDays === "number" &&
    typeof o.afterEmailIndex === "number" &&
    Array.isArray(o.yesChain) &&
    Array.isArray(o.noChain)
  );
}

/**
 * Splits the root flow at the first Follow-Ups (`follow_ups`) condition:
 * - `mainChain` = spine only (emails/delays before the condition).
 * - `followUp` = compiled yes/no branch chains + wait metadata (v2 rule).
 * If there is no such condition, returns a single linear `mainChain` and `followUp: null`.
 */
export function compileMainFlowForCampaign(steps: MainFlowStep[]): {
  mainChain: ChainStep[];
  followUp: FollowUpRuleV2 | null;
} {
  const idx = steps.findIndex(
    (s) => s.t === "condition" && (s as Extract<MainFlowStep, { t: "condition" }>).kind === "follow_ups",
  );
  if (idx < 0) {
    return { mainChain: compileMainFlowToChain(steps), followUp: null };
  }
  const spine = steps.slice(0, idx);
  const cond = steps[idx] as Extract<MainFlowStep, { t: "condition" }>;
  const mainChain = compileMainFlowToChain(spine).filter((c) => c.templateId);
  const emailCountInSpine = spine.filter((s) => s.t === "email").length;
  const rawWait = cond.waitDays ?? 0;
  const waitDays = Math.min(14, Math.max(1, rawWait < 1 ? 1 : rawWait));
  const cap = Math.max(0, emailCountInSpine - 1);
  const afterEmailIndex = Math.min(Math.max(0, cond.afterEmailIndex ?? 0), cap);
  const yesChain = compileMainFlowToChain(cond.yes ?? []).filter((c) => c.templateId);
  const noChain = compileMainFlowToChain(cond.no ?? []).filter((c) => c.templateId);
  return {
    mainChain,
    followUp: { v: 2, waitDays, afterEmailIndex, yesChain, noChain },
  };
}

export function newFlowId() {
  return `f_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function defaultMainFlow(): MainFlowStep[] {
  return [{ id: newFlowId(), t: "email", templateId: "" }];
}

/** Flatten conditions (yes subtree, then no) into a linear token stream for compilation. */
export function flattenFlowSteps(steps: MainFlowStep[]): MainFlowStep[] {
  const out: MainFlowStep[] = [];
  for (const s of steps) {
    if (s.t === "email" || s.t === "delay") out.push(s);
    else {
      out.push(...flattenFlowSteps(s.yes));
      out.push(...flattenFlowSteps(s.no));
    }
  }
  return out;
}

/** Turn linear email/delay stream into `ChainStep` (delay on each row = wait after that email). */
export function compileMainFlowToChain(steps: MainFlowStep[]): ChainStep[] {
  const flat = flattenFlowSteps(steps).filter((s) => !(s.t === "email" && !s.templateId.trim()));
  const chain: ChainStep[] = [];
  let lastTpl: string | null = null;
  let acc = 0;
  for (const s of flat) {
    if (s.t === "delay") acc += s.days;
    else if (s.t === "email") {
      if (lastTpl !== null) chain.push({ templateId: lastTpl, delayDaysBeforeNext: acc });
      lastTpl = s.templateId;
      acc = 0;
    }
  }
  if (lastTpl !== null) chain.push({ templateId: lastTpl, delayDaysBeforeNext: acc });
  return chain.filter((c) => c.templateId);
}

export function chainStepsToMainFlow(chain: ChainStep[]): MainFlowStep[] {
  const flow: MainFlowStep[] = [];
  for (const row of chain) {
    flow.push({ id: newFlowId(), t: "email", templateId: row.templateId });
    if (row.delayDaysBeforeNext > 0) {
      flow.push({ id: newFlowId(), t: "delay", days: row.delayDaysBeforeNext });
    }
  }
  if (!flow.length) return [];
  return flow;
}

export type FollowRuleBlock = {
  enabled: boolean;
  templateId: string;
  days: number;
  anchorEmailIndex: number;
  /** Extra steps after the first follow-up email (same shape as main sequence). */
  extensionFlow?: MainFlowStep[];
  /** Follow-up UI: user clicked Start on the canvas. */
  situationFlowStarted?: boolean;
  /** Situation card (wait + anchor) saved — unlocks extension sequence. */
  situationSaved?: boolean;
};

export type FollowUiState = {
  notOpened: FollowRuleBlock;
  openedNoAction: FollowRuleBlock;
};

export function defaultFollowUi(): FollowUiState {
  return {
    notOpened: {
      enabled: false,
      templateId: "",
      days: 2,
      anchorEmailIndex: 0,
      extensionFlow: [],
      situationFlowStarted: false,
      situationSaved: false,
    },
    openedNoAction: {
      enabled: false,
      templateId: "",
      days: 3,
      anchorEmailIndex: 0,
      extensionFlow: [],
    },
  };
}

function parseExtensionFlow(raw: unknown): MainFlowStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x) => x && typeof x === "object" && "t" in x && typeof (x as MainFlowStep).t === "string",
  ) as MainFlowStep[];
}

/** Build linear chain for one follow-up block: first template + optional extension graph. */
export function chainFromFollowBlock(block: FollowRuleBlock): ChainStep[] {
  if (!block.enabled) return [];
  const extChain = compileMainFlowToChain(block.extensionFlow ?? []);
  if (extChain.length === 0) {
    if (!block.templateId.trim()) return [];
    return [{ templateId: block.templateId, delayDaysBeforeNext: Math.max(0, block.days) }];
  }
  const first = extChain[0]!;
  return [
    { templateId: first.templateId, delayDaysBeforeNext: Math.max(0, block.days) },
    ...extChain.slice(1),
  ];
}

export function followUiToChain(ui: FollowUiState): ChainStep[] {
  const out: ChainStep[] = [];
  out.push(...chainFromFollowBlock(ui.notOpened));
  out.push(...chainFromFollowBlock(ui.openedNoAction));
  return out;
}

export function parseFollowUi(raw: unknown, mainEmailCount: number): FollowUiState {
  const def = defaultFollowUi();
  if (!raw || typeof raw !== "object") return def;
  const o = raw as Record<string, unknown>;
  const read = (k: string): FollowRuleBlock => {
    const x = o[k];
    if (!x || typeof x !== "object") return def[k as keyof FollowUiState] as FollowRuleBlock;
    const b = x as Record<string, unknown>;
    const cap = Math.max(0, mainEmailCount - 1);
    const ext = parseExtensionFlow(b.extensionFlow);
    return {
      enabled: Boolean(b.enabled),
      templateId: typeof b.templateId === "string" ? b.templateId : "",
      days: typeof b.days === "number" && Number.isFinite(b.days) ? b.days : 2,
      anchorEmailIndex:
        typeof b.anchorEmailIndex === "number" && Number.isFinite(b.anchorEmailIndex)
          ? Math.min(Math.max(0, b.anchorEmailIndex), cap)
          : 0,
      extensionFlow: ext.length ? ext : [],
      situationFlowStarted: typeof b.situationFlowStarted === "boolean" ? b.situationFlowStarted : undefined,
      situationSaved: typeof b.situationSaved === "boolean" ? b.situationSaved : undefined,
    };
  };
  let notOpened = read("notOpened");
  if (notOpened.enabled && notOpened.situationSaved == null) {
    const hasFlow = (notOpened.extensionFlow?.length ?? 0) > 0 || !!notOpened.templateId.trim();
    notOpened = {
      ...notOpened,
      situationSaved: hasFlow,
      situationFlowStarted: hasFlow,
    };
  }
  return { notOpened, openedNoAction: read("openedNoAction") };
}
