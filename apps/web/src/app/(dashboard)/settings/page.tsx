"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { FormSectionCard } from "@/components/form-section-card";
import { useTheme } from "@/components/theme-provider";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import {
  defaultTrashToggles,
  mergeTrashTogglesFromServer,
  type TrashModuleKey,
} from "@/lib/trash-toggles";
import type { ThemePreference } from "@/lib/theme-storage";
import { cn } from "@/lib/utils";

const MODULE_ROWS: { key: TrashModuleKey; label: string }[] = [
  { key: "vendors", label: "Vendors" },
  { key: "clients", label: "Clients" },
  { key: "orders", label: "Orders" },
  { key: "lists", label: "My lists" },
  { key: "templates", label: "Templates" },
  { key: "emailAccounts", label: "Email accounts" },
  { key: "campaigns", label: "Campaigns" },
];

function TrashToggleRow({
  label,
  on,
  busy,
  onToggle,
}: {
  label: string;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-white/80 px-3 py-2.5 dark:border-slate-600/80 dark:bg-slate-900/40">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
        {label}
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" aria-hidden /> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        title={on ? "Trash enabled" : "Trash disabled"}
        onClick={onToggle}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50",
          on
            ? "border-indigo-400 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500"
            : "border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-700",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 translate-x-1 rounded-full bg-white shadow transition",
            on && "translate-x-6",
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const { preference, setPreference } = useTheme();

  const { data: me, isLoading } = useQuery({
    queryKey: ["users", "me", "settings", token],
    queryFn: () =>
      apiFetch<{
        trashRetentionDays: number;
        themePreference?: string | null;
        trashToggles?: unknown;
      }>("/users/me", token),
    enabled: status === "authenticated" && !!token,
  });

  const [toggles, setToggles] = useState<Record<TrashModuleKey, boolean>>(defaultTrashToggles);
  const [daysStr, setDaysStr] = useState("");
  const [busyKey, setBusyKey] = useState<TrashModuleKey | null>(null);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [themeBusy, setThemeBusy] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setToggles(mergeTrashTogglesFromServer(me?.trashToggles));
  }, [me?.trashToggles]);

  useEffect(() => {
    if (me?.trashRetentionDays != null) {
      setDaysStr(String(me.trashRetentionDays));
    }
  }, [me?.trashRetentionDays]);

  async function onToggleModule(key: TrashModuleKey) {
    if (!token) return;
    const prev = toggles;
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    setBusyKey(key);
    try {
      await apiFetch("/users/me/settings", token, {
        method: "PATCH",
        body: JSON.stringify({ trashToggles: next }),
      });
      void qc.invalidateQueries({ queryKey: ["users", "me"] });
    } catch (e) {
      setToggles(prev);
      void showAlert(e instanceof Error ? e.message : "Could not update trash setting.");
    } finally {
      setBusyKey(null);
    }
  }

  async function saveRetention() {
    if (!token) return;
    const n = Number(daysStr);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      void showAlert("Enter a number of days between 1 and 365.");
      return;
    }
    setRetentionSaving(true);
    try {
      await apiFetch("/users/me/settings", token, {
        method: "PATCH",
        body: JSON.stringify({ trashRetentionDays: Math.floor(n) }),
      });
      void qc.invalidateQueries({ queryKey: ["users", "me"] });
    } catch (e) {
      void showAlert(e instanceof Error ? e.message : "Could not save retention.");
    } finally {
      setRetentionSaving(false);
    }
  }

  async function applyThemePref(next: ThemePreference) {
    setPreference(next);
    if (!token) return;
    setThemeBusy(next);
    try {
      await apiFetch("/users/me/settings", token, {
        method: "PATCH",
        body: JSON.stringify({ themePreference: next }),
      });
      void qc.invalidateQueries({ queryKey: ["users", "me"] });
    } catch (e) {
      void showAlert(e instanceof Error ? e.message : "Could not save theme.");
    } finally {
      setThemeBusy(null);
    }
  }

  if (status === "loading" || (status === "authenticated" && !!token && isLoading && !me)) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6 text-slate-600 dark:text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Loading settings…</p>
      </div>
    );
  }

  if (status !== "authenticated" || !token) {
    return <p className="p-6 text-slate-600 dark:text-slate-400">Sign in to manage settings.</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Theme, which trash folders appear in the sidebar, and how long deleted items are kept.
        </p>
      </div>

      <FormSectionCard title="Appearance">
        <p className="text-xs text-slate-600 dark:text-slate-400">Icons only; hover for the label.</p>
        <div className="flex items-center gap-2 pt-1">
          {(
            [
              { pref: "light" as const, icon: Sun, title: "Light mode" },
              { pref: "dark" as const, icon: Moon, title: "Dark mode" },
              { pref: "system" as const, icon: Monitor, title: "System theme" },
            ] as const
          ).map(({ pref, icon: Icon, title }) => (
            <button
              key={pref}
              type="button"
              title={title}
              aria-label={title}
              disabled={themeBusy !== null}
              onClick={() => void applyThemePref(pref)}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-xl border text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800/80",
                preference === pref
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/25 dark:border-indigo-400 dark:bg-indigo-950/50"
                  : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/60",
              )}
            >
              {themeBusy === pref ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          ))}
        </div>
      </FormSectionCard>

      <FormSectionCard title="Trash folders">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Turn a module off to hide its trash link in the sidebar. Deleted data is still kept until retention
          removes it or you turn the module back on.
        </p>
        <div className="space-y-2 pt-1">
          {MODULE_ROWS.map(({ key, label }) => (
            <TrashToggleRow
              key={key}
              label={label}
              on={toggles[key]}
              busy={busyKey === key}
              onToggle={() => void onToggleModule(key)}
            />
          ))}
        </div>
      </FormSectionCard>

      <FormSectionCard title="Trash retention">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          After this many days in trash, items are permanently removed (minimum 1 day).
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="number"
            min={1}
            max={365}
            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={daysStr}
            onChange={(e) => setDaysStr(e.target.value)}
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">days</span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            disabled={retentionSaving}
            onClick={() => void saveRetention()}
          >
            {retentionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save retention
          </button>
        </div>
      </FormSectionCard>
    </div>
  );
}
