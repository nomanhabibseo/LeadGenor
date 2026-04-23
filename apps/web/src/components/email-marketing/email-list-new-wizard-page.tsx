"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

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
  return (
    <table className="mt-4 w-full text-left text-sm">
      <thead>
        <tr className="border-b dark:border-slate-700">
          <th className="py-2">
            <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => (allSelected ? onClearAll() : onSelectAll())}
              />
              Select all
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
  const [importKind, setImportKind] = useState<"menu" | "csv" | "sheet" | "bank" | null>(null);
  const [csvText, setCsvText] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [bankTab, setBankTab] = useState<"vendors" | "clients">("vendors");
  const [bankSel, setBankSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const vendorsQ = useQuery({
    queryKey: ["vendors-pending-import", userKey],
    queryFn: () =>
      apiFetch<{ data: VendorRow[]; total: number }>("/vendors?dealStatus=PENDING&limit=200", token),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "vendors",
  });

  const clientsQ = useQuery({
    queryKey: ["clients-import", userKey],
    queryFn: () => apiFetch<{ data: ClientRow[]; total: number }>("/clients?limit=200", token),
    enabled: status === "authenticated" && !!token && !!userKey && importKind === "bank" && bankTab === "clients",
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

  function stageCsv() {
    const c = csvText.trim();
    if (!c) {
      void showAlert("Paste CSV content first.");
      return;
    }
    const id = newId();
    const lines = c.split(/\r?\n/).filter((l) => l.trim()).length;
    setStaged((s) => [
      ...s,
      { id, t: "csv", csv: csvText, label: `CSV · ~${lines} line(s)` },
    ]);
    setCsvText("");
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
          await apiFetch(`/email-marketing/lists/${list.id}/import/csv`, token, {
            method: "POST",
            body: JSON.stringify({ csv: op.csv }),
          });
        } else if (op.t === "sheet" && op.url) {
          await apiFetch(`/email-marketing/lists/${list.id}/import/sheet`, token, {
            method: "POST",
            body: JSON.stringify({ url: op.url }),
          });
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
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {importKind === "menu" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Import</h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 py-2 px-4 text-left dark:border-slate-600"
                onClick={() => setImportKind("csv")}
              >
                Upload CSV
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

      {importKind === "csv" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Import CSV</h2>
            <p className="mt-2 text-xs text-slate-500">Paste CSV with headers (site_url, company_name, emails, …).</p>
            <textarea
              className="mt-3 h-48 w-full rounded-lg border border-slate-200 p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setImportKind("menu")}>
                Back
              </button>
              <button type="button" className="btn-save-primary-sm" onClick={stageCsv}>
                Add to import queue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importKind === "sheet" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="text-lg font-semibold">Google Sheet</h2>
            <input
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
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
