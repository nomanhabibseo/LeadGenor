"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { apiFetch, apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

function firstWordCapital(name: string) {
  const w = name.trim().split(/\s+/)[0] ?? "";
  if (!w) return "Account";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function HeaderAccount() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nameEdit, setNameEdit] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ["users", "me", token],
    queryFn: () => apiFetch<{ id: string; email: string; name: string | null }>("/users/me", token),
    enabled: !!token,
  });

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
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setMsg(null);
            setErr(null);
            setNameEdit(me?.name ?? "");
          }}
          className="flex max-w-[10rem] items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 sm:max-w-xs sm:px-4"
        >
          <User className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate">{label}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-80 transition", open && "rotate-180")} />
        </button>

        {open && (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-800">
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
