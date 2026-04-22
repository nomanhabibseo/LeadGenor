"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type Folder = {
  id: string;
  name: string;
  _count: { templates: number };
  activeTemplateCount: number;
};

export function EmailTemplatesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: folders = [], isError, error, refetch } = useQuery({
    queryKey: ["template-folders", userKey, q],
    queryFn: () =>
      apiFetch<Folder[]>(`/email-marketing/templates/folders${q ? `?search=${encodeURIComponent(q)}` : ""}`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const visibleFolders = useMemo(
    () => (pendingDelete ? folders.filter((f) => f.id !== pendingDelete.id) : folders),
    [folders, pendingDelete],
  );

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const create = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/email-marketing/templates/folders", token, { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["template-folders", userKey] });
      setOpen(false);
      setNewName("");
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/email-marketing/templates/folders/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["template-folders", userKey] });
      void qc.invalidateQueries({ queryKey: ["template-folder-meta", userKey] });
      setEditFolder(null);
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  const removeFolder = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-marketing/templates/folders/${id}`, token, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["template-folders", userKey] }),
  });

  async function scheduleFolderDelete(f: Folder) {
    if (!(await showConfirm(`Move folder “${f.name}” to trash? You can restore it from Templates trash.`))) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete({ id: f.id, name: f.name });
    deleteTimerRef.current = setTimeout(() => {
      void removeFolder.mutateAsync(f.id);
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 5000);
  }

  function undoFolderDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setPendingDelete(null);
  }

  if (status === "loading") {
    return <div className="em-page mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-5xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Sign in to manage templates.</p>
        <Link href="/login" className="mt-4 inline-block text-indigo-600 underline dark:text-indigo-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="em-page mx-auto max-w-5xl space-y-6 px-2 pb-16 sm:px-4">
      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-medium">Could not load template folders</p>
          <p className="mt-1 text-xs opacity-90">{error instanceof Error ? error.message : "Unknown error"}</p>
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Templates</h1>
        <Link href="/email-marketing/templates/new" className="em-btn-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New template
        </Link>
      </div>

      {pendingDelete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100">
          <span>
            Deleting folder <strong>{pendingDelete.name}</strong>… Undo within 5 seconds.
          </span>
          <button type="button" className="font-medium text-indigo-700 underline dark:text-indigo-400" onClick={undoFolderDelete}>
            Undo
          </button>
        </div>
      ) : null}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-indigo-400"
          placeholder="Search folders…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleFolders.map((f) => (
          <div key={f.id} className="em-card flex h-full min-h-0 flex-col overflow-hidden p-0">
            <div className="flex h-full min-h-0 flex-col p-4 pb-3">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">{f.name}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {f._count.templates} template{f._count.templates === 1 ? "" : "s"} · {f.activeTemplateCount} active in campaigns
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                <Link
                  href={`/email-marketing/templates/new?folderId=${encodeURIComponent(f.id)}`}
                  className="em-btn-outline h-8 px-3 text-xs"
                >
                  + Add template
                </Link>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className="em-btn-outline h-8 px-2.5 text-xs font-medium"
                    title="View templates in this folder"
                    onClick={() => router.push(`/email-marketing/templates/folder/${f.id}`)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="em-icon-btn h-8 w-8"
                    title="Rename folder"
                    onClick={() => {
                      setEditFolder(f);
                      setEditName(f.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="em-icon-btn em-icon-btn-danger h-8 w-8"
                    title="Delete folder"
                    onClick={() => void scheduleFolderDelete(f)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            setNewName("");
            setOpen(true);
          }}
          className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 py-8 text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-slate-500/70 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-indigo-400 dark:hover:bg-slate-700/50"
        >
          <Plus className="h-10 w-10 text-slate-400 dark:text-indigo-400/90" strokeWidth={1.5} />
          <span className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">New folder</span>
        </button>
      </div>

      {q.trim() && visibleFolders.length === 0 ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">No folders match your search.</p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New folder</h2>
            <input
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  setOpen(false);
                  setNewName("");
                }}
              >
                Cancel
              </button>
              <button type="button" className="em-btn-primary" onClick={() => newName.trim() && void create.mutate(newName.trim())}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editFolder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Rename folder</h2>
            <input
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  setEditFolder(null);
                  setEditName("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="em-btn-primary"
                disabled={rename.isPending || !editName.trim()}
                onClick={() => void rename.mutateAsync({ id: editFolder.id, name: editName.trim() })}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
