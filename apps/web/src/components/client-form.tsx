"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, FileUp, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PickerModal } from "@/components/picker-modal";
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";
import { EmailTagsInput } from "@/components/email-tags-input";
import { FormSectionCard } from "@/components/form-section-card";
import { RefIdChipsField } from "@/components/ref-id-chips-field";
import { useReference } from "@/hooks/use-reference";
import { apiFetch, apiUrl } from "@/lib/api";
import { isDuplicateUrlResponse } from "@/lib/duplicate-url-error";
import { parseEmailsClient } from "@/lib/emails-input";
import { normalizeSiteUrlInput } from "@/lib/site-url";
import { StepperField } from "@/components/stepper-field";
import { CLIENT_COUNTRY_MAX, CLIENT_NICHE_MAX } from "@/lib/vendor-client-form-limits";
import { cn } from "@/lib/utils";
import { findEmailsFromUrl } from "@/lib/email-finder";

const empty = {
  companyName: "",
  clientName: "",
  siteUrl: "",
  nicheIds: [] as string[],
  countryIds: [] as string[],
  languageId: "",
  traffic: null as number | null,
  dr: null as number | null,
  mozDa: null as number | null,
  authorityScore: null as number | null,
  referringDomains: null as number | null,
  backlinks: null as number | null,
  email: "",
  whatsapp: "",
};

function FormLoadingState({ message }: { message: string }) {
  return (
    <div
      className="animate-pulse space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{ minHeight: 120 }}
    >
      <p className="text-sm text-slate-600">{message}</p>
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-40 rounded-xl bg-slate-200" />
    </div>
  );
}

