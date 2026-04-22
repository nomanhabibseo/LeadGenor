/** UI flow nodes for campaign main sequence (Step 3). Compiled to API `ChainStep[]` for sending. */

export type MainFlowStep =
  | { id: string; t: "email"; templateId: string }
  | { id: string; t: "delay"; days: number }
  | {
      id: string;
      t: "condition";
      /** Default: opened-email engagement split (Yes = clicked link, no reply; No = no link click). */
      kind?: "opened_email";
      /** Days to wait after open before evaluating / continuing branch paths. */
      waitDays?: number;
      yes: MainFlowStep[];
      no: MainFlowStep[];
    };

export type ChainStep = { templateId: string; delayDaysBeforeNext: number };

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
