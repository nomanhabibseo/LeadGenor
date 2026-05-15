"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Bell, ChevronDown, User } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "@/lib/api";
import { useDashboardPlansModal } from "@/contexts/dashboard-plans-modal-context";
import type { UsersMePayload } from "@/lib/user-subscription";
import { cn } from "@/lib/utils";
import { flushQueuedNotifications } from "@/lib/notifications";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

function firstWordCapital(name: string) {
  const w = name.trim().split(/\s+/)[0] ?? "";
  if (!w) return "Account";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function HeaderAccount({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { data: session } = useSession();
  const { open: openPlansModal } = useDashboardPlansModal();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nameEdit, setNameEdit] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["users", "me", token],
    queryFn: () => apiFetch<UsersMePayload>("/users/me", token),
    enabled: !!token,
    staleTime: 60_000,
  });

  /** API enums sometimes serialize oddly; fall back to root `subscriptionTier` so CTAs never disappear. */
  const rawTier = me?.subscription?.effectiveTier ?? me?.subscriptionTier ?? "FREE";
  const eff = String(rawTier).toUpperCase();
  const tierNorm = eff === "PRO" || eff === "BUSINESS" || eff === "FREE" ? eff : "FREE";
  const tier =
    tierNorm === "PRO" ? "Pro" : tierNorm === "BUSINESS" ? "Business" : "Free";

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread", userKey],
    queryFn: () => apiFetch<{ unread: number }>("/notifications/unread-count", token),
    enabled: !!token && !!userKey,
    refetchInterval: 15_000,
  });

  // Best-effort flush any queued notifications once logged in.
  useEffect(() => {
    void flushQueuedNotifications(token);
  }, [token]);

  const displayName = me?.name?.trim() || session?.user?.name?.trim() || "";
  const label = firstWordCapital(displayName || (session?.user?.email ?? ""));

  async function saveProfile() {
    setMsg(null);
    setErr(null);
    if (!token) return;
    const body: { name?: string; currentPassword?: string; newPassword?: string } = {};
    if (nameEdit.trim()) body.name = nameEdit.trim();
    if (newPassword) {
      body.newPassword = newPassword;
      body.currentPassword = currentPassword;
    }
    if (!body.name && !body.newPassword) {
      setErr("Change your name and/or password.");
      return;
    }
    const res = await fetch(apiUrl("/users/me"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      setErr(t || "Update failed");
      return;
    }
    setMsg("Saved.");
    setCurrentPassword("");
    setNewPassword("");
    setNameEdit("");
    void qc.invalidateQueries({ queryKey: ["users", "me"] });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/notifications"
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition",
          tone === "dark"
            ? "text-white hover:bg-white/10"
            : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-100 dark:hover:bg-slate-800/70",
        )}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread?.unread ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unread.unread > 99 ? "99+" : unread.unread}
          </span>
        ) : null}
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setMsg(null);
            setErr(null);
            setNameEdit(me?.name ?? "");
          }}
          className={cn(
            "flex max-w-[10rem] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition sm:max-w-xs sm:px-4",
            tone === "dark"
              ? "border border-white/20 bg-white/10 text-slate-100 hover:bg-white/15"
              : "border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 dark:shadow-none dark:hover:bg-slate-800",
          )}
        >
          <User className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate">{label}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-80 transition", open && "rotate-180")} />
        </button>

        {open && (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-800">
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/50">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Current plan
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{tier}</p>
                {tierNorm === "FREE" || tierNorm === "PRO" ? (
                  <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                    {tierNorm === "FREE" ? (
                      <button
                        type="button"
                        className="block w-full text-left text-xs font-semibold text-violet-700 underline decoration-violet-400/80 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
                        onClick={() => {
                          openPlansModal();
                          setOpen(false);
                        }}
                      >
                        Upgrade to Pro
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left text-xs font-semibold text-violet-700 underline decoration-violet-400/80 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
                        onClick={() => {
                          openPlansModal();
                          setOpen(false);
                        }}
                      >
                        Upgrade to Business
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Display name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={nameEdit}
                  onChange={(e) => setNameEdit(e.target.value)}
                  placeholder={me?.name ?? ""}
                />
              </label>

              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
                <input
                  readOnly
                  tabIndex={-1}
                  className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-300"
                  value={me?.email ?? session?.user?.email ?? ""}
                />
              </label>

              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Current password</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="mt-2 block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">New password</span>
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>

              {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
              {msg ? <p className="mt-2 text-xs text-green-600">{msg}</p> : null}

              <button type="button" className="btn-save-primary mt-3 w-full py-2 text-xs" onClick={() => void saveProfile()}>
                Save changes
              </button>

              <button
                type="button"
                className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  setOpen(false);
                  qc.clear();
                  void signOut({ callbackUrl: "/" });
                }}
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
