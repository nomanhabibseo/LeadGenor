import { apiFetch } from "@/lib/api";

export type AppNotificationKind = "info" | "warning" | "error";

export type AppNotificationInput = {
  kind: AppNotificationKind;
  title: string;
  message?: string;
  href?: string;
};

const LOCAL_KEY = "lg_notifications_queue_v1";

function readQueue(): AppNotificationInput[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    return j.filter((x): x is AppNotificationInput => !!x && typeof x === "object") as AppNotificationInput[];
  } catch {
    return [];
  }
}

function writeQueue(rows: AppNotificationInput[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-200)));
  } catch {
    /* ignore */
  }
}

export async function pushNotification(token: string | undefined, n: AppNotificationInput) {
  if (!token) {
    const q = readQueue();
    q.push(n);
    writeQueue(q);
    return;
  }
  await apiFetch("/notifications", token, { method: "POST", body: JSON.stringify(n) });
}

export async function flushQueuedNotifications(token: string | undefined) {
  if (!token) return;
  const q = readQueue();
  if (!q.length) return;
  writeQueue([]);
  for (const n of q) {
    try {
      await apiFetch("/notifications", token, { method: "POST", body: JSON.stringify(n) });
    } catch {
      // If posting fails, put it back (best effort).
      const rest = readQueue();
      rest.push(n);
      writeQueue(rest);
    }
  }
}

