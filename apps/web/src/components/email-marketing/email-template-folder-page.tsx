"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { invalidateTemplateRelatedQueries } from "@/lib/invalidate-template-queries";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type Tpl = { id: string; name: string; updatedAt: string };
type FolderMeta = { id: string; name: string };

export function EmailTemplateFolderPage({ folderId }: { folderId: string }) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [q, setQ] = useState("");
  const [pendingTplDel, setPendingTplDel] = useState<{ id: string; name: string } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: folderMeta } = useQuery({
    queryKey: ["template-folder-meta", userKey, folderId],
    queryFn: () => apiFetch<FolderMeta>(`/email-marketing/templates/folders/${folderId}`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["template-items", userKey, folderId, q],
    queryFn: () =>
      apiFetch<Tpl[]>(
        `/email-marketing/templates/folders/${folderId}/items${q ? `?search=${encodeURIComponent(q)}` : ""}`,
        token,
      ),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const visibleItems = useMemo(
    () => (pendingTplDel ? items.filter((t) => t.id !== pendingTplDel.id) : items),
    [items, pendingTplDel],
  );

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const removeTpl = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/templates/items/${id}`, token, { method: "DELETE" }),
    onSuccess: () => {
      void invalidateTemplateRelatedQueries(qc, userKey, { folderId });
    },
  });

  async function scheduleTemplateDelete(t: Tpl) {
    if (!(await showConfirm(`Delete template “${t.name}”? You can undo for a few seconds after.`))) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingTplDel({ id: t.id, name: t.name });
    deleteTimerRef.current = setTimeout(() => {
      void removeTpl.mutateAsync(t.id);
      setPendingTplDel(null);
      deleteTimerRef.current = null;
    }, 5000);
  }

  function undoTemplateDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setPendingTplDel(null);
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-4xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <p className="text-slate-600">Sign in to edit templates.</p>
        <Link href="/login" className="mt-4 inline-block text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  const folderName = folderMeta?.name ?? "…";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{folderName}</h1>
        <Link
          href={`/email-marketing/templates/new?folderId=${encodeURIComponent(folderId)}`}
          className="btn-save-primary-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add template
        </Link>
      </div>

      {pendingTplDel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
          <span>
            Deleting template <strong>{pendingTplDel.name}</strong>… Undo within 5 seconds.
          </span>
          <button type="button" className="font-medium text-cyan-700 underline dark:text-cyan-300" onClick={undoTemplateDelete}>
            Undo
          </button>
        </div>
      ) : null}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder="Search templates…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {visibleItems.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/65"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-cyan-600" />
              <span className="truncate font-medium">{t.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/email-marketing/templates/edit/${t.id}`}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                title="Edit template"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                title="Delete template"
                onClick={() => void scheduleTemplateDelete(t)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
