"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { SheetPreviewPanel } from "@/components/sheet-preview-panel";
import { apiFetch } from "@/lib/api";
import { postImportExport } from "@/lib/post-import-export";
import { useSheetPreview } from "@/hooks/use-sheet-preview";
import { sessionQueryUserKey } from "@/lib/session-query-scope";
import { SHEET_IMPORT_BUSY_HINT } from "@/lib/sheet-import-busy-message";

type VendorRow = { id: string; companyName: string; siteUrl: string };
type ClientRow = { id: string; companyName: string; siteUrl: string };

type Staged = {
  id: string;
  t: "csv" | "sheet" | "vendors" | "clients";
  label: string;
  csv?: string;
  url?: string;
  ids?: string[];
};

function newId() {
  return `st_${Math.random().toString(36).slice(2, 11)}`;
}

function cnTab(active: boolean) {
  return active
    ? "rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white"
    : "rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600";
}

function BankTableW({
  rows,
  empty,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  rows: { id: string; companyName: string; siteUrl: string }[];
  empty: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  if (empty) {
    return <p className="mt-6 text-center text-slate-500">Your databank is empty.</p>;
  }
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const hasSelection = selected.size > 0;
  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        <tr className="border-b dark:border-slate-700">
          <th className="py-2">
            <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => (hasSelection ? onClearAll() : onSelectAll())}
              />
              {hasSelection ? "Deselect" : "Select all"}
            </label>
          </th>
          <th className="py-2">Company</th>
          <th className="py-2">URL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2">
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggle(r.id)} />
            </td>
            <td className="py-2">{r.companyName}</td>
            <td className="max-w-xs truncate py-2 font-mono text-xs">{r.siteUrl}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmailListNewWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listName = (searchParams.get("listName") ?? "").trim();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [importKind, setImportKind] = useState<"menu" | "sheet" | "bank" | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [bankTab, setBankTab] = useState<"vendors" | "clients">("vendors");
  const [bankSel, setBankSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const sheetPreview = useSheetPreview(sheetUrl, token, importKind === "sheet");

  useEffect(() => {
    if (importKind == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [importKind]);

  const vendorsQ = useQuery({
    queryKey: ["vendors-pending-import", userKey],
    queryFn: () =>
      apiFetch<{ data: VendorRow[]; total: number }>("/vendors?dealStatus=PENDING&limit=200", token),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "vendors",
    staleTime: 60_000,
  });

  const clientsQ = useQuery({
    queryKey: ["clients-import", userKey],
    queryFn: () => apiFetch<{ data: ClientRow[]; total: number }>("/clients?limit=200", token),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "clients",
    staleTime: 60_000,
  });

  const canSave = staged.length > 0;
  if (status === "loading") {
    return <div className="em-page mx-auto max-w-6xl p-8 text-slate-500">Loading…</div>;
  }
  if (status !== "authenticated" || !token) {
    return (
      <div className="em-page mx-auto max-w-6xl p-8 text-center">
        <Link href="/login" className="text-indigo-600 underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (!listName) {
    return (
      <div className="em-page mx-auto max-w-6xl p-8">
        <p className="text-slate-600 dark:text-slate-400">Missing list name. Start from My lists.</p>
        <Link href="/email-marketing/lists" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
          My lists
        </Link>
      </div>
    );
  }

  function stageCsvFromText(raw: string, label: string) {
    const c = raw.trim();
    if (!c) {
      void showAlert("CSV is empty.");
      return;
    }
    const id = newId();
    setStaged((s) => [...s, { id, t: "csv", csv: raw, label }]);
    setImportKind(null);
  }

  function stageSheet() {
    const u = sheetUrl.trim();
    if (!u) {
      void showAlert("Paste a Google Sheet link.");
      return;
    }
    const id = newId();
    setStaged((s) => [...s, { id, t: "sheet", url: u, label: "Google Sheet" }]);
    setSheetUrl("");
    setImportKind(null);
  }

  function stageBank() {
    const ids = Array.from(bankSel);
    if (!ids.length) {
      void showAlert("Select at least one row.");
      return;
    }
    const id = newId();
    const label = bankTab === "vendors" ? `Vendors · ${ids.length} selected` : `Clients · ${ids.length} selected`;
    setStaged((s) => [
      ...s,
      {
        id,
        t: bankTab === "vendors" ? "vendors" : "clients",
        ids,
        label,
      },
    ]);
    setBankSel(new Set());
    setImportKind(null);
  }

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const list = await apiFetch<{ id: string }>("/email-marketing/lists", token, {
        method: "POST",
        body: JSON.stringify({ name: listName }),
      });
      for (const op of staged) {
        if (op.t === "csv" && op.csv != null) {
          const r = await postImportExport(`/email-marketing/lists/${list.id}/import/csv`, token, {
            csv: op.csv,
          });
          if (!r.ok) throw new Error(r.message);
        } else if (op.t === "sheet" && op.url) {
          const r = await postImportExport(`/email-marketing/lists/${list.id}/import/sheet`, token, {
            url: op.url,
          });
          if (!r.ok) throw new Error(r.message);
        } else if (op.t === "vendors" && op.ids?.length) {
          await apiFetch(`/email-marketing/lists/${list.id}/import/vendors`, token, {
            method: "POST",
            body: JSON.stringify({ ids: op.ids }),
          });
        } else if (op.t === "clients" && op.ids?.length) {
          await apiFetch(`/email-marketing/lists/${list.id}/import/clients`, token, {
            method: "POST",
            body: JSON.stringify({ ids: op.ids }),
          });
        }
      }
      void qc.invalidateQueries({ queryKey: ["email-lists", userKey] });
      void qc.invalidateQueries({ queryKey: ["email-list", userKey, list.id] });
      void qc.invalidateQueries({ queryKey: ["email-list-items", userKey, list.id] });
      router.push(`/email-marketing/lists/${list.id}`);
    } catch (e) {
      void showAlert(e instanceof Error ? e.message : "Could not save list.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="em-page mx-auto max-w-6xl space-y-6 px-2 pb-28 pt-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New list</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            List name: <span className="font-semibold text-slate-800 dark:text-slate-200">{listName}</span> — not saved
            until you import data and click Save.
          </p>
        </div>
        <Link
          href="/email-marketing/lists"
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Back to My lists
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/50">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Add at least one import below. You can stage multiple imports; they are applied in order when you save.
        </p>
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const input = e.target;
            const f = input.files?.[0];
            input.value = "";
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = typeof reader.result === "string" ? reader.result : "";
              const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;
              stageCsvFromText(text, `CSV · ${f.name} · ~${lines} line(s)`);
            };
            reader.onerror = () => void showAlert("Could not read the file.");
            reader.readAsText(f);
          }}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-toolbar-outline" onClick={() => setImportKind("menu")}>
            <Upload className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
            Import
          </button>
        </div>
        {staged.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {staged.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/50"
              >
                <span className="min-w-0 text-slate-800 dark:text-slate-100">{s.label}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-700"
                  title="Remove"
                  onClick={() => setStaged((x) => x.filter((e) => e.id !== s.id))}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200/90">No imports staged yet — Save stays disabled.</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className="text-sm font-medium text-slate-600 transition hover:underline dark:text-slate-400"
            onClick={() => router.push("/email-marketing/lists")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-save-primary-sm"
            disabled={!canSave || saving}
            onClick={() => void onSave()}
          >
            {saving ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Saving…
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
        {saving && staged.some((s) => s.t === "sheet") ? (
          <p className="max-w-md text-right text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {SHEET_IMPORT_BUSY_HINT}
          </p>
        ) : null}
      </div>

      {importKind === "menu" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Import</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 py-2 px-4 text-left dark:border-slate-600"
                onClick={() => {
                  setImportKind(null);
                  window.setTimeout(() => csvFileInputRef.current?.click(), 0);
                }}
              >
                Upload CSV file…
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 py-2 px-4 text-left dark:border-slate-600"
                onClick={() => setImportKind("sheet")}
              >
                Paste Google Sheets link
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 py-2 px-4 text-left dark:border-slate-600"
                onClick={() => setImportKind("bank")}
              >
                From My DataBanks
              </button>
            </div>
            <button type="button" className="mt-4 text-sm text-slate-500" onClick={() => setImportKind(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {importKind === "sheet" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/40 p-4">
          <div className="flex max-h-[min(88vh,calc(100dvh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-5 pb-3 pt-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold">Google Sheet</h2>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Close"
                onClick={() => setImportKind(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share the sheet as &quot;Anyone with the link&quot; (viewer). Columns load automatically from the first row.
              </p>
              <input
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <SheetPreviewPanel
                loading={sheetPreview.loading}
                error={sheetPreview.error}
                data={sheetPreview.data}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setImportKind("menu")}>
                  Back
                </button>
                <button type="button" className="btn-save-primary-sm" onClick={stageSheet}>
                  Add to import queue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {importKind === "bank" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">From My DataBanks</h2>
            <div className="mt-3 flex gap-2">
              <button type="button" className={cnTab(bankTab === "vendors")} onClick={() => setBankTab("vendors")}>
                Vendors (Pending deals)
              </button>
              <button type="button" className={cnTab(bankTab === "clients")} onClick={() => setBankTab("clients")}>
                Clients (Total)
              </button>
            </div>
            {bankTab === "vendors" ? (
              <BankTableW
                rows={vendorsQ.data?.data ?? []}
                empty={!vendorsQ.data?.data?.length}
                selected={bankSel}
                onToggle={(id) => {
                  const n = new Set(bankSel);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  setBankSel(n);
                }}
                onSelectAll={() => {
                  setBankSel(new Set((vendorsQ.data?.data ?? []).map((r) => r.id)));
                }}
                onClearAll={() => setBankSel(new Set())}
              />
            ) : (
              <BankTableW
                rows={clientsQ.data?.data ?? []}
                empty={!clientsQ.data?.data?.length}
                selected={bankSel}
                onToggle={(id) => {
                  const n = new Set(bankSel);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  setBankSel(n);
                }}
                onSelectAll={() => {
                  setBankSel(new Set((clientsQ.data?.data ?? []).map((r) => r.id)));
                }}
                onClearAll={() => setBankSel(new Set())}
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImportKind("menu")}>
                Back
              </button>
              <button
                type="button"
                className="btn-save-primary-sm"
                disabled={!bankSel.size}
                onClick={stageBank}
              >
                Add to import queue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
