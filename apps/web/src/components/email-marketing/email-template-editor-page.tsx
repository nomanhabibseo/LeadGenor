"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Code2, Eye, Trash2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { invalidateTemplateRelatedQueries } from "@/lib/invalidate-template-queries";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { MERGE_FIELDS } from "@/lib/merge-fields";
import { applyMergePreview, sampleMergeVars } from "@/lib/merge-preview";
import {
  INLINE_UNSUBSCRIBE_HREF,
  buildInlineUnsubscribeAnchorSnippet,
  expandLgUnsubTokensForPreviewMerged,
  hasInlineUnsubscribeInBody,
  migrateLegacyInlineUnsubHtmlToToken,
} from "@/lib/email-template-unsub";
import { MergeHighlightInput, MergeHighlightTextarea } from "@/components/merge-highlight-field";

type TplBrief = { id: string; name: string; updatedAt: string };

type Tpl = {
  id: string;
  name: string;
  subject: string;
  body: string;
  includeUnsubscribeBlock: boolean;
  folder?: { id: string; name: string };
};

export function EmailTemplateEditorPage({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert, showConfirm } = useAppDialog();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const subjectRangeRef = useRef({ start: 0, end: 0 });
  const bodyRangeRef = useRef({ start: 0, end: 0 });
  const [attrOpen, setAttrOpen] = useState(false);
  const [attrTarget, setAttrTarget] = useState<"subject" | "body">("body");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsubCardOpen, setUnsubCardOpen] = useState(false);
  const [unsubAnchorDraft, setUnsubAnchorDraft] = useState("");
  const [legacyFooterUnsub, setLegacyFooterUnsub] = useState(false);

  const { data: tpl } = useQuery({
    queryKey: ["template", userKey, templateId],
    queryFn: () => apiFetch<Tpl>(`/email-marketing/templates/items/${templateId}`, token),
    enabled: !!token && !!userKey,
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!tpl) return;
    setName(tpl.name);
    setSubject(tpl.subject);
    setBody(migrateLegacyInlineUnsubHtmlToToken(tpl.body));
    setLegacyFooterUnsub(tpl.includeUnsubscribeBlock);
  }, [tpl]);

  useEffect(() => {
    if (hasInlineUnsubscribeInBody(body)) setLegacyFooterUnsub(false);
  }, [body]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/email-marketing/templates/items/${templateId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          subject,
          body,
          includeUnsubscribeBlock: legacyFooterUnsub && !hasInlineUnsubscribeInBody(body),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["template", userKey, templateId] });
      const fid = tpl?.folder?.id ?? null;
      void invalidateTemplateRelatedQueries(qc, userKey, { folderId: fid ?? null, templateId });
      if (fid) router.replace(`/email-marketing/templates/folder/${fid}`);
      else router.replace("/email-marketing/templates");
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch(`/email-marketing/templates/items/${templateId}`, token, { method: "DELETE" }),
    onMutate: async () => {
      const fid = tpl?.folder?.id ?? null;
      await qc.cancelQueries({ queryKey: ["template-items", userKey] });
      qc.setQueriesData<TplBrief[]>(
        { queryKey: ["template-items", userKey] },
        (old) => (Array.isArray(old) ? old.filter((t) => t.id !== templateId) : old),
      );
      if (fid) router.replace(`/email-marketing/templates/folder/${fid}`);
      else router.replace("/email-marketing/templates");
    },
    onError: async (e) => {
      await showAlert(e instanceof Error ? e.message : "Could not delete template.");
      await invalidateTemplateRelatedQueries(qc, userKey, { folderId: tpl?.folder?.id ?? null, templateId });
    },
    onSettled: () => {
      void invalidateTemplateRelatedQueries(qc, userKey, { folderId: tpl?.folder?.id ?? null, templateId });
    },
  });

  async function deleteNow() {
    if (!(await showConfirm("Delete this template? This cannot be undone."))) return;
    remove.mutate();
  }

  const previewVars = useMemo(() => sampleMergeVars(), []);
  const previewSubject = useMemo(
    () => applyMergePreview(subject, previewVars),
    [subject, previewVars],
  );
  const previewBodyHtml = useMemo(() => {
    let html = applyMergePreview(body, previewVars);
    html = expandLgUnsubTokensForPreviewMerged(html);
    const sampleUnsub = "https://app.leadgenor.example/public/unsubscribe?preview=1";
    html = html.split(INLINE_UNSUBSCRIBE_HREF).join(sampleUnsub);
    if (legacyFooterUnsub && !hasInlineUnsubscribeInBody(body)) {
      html += `<hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/><p style="font-size:12px;color:#64748b"><a href="${sampleUnsub}">Unsubscribe</a> (footer)</p>`;
    }
    return html;
  }, [body, legacyFooterUnsub, previewVars]);

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

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <h1 className="mb-5 text-2xl font-bold text-slate-900 dark:text-white">{name.trim() || "Edit template"}</h1>

      <div className="email-template-form space-y-5">
        <div className="space-y-0.5">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Template name</label>
          <input className="tpl-field" value={name} onChange={(e) => setName(e.target.value)} />
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
                  <div
                    className="absolute left-0 top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                    onMouseEnter={() => setAttrOpen(true)}
                    onMouseLeave={() => setAttrOpen(false)}
                  >
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
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/80 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500/40 dark:hover:bg-slate-700/80"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
              {!hasInlineUnsubscribeInBody(body) ? (
                <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <input type="checkbox" checked={legacyFooterUnsub} onChange={(e) => setLegacyFooterUnsub(e.target.checked)} className="rounded border-slate-300" />
                  Default footer link
                </label>
              ) : null}
            </div>
            <MergeHighlightTextarea
              textareaRef={bodyRef}
              selectionRangeRef={bodyRangeRef}
              className="min-h-[280px] rounded-none border-0 text-base leading-relaxed shadow-none ring-0 hover:border-transparent focus-within:border-transparent focus-within:ring-0 dark:hover:border-transparent dark:focus-within:border-transparent dark:focus-within:ring-0"
              value={body}
              onChange={setBody}
              onFocus={() => setAttrTarget("body")}
              placeholder="Write your HTML or plain text email…"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-save-primary" onClick={() => void save.mutate()}>
            Save template
          </button>
          <button
            type="button"
            className="inline-flex rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            title="Delete template"
            disabled={remove.isPending}
            onClick={() => void deleteNow()}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h2 className="text-lg font-semibold">Preview (sample merge data)</h2>
              <p className="mt-1 text-xs text-slate-500">Subject: {previewSubject || "(empty)"}</p>
            </div>
            <div
              className="min-h-[320px] flex-1 overflow-auto bg-white p-4 text-sm dark:bg-slate-800"
              dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
            />
            <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-700">
              <button type="button" className="btn-save-primary-sm" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {unsubCardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Add an unsubscribe link</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Enter the text for an unsubscribe link. LeadGenor will automatically generate and attach a custom unsubscribe link to it.
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-400">Link text</label>
            <input className="tpl-field mt-1" value={unsubAnchorDraft} onChange={(e) => setUnsubAnchorDraft(e.target.value)} placeholder="e.g. Unsubscribe" autoFocus />
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
  );
}
