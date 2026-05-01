"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tier = "FREE" | "PRO" | "BUSINESS";

type LookupRes = {
  user: null | {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    subscriptionTier: Tier;
    subscriptionEndsAt: string | null;
    planChosenAt: string | null;
  };
};

type ActivateRes = {
  user: NonNullable<LookupRes["user"]>;
};

const HARD_CODED_ADMIN_EMAILS = new Set(["nomanhabib.seo@gmail.com"]);

function isAdmin(email: string | null | undefined) {
  return HARD_CODED_ADMIN_EMAILS.has((email ?? "").trim().toLowerCase());
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString();
}

function isoSameDayNextMonth(from = new Date()) {
  const d = new Date(from);
  const targetMonth = d.getMonth() + 1;
  const day = d.getDate();
  const res = new Date(d);
  res.setMonth(targetMonth, 1);
  const lastDay = new Date(res.getFullYear(), res.getMonth() + 1, 0).getDate();
  res.setDate(Math.min(day, lastDay));
  res.setHours(0, 0, 0, 0);
  return res.toISOString();
}

export default function AdminActivationsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;
  const meEmail = (session?.user?.email ?? "").toString();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [user, setUser] = useState<LookupRes["user"]>(null);

  const [endsAtIso, setEndsAtIso] = useState<string>(() => isoSameDayNextMonth());

  const allowed = useMemo(() => isAdmin(meEmail), [meEmail]);

  async function lookup() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const res = await apiFetch<LookupRes>(
        `/admin/users/lookup?email=${encodeURIComponent(email.trim())}`,
        token,
        { cache: "no-store" },
      );
      setUser(res.user);
    } catch (e) {
      setUser(null);
      setErr(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function activate(tier: Tier) {
    setErr(null);
    setOk(null);

    const targetEmail = email.trim();
    const name = tier === "FREE" ? "Free" : tier === "PRO" ? "Pro" : "Business";
    const msg = `Activate ${name} for ${targetEmail}?`;
    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const body =
        tier === "FREE"
          ? { email: email.trim(), tier }
          : { email: email.trim(), tier, endsAtIso: endsAtIso.trim() };

      const res = await apiFetch<ActivateRes>("/admin/subscriptions/activate", token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setUser(res.user);
      setOk(`${res.user.email} is now on ${res.user.subscriptionTier}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-slate-900 shadow-sm dark:border-red-900/50 dark:bg-slate-900 dark:text-white">
        <h1 className="text-xl font-bold">Admin activations</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          You are not allowed to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin activations</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Search user by email, then activate Pro/Business with a manual end date.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@email.com"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-0 focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            onClick={lookup}
            disabled={!token || loading || !email.trim()}
            className={cn(
              "h-11 rounded-xl px-5 text-sm font-semibold",
              "bg-violet-600 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {ok}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">User</h2>

        {!user ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No user loaded yet.</p>
        ) : (
          <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
            <div>
              <span className="font-semibold">Email:</span> {user.email}
            </div>
            <div>
              <span className="font-semibold">Name:</span> {user.name ?? "—"}
            </div>
            <div>
              <span className="font-semibold">Tier:</span> {user.subscriptionTier}
            </div>
            <div>
              <span className="font-semibold">Ends at:</span> {fmt(user.subscriptionEndsAt)}
            </div>
            <div>
              <span className="font-semibold">Plan chosen at:</span> {fmt(user.planChosenAt)}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                End date (ISO)
              </label>
              <input
                value={endsAtIso}
                onChange={(e) => setEndsAtIso(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder={isoSameDayNextMonth()}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => activate("PRO")}
                disabled={!token || loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activate Pro
              </button>
              <button
                onClick={() => activate("BUSINESS")}
                disabled={!token || loading}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Activate Business
              </button>
              <button
                onClick={() => activate("FREE")}
                disabled={!token || loading}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
              >
                Set Free
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

