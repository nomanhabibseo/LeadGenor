"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { apiFetch, apiUrl } from "@/lib/api";

export default function TrashSettingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiFetch<{ trashRetentionDays: number }>("/users/me", token),
    enabled: !!token,
  });
  const [days, setDays] = useState<number | "">("");

  async function save() {
    if (!token || days === "") return;
    await fetch(apiUrl("/users/me/trash-retention"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashRetentionDays: days }),
    });
    void qc.invalidateQueries({ queryKey: ["users", "me"] });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Trash retention</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Choose between 7 and 28 days (applies to automated purge jobs).
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          type="number"
          min={7}
          max={28}
          className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          placeholder={String(me?.trashRetentionDays ?? 28)}
          value={days}
          onChange={(e) => setDays(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <button type="button" className="btn-save-primary-sm" onClick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  );
}
