"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type Row = {
  id: string;
  name: string;
  _count: { items: number; campaigns: number };
};

export function EmailListsTrashPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["email-lists-trash", userKey],
    queryFn: () => apiFetch<Row[]>("/email-marketing/lists/trash", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const restore = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/lists/${id}/restore`, token, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-lists-trash", userKey] });
      void qc.invalidateQueries({ queryKey: ["email-lists", userKey] });
    },
  });

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page p-8 text-center">
        <Link href="/login" className="text-indigo-600 underline dark:text-indigo-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="em-page mx-auto max-w-4xl space-y-6 px-2 pb-16 sm:px-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My lists — trash</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Restore a list to move it back to <Link className="font-semibold text-indigo-600 underline dark:text-indigo-400" href="/email-marketing/lists">My lists</Link>.
      </p>
      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="em-card py-12 text-center text-slate-600 dark:text-slate-400">Trash is empty.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="em-surface-hover flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-600 dark:bg-slate-800/65"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{r.name}</div>
                <div className="text-xs text-slate-500">
                  {r._count.items} sites · {r._count.campaigns} campaigns
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
                disabled={restore.isPending}
                onClick={() => void restore.mutateAsync(r.id).then(() => void refetch())}
              >
                <RotateCcw className="h-4 w-4" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
