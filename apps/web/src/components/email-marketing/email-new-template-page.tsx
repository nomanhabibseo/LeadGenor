"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Code2, Loader2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { invalidateTemplateRelatedQueries } from "@/lib/invalidate-template-queries";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { buildInlineUnsubscribeAnchorSnippet } from "@/lib/email-template-unsub";
import { MergeHighlightInput, MergeHighlightTextarea } from "@/components/merge-highlight-field";

type Folder = { id: string; name: string };

export function EmailNewTemplatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRangeRef = useRef({ start: 0, end: 0 });
  const bodyRangeRef = useRef({ start: 0, end: 0 });
  const [attrOpen, setAttrOpen] = useState(false);
  const [attrTarget, setAttrTarget] = useState<"subject" | "body">("body");
  const [unsubCardOpen, setUnsubCardOpen] = useState(false);
  const [unsubAnchorDraft, setUnsubAnchorDraft] = useState("");

  const [folderMode, setFolderMode] = useState<"existing" | "new">("existing");
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ["template-folders", userKey, ""],
    queryFn: () => apiFetch<Folder[]>("/email-marketing/templates/folders", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  const searchKey = searchParams.toString();
  useEffect(() => {
    setName("");
    setSubject("");
    setBody("");
    const params = new URLSearchParams(searchKey);
    const fid = params.get("folderId");
    const pendingFolder = params.get("newFolderName");
    if (fid) {
      setFolderMode("existing");
      setFolderId(fid);
    } else {
      setFolderId("");
    }
    if (!pendingFolder) setNewFolderName("");
  }, [searchKey]);

  useEffect(() => {
    if (searchParams.get("newFolderName")) return;
    if (searchParams.get("folderId")) return;
    if (folders.length && !folderId) setFolderId(folders[0].id);
  }, [folders, folderId, searchParams]);

  const createFolder = useMutation({
    mutationFn: (n: string) =>
      apiFetch<Folder>("/email-marketing/templates/folders", token, {
        method: "POST",
        body: JSON.stringify({ name: n }),
      }),
    onError: (e: Error) => void showAlert(e.message),
  });

  const createTemplate = useMutation({
    mutationFn: (payload: { folderId: string; name: string; subject: string; body: string; includeUnsubscribeBlock: boolean }) =>
      apiFetch<{ id: string }>(`/email-marketing/templates/folders/${payload.folderId}/items`, token, {
        method: "POST",
        body: JSON.stringify({
          name: payload.name,
          subject: payload.subject,
          body: payload.body,
          includeUnsubscribeBlock: payload.includeUnsubscribeBlock,
        }),
      }),
    onError: (e: Error) => void showAlert(e.message),
  });

  function insertToken(key: string, field: "subject" | "body") {
    const tokenStr = `{{${key}}}`;
    if (field === "subject") {
      const el = subjectRef.current;
      const { start: r0, end: r1 } = subjectRangeRef.current;
      const st = Math.min(Math.max(0, r0), subject.length);
      const en = Math.min(Math.max(st, r1), subject.length);
      const next = subject.slice(0, st) + tokenStr + subject.slice(en);
      const pos = st + tokenStr.length;
      subjectRangeRef.current = { start: pos, end: pos };
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
      setAttrOpen(false);
      return;
    }
    const el = bodyRef.current;
    const { start: r0, end: r1 } = bodyRangeRef.current;
    const st = Math.min(Math.max(0, r0), body.length);
    const en = Math.min(Math.max(st, r1), body.length);
    const next = body.slice(0, st) + tokenStr + body.slice(en);
    const pos = st + tokenStr.length;
    bodyRangeRef.current = { start: pos, end: pos };
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
    setAttrOpen(false);
  }

  function insertInlineUnsub(anchorText: string) {
    const snippet = buildInlineUnsubscribeAnchorSnippet(anchorText);
    const el = bodyRef.current;
    const { start: r0, end: r1 } = bodyRangeRef.current;
    const st = Math.min(Math.max(0, r0), body.length);
    const en = Math.min(Math.max(st, r1), body.length);
    const next = body.slice(0, st) + snippet + body.slice(en);
    const pos = st + snippet.length;
    bodyRangeRef.current = { start: pos, end: pos };
    setBody(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
    setUnsubCardOpen(false);
    setUnsubAnchorDraft("");
  }

  async function submit() {
    if (!token) return;
    const nm = name.trim();
    if (!nm) {
      void showAlert("Template name is required.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      void showAlert("Subject and body are required.");
      return;
    }
    setSaving(true);
    try {
      const urlNewFolder = searchParams.get("newFolderName")?.trim();
      const urlFolderId = searchParams.get("folderId");
      let fid: string | undefined;
      if (urlNewFolder) {
        const f = await createFolder.mutateAsync(urlNewFolder);
        fid = f.id;
        await invalidateTemplateRelatedQueries(qc, userKey, { folderId: fid });
      } else if (urlFolderId) {
        fid = urlFolderId;
      } else if (folderMode === "new") {
        const fn = newFolderName.trim();
        if (!fn) {
          void showAlert("Enter a new folder name or choose an existing folder.");
          setSaving(false);
          return;
        }
        const f = await createFolder.mutateAsync(fn);
        fid = f.id;
        await invalidateTemplateRelatedQueries(qc, userKey, { folderId: fid });
      } else if (folderId) {
        fid = folderId;
      }
      if (!fid) {
        void showAlert("Select a folder.");
        setSaving(false);
        return;
      }
      const created = await createTemplate.mutateAsync({
        folderId: fid,
        name: nm,
        subject,
        body,
        includeUnsubscribeBlock: false,
      });
      await invalidateTemplateRelatedQueries(qc, userKey, { folderId: fid });
      // After saving, return to list context (folder if known).
      router.push(`/email-marketing/templates/folder/${fid}`);
      router.refresh();
    } catch {
      /* mutations already alerted */
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-3xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <Link href="/login" className="text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  const urlFolderIdQ = searchParams.get("folderId");
  const urlNewFolderQ = searchParams.get("newFolderName");
  const folderLocked = Boolean(urlFolderIdQ || urlNewFolderQ);
  const lockedFolderName = urlNewFolderQ
    ? urlNewFolderQ
    : urlFolderIdQ
      ? folders.find((f) => f.id === urlFolderIdQ)?.name
      : undefined;
  const formComplete = Boolean(name.trim() && subject.trim() && body.trim());

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New template</h1>
        <Link href="/email-marketing/templates" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
          Back to templates
        </Link>
      </div>

      <div className="email-template-form space-y-5">
        {folderLocked ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/60">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {urlNewFolderQ ? "New folder" : "Folder"} (saved with template when you click Save)
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100" aria-readonly>
              {lockedFolderName ?? "…"}
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Folder</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Select a folder or create a new folder for this template.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" checked={folderMode === "existing"} onChange={() => setFolderMode("existing")} />
                Existing folder
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" checked={folderMode === "new"} onChange={() => setFolderMode("new")} />
                Create new folder
              </label>
            </div>
            {folderMode === "existing" ? (
              <select className="tpl-field mt-3" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="tpl-field mt-3"
                placeholder="New folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            )}
          </section>
        )}

        <div className="space-y-0.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Template name</label>
          <input
            className="tpl-field placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome sequence"
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Subject</label>
          <MergeHighlightInput
            inputRef={subjectRef}
            selectionRangeRef={subjectRangeRef}
            className="w-full min-w-0"
            value={subject}
            onChange={setSubject}
            onFocus={() => setAttrTarget("subject")}
            placeholder="Subject line"
            trailingSlot={
              <div className="relative flex">
                <button
                  type="button"
                  className="inline-flex h-full min-h-[2.5rem] items-center gap-1 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/80"
                  onClick={() => {
                    setAttrTarget("subject");
                    setAttrOpen((o) => !o);
                  }}
                >
                  <Code2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  Variables
                </button>
                {attrOpen && attrTarget === "subject" ? (
                  <div className="absolute right-0 top-full z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={f.label}
                        onClick={() => insertToken(f.key, "subject")}
                      >
                        {`{{${f.key}}}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            }
          />
        </div>

        <div className="space-y-0.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Body</label>
          <div className="tpl-body-shell">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-100/95 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900/50">
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500/40 dark:hover:bg-slate-700/80"
                  onClick={() => {
                    setAttrTarget("body");
                    setAttrOpen((o) => !o);
                  }}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Variables
                </button>
                {attrOpen && attrTarget === "body" ? (
                  <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={f.label}
                    onClick={() => insertToken(f.key, "body")}
                  >
                    {`{{${f.key}}}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500/40 dark:hover:bg-slate-700/80"
            onClick={() => {
              setAttrTarget("body");
              setUnsubAnchorDraft("");
              setUnsubCardOpen(true);
            }}
              >
                Unsubscribe link
              </button>
            </div>
            <MergeHighlightTextarea
              textareaRef={bodyRef}
              selectionRangeRef={bodyRangeRef}
              className="rounded-none border-0 shadow-none ring-0 hover:border-transparent focus-within:border-transparent focus-within:ring-0 dark:hover:border-transparent dark:focus-within:border-transparent dark:focus-within:ring-0"
              value={body}
              onChange={setBody}
              onFocus={() => setAttrTarget("body")}
              placeholder="HTML or plain text…"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
            onClick={() => router.push("/email-marketing/templates")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-save-primary inline-flex items-center gap-2"
            disabled={saving || createFolder.isPending || createTemplate.isPending || !formComplete}
            title={!formComplete ? "Fill template name, subject, and body to save." : undefined}
            onClick={() => void submit()}
          >
            {saving || createFolder.isPending || createTemplate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save
          </button>
        </div>

      {unsubCardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add an unsubscribe link</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Enter the text for an unsubscribe link. LeadGenor will automatically generate and attach a custom unsubscribe link to it.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">Link text</label>
            <input
              className="tpl-field mt-1"
              value={unsubAnchorDraft}
              onChange={(e) => setUnsubAnchorDraft(e.target.value)}
              placeholder="e.g. Unsubscribe"
              autoFocus
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => setUnsubCardOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-save-primary-sm" onClick={() => insertInlineUnsub(unsubAnchorDraft)}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
