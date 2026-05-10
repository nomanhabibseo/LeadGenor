"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch, apiUrl } from "@/lib/api";
import { invalidateTemplateRelatedQueries } from "@/lib/invalidate-template-queries";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type Folder = {
  id: string;
  name: string;
  deletedAt: string | null;
  _count: { templates: number };
};

export function EmailTemplatesTrashPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showConfirm, showAlert } = useAppDialog();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["template-folders-trash", userKey],
    queryFn: () => apiFetch<Folder[]>("/email-marketing/templates/folders/trash", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const restore = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/templates/folders/${id}/restore`, token, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => void invalidateTemplateRelatedQueries(qc, userKey),
  });

  function toggleAll() {
    if (allIds.length > 0 && allIds.every((id) => selected.has(id))) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function restoreSelected() {
    const ids = [...selected];
    if (!ids.length || !token) return;
    if (!(await showConfirm(`Restore ${ids.length} folder(s) and their templates to Templates?`))) return;
    for (const id of ids) {
      await apiFetch(`/email-marketing/templates/folders/${id}/restore`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
    }
    setSelected(new Set());
    void refetch();
    void invalidateTemplateRelatedQueries(qc, userKey);
  }

  async function permanentDeleteSelected() {
    const ids = [...selected];
    if (!ids.length || !token) return;
    if (
      !(await showConfirm(
        `Permanently delete ${ids.length} folder(s) and all templates inside? Any campaigns that use those templates will be removed. This cannot be undone.`,
      ))
    )
      return;
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(apiUrl(`/email-marketing/templates/folders/${id}/permanent`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) failed++;
    }
    setSelected(new Set());
    void refetch();
    void invalidateTemplateRelatedQueries(qc, userKey);
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
    if (failed) void showAlert(`Could not delete ${failed} folder(s). Try again or delete one at a time.`);
  }

  async function permanentDeleteOne(f: Folder) {
    if (
      !(await showConfirm(
        `Permanently delete folder “${f.name}” and all templates inside? Any campaigns using those templates will be removed. This cannot be undone.`,
      ))
    )
      return;
    const res = await fetch(apiUrl(`/email-marketing/templates/folders/${f.id}/permanent`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      void showAlert((await res.text()) || "Could not delete folder.");
      return;
    }
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(f.id);
      return n;
    });
    void refetch();
    void invalidateTemplateRelatedQueries(qc, userKey);
    void qc.invalidateQueries({ queryKey: ["campaigns", userKey] });
  }

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
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Templates — trash</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Deleted folders appear here with all templates inside. Restore brings the folder back to{" "}
        <Link className="font-semibold text-indigo-600 underline dark:text-indigo-400" href="/email-marketing/templates">
          Templates
        </Link>
        , or permanently delete folders you no longer need.
      </p>

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 ? (
            <>
              <button
                type="button"
                className="btn-toolbar-outline inline-flex items-center gap-1"
                disabled={restore.isPending}
                onClick={() => void restoreSelected()}
              >
                <RotateCcw className="h-4 w-4" />
                Restore selected ({selected.size})
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 shadow-sm hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950/45"
                onClick={() => void permanentDeleteSelected()}
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="em-card py-12 text-center text-slate-600 dark:text-slate-400">Trash is empty.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800/65">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40">
              <tr>
                <th className="w-12 p-3">
                  <input
                    type="checkbox"
                    className="mx-auto block"
                    checked={allIds.length > 0 && allIds.every((id) => selected.has(id))}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-3 font-semibold text-slate-900 dark:text-white">Folder</th>
                <th className="p-3 font-semibold text-slate-900 dark:text-white">Contents</th>
                <th className="p-3 text-right font-semibold text-slate-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="p-3 align-middle">
                    <input
                      type="checkbox"
                      className="mx-auto block"
                      checked={selected.has(r.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        });
                      }}
                      aria-label={`Select ${r.name}`}
                    />
                  </td>
                  <td className="p-3 font-medium text-slate-900 dark:text-white">{r.name}</td>
                  <td className="p-3 text-xs text-slate-500 dark:text-slate-400">
                    {r._count.templates} template{r._count.templates === 1 ? "" : "s"}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      className="mr-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                      disabled={restore.isPending}
                      onClick={() => void restore.mutateAsync(r.id).then(() => void refetch())}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                      onClick={() => void permanentDeleteOne(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
