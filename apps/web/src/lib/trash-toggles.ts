export type TrashModuleKey =
  | "vendors"
  | "clients"
  | "orders"
  | "lists"
  | "templates";

const KEYS: TrashModuleKey[] = [
  "vendors",
  "clients",
  "orders",
  "lists",
  "templates",
];

/** `null`/invalid toggles object → all modules enabled */
export function isTrashModuleEnabled(toggles: unknown, key: TrashModuleKey): boolean {
  if (!toggles || typeof toggles !== "object" || Array.isArray(toggles)) return true;
  const v = (toggles as Record<string, unknown>)[key];
  return v !== false;
}

export function defaultTrashToggles(): Record<TrashModuleKey, boolean> {
  return Object.fromEntries(KEYS.map((k) => [k, true])) as Record<TrashModuleKey, boolean>;
}

/** Merge server `Json` partial (only `false` keys stored) with defaults. */
export function mergeTrashTogglesFromServer(raw: unknown): Record<TrashModuleKey, boolean> {
  const d = defaultTrashToggles();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (v === false) d[k] = false;
    }
  }
  return d;
}