export function ClientForm({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;
  const { data: ref, isLoading: refLoading, isError, error } = useReference();
  const [form, setForm] = useState(empty);
  const [dupModal, setDupModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [findingEmail, setFindingEmail] = useState(false);
  const [findEmailMsg, setFindEmailMsg] = useState<string | null>(null);
  const [nicheOpen, setNicheOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [qNiche, setQNiche] = useState("");
  const [qCountry, setQCountry] = useState("");
  const [qLang, setQLang] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    async function load() {
      if (!clientId || !token) return;
      const c = await apiFetch<Record<string, unknown>>(`/clients/${clientId}`, token);
      const niches = c.niches as { nicheId: string }[];
      const countries = c.countries as { countryId: string }[];
      setForm({
        companyName: String(c.companyName),
        clientName: String(c.clientName),
        siteUrl: String(c.siteUrl),
        nicheIds: niches.map((x) => x.nicheId),
        countryIds: countries.map((x) => x.countryId),
        languageId: String(c.languageId),
        traffic: Number(c.traffic),
        dr: Number(c.dr),
        mozDa: Number(c.mozDa),
        authorityScore: Number(c.authorityScore),
        referringDomains: Number(c.referringDomains),
        backlinks: Number(c.backlinks),
        email: String(c.email),
        whatsapp: String(c.whatsapp || ""),
      });
    }
    void load();
  }, [clientId, token]);

  const filteredNiches = useMemo(() => {
    if (!ref?.niches) return [];
    const q = qNiche.trim().toLowerCase();
    if (!q) return ref.niches;
    return ref.niches.filter((n) => n.label.toLowerCase().includes(q) || n.slug.toLowerCase().includes(q));
  }, [ref?.niches, qNiche]);

  const filteredCountries = useMemo(() => {
    if (!ref?.countries) return [];
    const q = qCountry.trim().toLowerCase();
    if (!q) return ref.countries;
    return ref.countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [ref?.countries, qCountry]);

  const filteredLanguages = useMemo(() => {
    if (!ref?.languages) return [];
    const q = qLang.trim().toLowerCase();
    if (!q) return ref.languages;
    return ref.languages.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }, [ref?.languages, qLang]);

  const selectedLanguageName = useMemo(() => {
    if (!form.languageId || !ref?.languages) return "";
    return ref.languages.find((l) => l.id === form.languageId)?.name ?? "";
  }, [form.languageId, ref?.languages]);

  function validateFields(): boolean {
    const e: Record<string, string> = {};
    if (!form.siteUrl.trim()) e.siteUrl = "Site URL is required.";
    const emails = parseEmailsClient(form.email);
    if (emails.length < 1) {
      e.email = form.email.trim() ? "Enter at least one valid email address." : "Email is required.";
    }
    if (form.nicheIds.length < 1) e.nicheIds = "Select at least one niche.";
    if (form.countryIds.length < 1) e.countryIds = "Select at least one country.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save(force?: boolean) {
    setSaveError(null);
    if (!token) {
      setSaveError("You are not signed in.");
      return;
    }
    if (!validateFields()) return;
    setSaving(true);
    const url = force && !clientId ? apiUrl("/clients/force") : apiUrl(clientId ? `/clients/${clientId}` : "/clients");
    const method = clientId ? "PUT" : "POST";
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries({
              ...form,
              siteUrl: normalizeSiteUrlInput(form.siteUrl),
              whatsapp: form.whatsapp || undefined,
            }).filter(([, v]) => v !== null),
          ),
        ),
      });
    } finally {
      setSaving(false);
    }
    if (res.status === 400) {
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (isDuplicateUrlResponse(j)) {
        setSaveError(null);
        setDupModal(true);
        return;
      }
      const msg = j.message;
      const text =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? (msg as { property?: string; constraints?: Record<string, string> }[])
                .map((m) => `${m.property ?? "field"}: ${Object.values(m.constraints ?? {}).join(", ")}`)
                .join("; ")
            : JSON.stringify(j);
      setSaveError(text || "Validation failed");
      return;
    }
    if (!res.ok) {
      setSaveError((await res.text()) || "Save failed");
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  async function onImportCsv(file: File | null) {
    setImportMsg(null);
    if (!file || !token) return;
    const text = await file.text();
    const res = await fetch(apiUrl("/import-export/clients/csv"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csv: text }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      imported?: number;
      errors?: string[];
    };
    if (!res.ok) {
      const err = j.message;
      const errText = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(errText || "Import failed.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} client(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function onImportFromSheet() {
    setImportMsg(null);
    if (!token || !sheetUrl.trim()) return;
    const res = await fetch(apiUrl("/import-export/clients/from-sheet"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: sheetUrl.trim() }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      imported?: number;
      errors?: string[];
    };
    if (!res.ok) {
      const err = j.message;
      const errText = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(errText || "Could not fetch sheet.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} client(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["clients"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  if (sessionStatus === "loading") {
    return <FormLoadingState message="Checking session…" />;
  }

  if (sessionStatus === "unauthenticated" || !token) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
        style={{ maxWidth: 480 }}
      >
        <p className="font-medium">Sign in required</p>
        <p className="mt-1 text-amber-900/90">You must be logged in to add or edit clients.</p>
        <Link href="/login" className="mt-3 inline-block font-semibold text-brand-700 underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm"
        style={{ maxWidth: 560 }}
      >
        <p className="font-semibold">Could not load form data</p>
        <p className="mt-2 whitespace-pre-wrap">{msg}</p>
      </div>
    );
  }

  if (refLoading || !ref) {
    return <FormLoadingState message="Loading niches, countries, and languages…" />;
  }

  return (
    <div className="w-full max-w-5xl pb-10">
      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import clients"
        subtitle="CSV file or a public Google Sheet link"
        token={token}
        sheetUrl={sheetUrl}
        onSheetUrlChange={setSheetUrl}
        importMsg={importMsg}
        onPickCsv={(f) => void onImportCsv(f)}
        onImportFromSheet={() => void onImportFromSheet()}
      />

      {dupModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-client-title"
        >
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-800">
            <h2 id="dup-client-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Duplicate site
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              This site already exists in your client list. Do you want to add it again?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setDupModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save-primary-sm"
                onClick={() => {
                  setDupModal(false);
                  void save(true);
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <PickerModal
        open={nicheOpen}
        title="Niche"
        subtitle="1–5 selections"
        onClose={() => setNicheOpen(false)}
        search={qNiche}
        onSearchChange={setQNiche}
        compact
      >
        <div className="flex w-full flex-col items-start gap-1">
          {filteredNiches.map((n) => (
            <label
              key={n.id}
              className={cn(
                "inline-flex w-fit max-w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg border py-1.5 pl-2 pr-2 text-sm transition",
                form.nicheIds.includes(n.id)
                  ? "border-brand-500 bg-brand-50 text-brand-900"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 rounded border-slate-300"
                checked={form.nicheIds.includes(n.id)}
                onChange={() => {
                  clearFieldError("nicheIds");
                  const set = new Set(form.nicheIds);
                  if (set.has(n.id)) set.delete(n.id);
                  else if (set.size < CLIENT_NICHE_MAX) set.add(n.id);
                  setForm({ ...form, nicheIds: [...set] });
                }}
              />
              <span>{n.label}</span>
            </label>
          ))}
        </div>
      </PickerModal>

      <PickerModal
        open={countryOpen}
        title="Country"
        subtitle="1–3 selections"
        onClose={() => setCountryOpen(false)}
        search={qCountry}
        onSearchChange={setQCountry}
        compact
      >
        <div className="flex w-full flex-col items-start gap-1">
          {filteredCountries.map((c) => (
            <label
              key={c.id}
              className={cn(
                "inline-flex w-fit max-w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg border py-1.5 pl-2 pr-2 text-sm transition",
                form.countryIds.includes(c.id)
                  ? "border-brand-500 bg-brand-50 text-brand-900"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 rounded border-slate-300"
                checked={form.countryIds.includes(c.id)}
                onChange={() => {
                  clearFieldError("countryIds");
                  const set = new Set(form.countryIds);
                  if (set.has(c.id)) set.delete(c.id);
                  else if (set.size < CLIENT_COUNTRY_MAX) set.add(c.id);
                  setForm({ ...form, countryIds: [...set] });
                }}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </PickerModal>

      <PickerModal
        open={languageOpen}
        title="Language"
        subtitle="Select one"
        onClose={() => setLanguageOpen(false)}
        search={qLang}
        onSearchChange={setQLang}
        compact
      >
        <div className="flex w-full flex-col items-start gap-1">
          {filteredLanguages.map((l) => (
            <label
              key={l.id}
              className={cn(
                "inline-flex w-fit max-w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg border py-1.5 pl-2 pr-2 text-sm transition",
                form.languageId === l.id
                  ? "border-brand-500 bg-brand-50 font-medium text-brand-900"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 rounded border-slate-300"
                checked={form.languageId === l.id}
                onChange={() => {
                  clearFieldError("languageId");
                  setForm({ ...form, languageId: l.id });
                }}
              />
              <span>{l.name}</span>
            </label>
          ))}
        </div>
      </PickerModal>

      {!clientId && (
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Add New Client
            </h1>
            <button
              type="button"
              onClick={() => {
                setImportMsg(null);
                setImportOpen(true);
              }}
              className="btn-toolbar-outline shrink-0 self-start"
            >
              <FileUp className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
              Import
            </button>
          </div>
          <div className="mt-4 border-b border-slate-200 dark:border-slate-700" aria-hidden />
        </div>
      )}

      <div className="space-y-6">
        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</div>
        )}

        <FormSectionCard title="Basic information">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="form-label-sm">Company name</span>
              <input
                className={cn("form-input-body", fieldErrors.companyName && "form-input-body-invalid")}
                placeholder="e.g. Acme Inc."
                value={form.companyName}
                onChange={(e) => {
                  clearFieldError("companyName");
                  setForm({ ...form, companyName: e.target.value });
                }}
              />
              {fieldErrors.companyName ? <p className="form-field-error">{fieldErrors.companyName}</p> : null}
            </label>
            <label className="block">
              <span className="form-label-sm">Client name</span>
              <input
                className={cn("form-input-body", fieldErrors.clientName && "form-input-body-invalid")}
                value={form.clientName}
                onChange={(e) => {
                  clearFieldError("clientName");
                  setForm({ ...form, clientName: e.target.value });
                }}
              />
              {fieldErrors.clientName ? <p className="form-field-error">{fieldErrors.clientName}</p> : null}
            </label>
          </div>

          <label className="block">
            <span className="form-label-sm">
              Site URL <span className="text-red-500">*</span>
            </span>
            <input
              className={cn("form-input-body", fieldErrors.siteUrl && "form-input-body-invalid")}
              placeholder="https://example.com"
              value={form.siteUrl}
              onChange={(e) => {
                clearFieldError("siteUrl");
                setForm({ ...form, siteUrl: e.target.value });
              }}
              onBlur={(e) => setForm({ ...form, siteUrl: normalizeSiteUrlInput(e.target.value) })}
            />
            {fieldErrors.siteUrl ? <p className="form-field-error">{fieldErrors.siteUrl}</p> : null}
          </label>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RefIdChipsField
            label="Niche"
            required
            ids={form.nicheIds}
            max={CLIENT_NICHE_MAX}
            options={(ref.niches ?? []).map((n) => ({ id: n.id, label: n.label }))}
            onChange={(nicheIds) => {
              clearFieldError("nicheIds");
              setForm({ ...form, nicheIds });
            }}
            onOpenPicker={() => {
              clearFieldError("nicheIds");
              setNicheOpen(true);
            }}
            error={fieldErrors.nicheIds}
          />
          <RefIdChipsField
            label="Country"
            required
            ids={form.countryIds}
            max={CLIENT_COUNTRY_MAX}
            options={(ref.countries ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }))}
            onChange={(countryIds) => {
              clearFieldError("countryIds");
              setForm({ ...form, countryIds });
            }}
            onOpenPicker={() => {
              clearFieldError("countryIds");
              setCountryOpen(true);
            }}
            error={fieldErrors.countryIds}
          />
          <label className="block">
            <span className="form-label-sm">Traffic</span>
            <div className="mt-1">
              <StepperField
                mode="int"
                min={0}
                aria-label="Traffic"
                value={form.traffic}
                onChange={(v) => setForm({ ...form, traffic: v })}
              />
            </div>
          </label>
          <div>
            <span className="form-label-sm">Language</span>
            <button
              type="button"
              onClick={() => {
                clearFieldError("languageId");
                setLanguageOpen(true);
              }}
              className={cn("form-trigger-body", fieldErrors.languageId && "form-input-body-invalid")}
            >
              <span className={cn("truncate", selectedLanguageName ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-300")}>
                {selectedLanguageName || "Choose…"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
            </button>
            {fieldErrors.languageId ? <p className="form-field-error">{fieldErrors.languageId}</p> : null}
          </div>
        </div>
        </FormSectionCard>

        <FormSectionCard title="SEO metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["dr", "DR"],
              ["mozDa", "Moz DA"],
              ["authorityScore", "Authority score"],
              ["referringDomains", "Ref. domains"],
              ["backlinks", "Backlinks"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="form-label-sm">{label}</span>
              <div className="mt-1">
                <StepperField
                  mode="int"
                  min={0}
                  max={k === "dr" || k === "mozDa" || k === "authorityScore" ? 100 : undefined}
                  aria-label={label}
                  value={form[k]}
                  onChange={(v) => setForm({ ...form, [k]: v })}
                />
              </div>
            </label>
          ))}
        </div>
        </FormSectionCard>

        <FormSectionCard title="Contact">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label-sm">
              Email <span className="text-red-500">*</span>
            </span>
            <div className="relative mt-1">
              <EmailTagsInput
                value={form.email}
                invalid={!!fieldErrors.email}
                aria-invalid={fieldErrors.email ? "true" : undefined}
                onChange={(email) => {
                  clearFieldError("email");
                  setForm({ ...form, email });
                }}
              />
              {!form.email.trim() ? (
                <button
                  type="button"
                  disabled={findingEmail || !form.siteUrl.trim()}
                  onClick={async () => {
                    if (!token) return;
                    const url = form.siteUrl.trim();
                    if (!url) {
                      setFindEmailMsg("Add site URL first.");
                      return;
                    }
                    setFindEmailMsg(null);
                    setFindingEmail(true);
                    try {
                      const r = await findEmailsFromUrl(token, url);
                      if (!r.emails?.length) {
                        setFindEmailMsg("Not found");
                        return;
                      }
                      setForm((f) => ({ ...f, email: r.emails.join(", ") }));
                    } catch {
                      setFindEmailMsg("Not found");
                    } finally {
                      setFindingEmail(false);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Find emails from the website"
                >
                  {findingEmail ? "Finding…" : "Find email"}
                </button>
              ) : null}
            </div>
            {fieldErrors.email ? <p className="form-field-error">{fieldErrors.email}</p> : null}
            {findEmailMsg ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{findEmailMsg}</p> : null}
          </label>
          <label className="block">
            <span className="form-label-sm">WhatsApp</span>
            <input
              className="form-input-body"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="Optional"
            />
          </label>
        </div>
        </FormSectionCard>

        <div className="mt-2">
          <button
            type="button"
            className="btn-save-primary inline-flex items-center gap-2"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {clientId ? "Save changes" : "Save client"}
          </button>
        </div>
      </div>
    </div>
  );
}
