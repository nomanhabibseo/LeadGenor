/**
 * Mirrors `apps/web/src/lib/campaign-flow.ts` so the API can build recipients / send
 * when `mainFlowGraph` was saved but `mainSequence` stayed empty.
 */

export type MainFlowStep =
  | { id: string; t: 'email'; templateId: string }
  | { id: string; t: 'delay'; days: number }
  | {
      id: string;
      t: 'condition';
      kind?: 'follow_ups' | 'opened_email';
      afterEmailIndex?: number;
      waitDays?: number;
      configComplete?: boolean;
      yes: MainFlowStep[];
      no: MainFlowStep[];
    };

export type ChainStep = { templateId: string; delayDaysBeforeNext: number };

export type FollowUpRuleV2 = {
  v: 2;
  waitDays: number;
  afterEmailIndex: number;
  yesChain: ChainStep[];
  noChain: ChainStep[];
};

export function isFollowUpRuleV2(x: unknown): x is FollowUpRuleV2 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === 2 &&
    typeof o.waitDays === 'number' &&
    typeof o.afterEmailIndex === 'number' &&
    Array.isArray(o.yesChain) &&
    Array.isArray(o.noChain)
  );
}

export function getFollowUpV2(camp: { followUpStartRule?: unknown }): FollowUpRuleV2 | null {
  return isFollowUpRuleV2(camp.followUpStartRule) ? camp.followUpStartRule : null;
}

export function compileMainFlowForCampaign(steps: MainFlowStep[]): {
  mainChain: ChainStep[];
  followUp: FollowUpRuleV2 | null;
} {
  const idx = steps.findIndex(
    (s) => s.t === 'condition' && (s as MainFlowStep & { t: 'condition' }).kind === 'follow_ups',
  );
  if (idx < 0) {
    return { mainChain: compileMainFlowToChain(steps), followUp: null };
  }
  const spine = steps.slice(0, idx);
  const cond = steps[idx] as Extract<MainFlowStep, { t: 'condition' }>;
  const mainChain = compileMainFlowToChain(spine).filter((c) => c.templateId);
  const emailCountInSpine = spine.filter((s) => s.t === 'email').length;
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

export function isMainFlowGraph(x: unknown): x is MainFlowStep[] {
  return Array.isArray(x) && x.length > 0 && typeof (x[0] as MainFlowStep)?.t === 'string';
}

export function flattenFlowSteps(steps: MainFlowStep[]): MainFlowStep[] {
  const out: MainFlowStep[] = [];
  for (const s of steps) {
    if (s.t === 'email' || s.t === 'delay') out.push(s);
    else {
      out.push(...flattenFlowSteps(s.yes));
      out.push(...flattenFlowSteps(s.no));
    }
  }
  return out;
}

export function compileMainFlowToChain(steps: MainFlowStep[]): ChainStep[] {
  const flat = flattenFlowSteps(steps).filter((s) => !(s.t === 'email' && !s.templateId.trim()));
  const chain: ChainStep[] = [];
  let lastTpl: string | null = null;
  let acc = 0;
  for (const s of flat) {
    if (s.t === 'delay') acc += s.days;
    else if (s.t === 'email') {
      if (lastTpl !== null) chain.push({ templateId: lastTpl, delayDaysBeforeNext: acc });
      lastTpl = s.templateId;
      acc = 0;
    }
  }
  if (lastTpl !== null) chain.push({ templateId: lastTpl, delayDaysBeforeNext: acc });
  return chain.filter((c) => c.templateId);
}

/**
 * Prefer spine-only main chain when a Follow-Ups (v2) rule exists and the graph is present
 * (avoids the legacy bug that stored yes+no branches flattened into `mainSequence`).
 */
export function resolveMainChainFromCampaign(camp: {
  mainSequence: unknown;
  mainFlowGraph: unknown;
  followUpStartRule?: unknown;
}): ChainStep[] {
  if (isFollowUpRuleV2(camp.followUpStartRule) && isMainFlowGraph(camp.mainFlowGraph)) {
    const { mainChain } = compileMainFlowForCampaign(camp.mainFlowGraph);
    if (mainChain.length) return mainChain;
  }
  const fromSeq = ((camp.mainSequence as unknown as ChainStep[]) ?? []).filter((x) => x?.templateId);
  if (fromSeq.length) return fromSeq;
  if (isMainFlowGraph(camp.mainFlowGraph)) {
    return compileMainFlowToChain(camp.mainFlowGraph);
  }
  return [];
}
