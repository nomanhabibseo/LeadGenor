"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Bell, Check } from "lucide-react";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  kind: "info" | "warning" | "error";
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

function kindStyles(kind: Row["kind"]) {
  if (kind === "error") return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100";
  if (kind === "warning")
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";
  return "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100";
}

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();

  // Opening the page clears the bell badge.
  const readAll = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", token, { method: "PATCH" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications-unread", userKey] }),
  });

  // Fire-and-forget: if it fails, user can still mark items manually.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status === "authenticated" && token && userKey) void readAll.mutateAsync();
    // we only want this on initial open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, token, userKey]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["notifications", userKey],
    queryFn: () => apiFetch<Row[]>("/notifications?take=80", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, token, { method: "PATCH" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications", userKey] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread", userKey] });
    },
  });

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-slate-600 dark:text-slate-400">
        Sign in to view notifications.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={cn("rounded-2xl border p-4", kindStyles(n.kind), n.readAt ? "opacity-80" : "")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{n.title}</p>
                    {!n.readAt ? (
                      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        NEW
                      </span>
                    ) : null}
                  </div>
                  {n.message ? <p className="mt-1 whitespace-pre-wrap text-sm opacity-90">{n.message}</p> : null}
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-900/60"
                    >
                      Open
                    </Link>
                  ) : null}
                  {!n.readAt ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
                      disabled={markRead.isPending}
                      onClick={() => void markRead.mutateAsync(n.id)}
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Read
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

