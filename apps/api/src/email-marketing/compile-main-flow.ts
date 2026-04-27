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

/** Prefer stored `mainSequence`; if empty, compile from `mainFlowGraph` when present. */
export function resolveMainChainFromCampaign(camp: {
  mainSequence: unknown;
  mainFlowGraph: unknown;
}): ChainStep[] {
  const fromSeq = ((camp.mainSequence as unknown as ChainStep[]) ?? []).filter((x) => x?.templateId);
  if (fromSeq.length) return fromSeq;
  if (isMainFlowGraph(camp.mainFlowGraph)) {
    return compileMainFlowToChain(camp.mainFlowGraph);
  }
  return [];
}
