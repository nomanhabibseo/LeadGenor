"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, FileUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useReference } from "@/hooks/use-reference";
import { apiFetch, apiUrl } from "@/lib/api";
import { isDuplicateUrlResponse } from "@/lib/duplicate-url-error";
import { parseEmailsClient } from "@/lib/emails-input";
import { normalizeSiteUrlInput } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { PickerModal } from "@/components/picker-modal";
import { ImportSpreadsheetModal } from "@/components/import-spreadsheet-modal";

const empty = {
  companyName: "",
  siteUrl: "",
  nicheIds: [] as string[],
  traffic: 0,
  countryIds: [] as string[],
  languageId: "",
  dr: 0,
  mozDa: 0,
  authorityScore: 0,
  referringDomains: 0,
  backlinks: 0,
  trustFlow: 0,
  tatUnit: "DAYS" as "HOURS" | "DAYS",
  tatValue: 1,
  currencyId: "",
  guestPostCost: 0,
  nicheEditCost: 0,
  guestPostPrice: 0,
  nicheEditPrice: 0,
  paymentTerms: "ADVANCE" as "ADVANCE" | "AFTER_LIVE_LINK",
  afterLiveOptionId: "" as string | undefined,
  paymentMethodIds: [] as string[],
  contactEmail: "",
  contactPageUrl: "",
  dealStatus: "PENDING" as "DEAL_DONE" | "PENDING",
  recordDate: "",
  notes: "",
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

export function VendorForm({ vendorId }: { vendorId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;
  const { data: ref, isLoading: refLoading, isError, error } = useReference();
  const [form, setForm] = useState(empty);
  const [dupModal, setDupModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nicheOpen, setNicheOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [qNiche, setQNiche] = useState("");
  const [qCountry, setQCountry] = useState("");
  const [qLang, setQLang] = useState("");
  const [qPay, setQPay] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function loadEdit() {
    if (!vendorId || !token) return;
    const v = await apiFetch<Record<string, unknown>>(`/vendors/${vendorId}`, token);
    const niches = v.niches as { nicheId: string }[];
    const countries = v.countries as { countryId: string }[];
    const pms = v.paymentMethods as { paymentMethodId: string }[];
    setForm({
      companyName: String(v.companyName),
      siteUrl: String(v.siteUrl),
      nicheIds: niches.map((x) => x.nicheId),
      traffic: Number(v.traffic),
      countryIds: countries.map((x) => x.countryId),
      languageId: String(v.languageId),
      dr: Number(v.dr),
      mozDa: Number(v.mozDa),
      authorityScore: Number(v.authorityScore),
      referringDomains: Number(v.referringDomains),
      backlinks: Number(v.backlinks),
      trustFlow: Number(v.trustFlow),
      tatUnit: v.tatUnit as "HOURS" | "DAYS",
      tatValue: Number(v.tatValue),
      currencyId: String(v.currencyId),
      guestPostCost: Number(v.guestPostCost as string | number),
      nicheEditCost: Number(v.nicheEditCost as string | number),
      guestPostPrice: Number(v.guestPostPrice as string | number),
      nicheEditPrice: Number(v.nicheEditPrice as string | number),
      paymentTerms: v.paymentTerms as "ADVANCE" | "AFTER_LIVE_LINK",
      afterLiveOptionId: (v.afterLiveOptionId as string) || "",
      paymentMethodIds: pms.map((x) => x.paymentMethodId),
      contactEmail: String(v.contactEmail),
      contactPageUrl: String(v.contactPageUrl || ""),
      dealStatus: v.dealStatus as "DEAL_DONE" | "PENDING",
      recordDate: v.recordDate ? String(v.recordDate).slice(0, 10) : "",
      notes: String(v.notes || ""),
    });
  }

  useEffect(() => {
    void loadEdit();
  }, [vendorId, token]); // eslint-disable-line react-hooks/exhaustive-deps -- load when vendor route or session changes only

  useEffect(() => {
    if (!ref?.currencies?.length || vendorId) return;
    const usd = ref.currencies.find((c) => c.code === "USD");
    if (!usd) return;
    setForm((f) => (f.currencyId ? f : { ...f, currencyId: usd.id }));
  }, [ref, vendorId]);

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

  const filteredPaymentMethods = useMemo(() => {
    if (!ref?.paymentMethods) return [];
    const q = qPay.trim().toLowerCase();
    if (!q) return ref.paymentMethods;
    return ref.paymentMethods.filter((p) => p.label.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [ref?.paymentMethods, qPay]);

  const selectedLanguageName = useMemo(() => {
    if (!form.languageId || !ref?.languages) return "";
    return ref.languages.find((l) => l.id === form.languageId)?.name ?? "";
  }, [form.languageId, ref?.languages]);

  const body = () => ({
    ...form,
    siteUrl: normalizeSiteUrlInput(form.siteUrl),
    afterLiveOptionId: form.paymentTerms === "AFTER_LIVE_LINK" ? form.afterLiveOptionId || undefined : undefined,
    recordDate: form.recordDate || undefined,
    contactPageUrl: form.contactPageUrl?.trim() || undefined,
    notes: form.notes || undefined,
  });

  function validateFields(): boolean {
    const e: Record<string, string> = {};
    if (!form.siteUrl.trim()) e.siteUrl = "Site URL is required.";
    const emails = parseEmailsClient(form.contactEmail);
    if (emails.length < 1) {
      e.contactEmail = form.contactEmail.trim()
        ? "Enter at least one valid email address."
        : "Email is required.";
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
    const url = force && !vendorId ? apiUrl("/vendors/force") : apiUrl(vendorId ? `/vendors/${vendorId}` : "/vendors");
    const res = await fetch(url, {
      method: vendorId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body()),
    });
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
    router.push("/vendors");
    router.refresh();
  }

  async function onImportCsv(file: File | null) {
    setImportMsg(null);
    if (!file || !token) return;
    const text = await file.text();
    const res = await fetch(apiUrl("/import-export/vendors/csv"), {
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
      const text = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(text || "Import failed. Check file format.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} vendor(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["vendors"] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  }

  async function onImportFromSheet() {
    setImportMsg(null);
    if (!token || !sheetUrl.trim()) return;
    const res = await fetch(apiUrl("/import-export/vendors/from-sheet"), {
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
      const text = Array.isArray(err) ? err.join(", ") : err;
      setImportMsg(text || "Could not fetch sheet. Check sharing and URL.");
      return;
    }
    const lines: string[] = [];
    if (j.imported != null) lines.push(`Imported ${j.imported} vendor(s).`);
    if (j.message) {
      if (Array.isArray(j.message)) lines.push(...j.message);
      else lines.push(j.message);
    }
    if (j.errors?.length) lines.push(...j.errors.slice(0, 12));
    setImportMsg(lines.join("\n") || "Import finished.");
    void qc.invalidateQueries({ queryKey: ["vendors"] });
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
        <p className="mt-1 text-amber-900/90">You must be logged in to add or edit vendors.</p>
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
        <p className="mt-3 text-xs text-red-800/90">
          Start the API on port 4000 (<code className="rounded bg-red-100 px-1">npm run dev</code> from the project root)
          and ensure <code className="rounded bg-red-100 px-1">NEXT_PUBLIC_API_URL</code> in{" "}
          <code className="rounded bg-red-100 px-1">apps/web/.env.local</code> points to it.
        </p>
      </div>
    );
  }

  if (refLoading || !ref) {
    return <FormLoadingState message="Loading niches, countries, and currencies…" />;
  }

  return (
    <div className="w-full max-w-5xl pb-10">
      {dupModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dup-vendor-title"
        >
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <h2 id="dup-vendor-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Duplicate site
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              This site already exists in your total vendors list. Do you want to add it again?
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

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import vendors"
        subtitle="CSV file or a public Google Sheet link"
        token={token}
        sheetUrl={sheetUrl}
        onSheetUrlChange={setSheetUrl}
        importMsg={importMsg}
        onPickCsv={(f) => void onImportCsv(f)}
        onImportFromSheet={() => void onImportFromSheet()}
      />

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
                  else if (set.size < 5) set.add(n.id);
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
                  else if (set.size < 3) set.add(c.id);
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

      <PickerModal
        open={payOpen}
        title="Payment methods"
        subtitle="1–5 selections"
        onClose={() => setPayOpen(false)}
        search={qPay}
        onSearchChange={setQPay}
        compact
      >
        <div className="flex w-full flex-col items-start gap-1">
          {filteredPaymentMethods.map((p) => (
            <label
              key={p.id}
              className={cn(
                "inline-flex w-fit max-w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg border py-1.5 pl-2 pr-2 text-sm transition",
                form.paymentMethodIds.includes(p.id)
                  ? "border-brand-500 bg-brand-50 text-brand-900"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 rounded border-slate-300"
                checked={form.paymentMethodIds.includes(p.id)}
                onChange={() => {
                  const set = new Set(form.paymentMethodIds);
                  if (set.has(p.id)) set.delete(p.id);
                  else if (set.size < 5) set.add(p.id);
                  setForm({ ...form, paymentMethodIds: [...set] });
                }}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </PickerModal>

      {!vendorId && (
        <div className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Add New Vendor</h1>
            <button
              type="button"
              onClick={() => {
                setImportMsg(null);
                setImportOpen(true);
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <FileUp className="h-4 w-4 text-brand-600" />
              Import
            </button>
          </div>
          <div className="mt-4 border-b border-slate-200" aria-hidden />
        </div>
      )}

      <div className="space-y-5">
        {saveError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label-sm">Company name</span>
            <input
              className={cn("form-input-body", fieldErrors.companyName && "form-input-body-invalid")}
              value={form.companyName}
              onChange={(e) => {
                clearFieldError("companyName");
                setForm({ ...form, companyName: e.target.value });
              }}
            />
            {fieldErrors.companyName ? <p className="form-field-error">{fieldErrors.companyName}</p> : null}
          </label>
          <label className="block">
            <span className="form-label-sm">Site URL</span>
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <span className="form-label-sm">Niche</span>
            <button
              type="button"
              onClick={() => {
                clearFieldError("nicheIds");
                setNicheOpen(true);
              }}
              className={cn("form-trigger-body", fieldErrors.nicheIds && "form-input-body-invalid")}
            >
              <span className={cn("truncate", form.nicheIds.length ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-300")}>
                {form.nicheIds.length ? `${form.nicheIds.length} selected` : "Choose…"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
            </button>
            {fieldErrors.nicheIds ? <p className="form-field-error">{fieldErrors.nicheIds}</p> : null}
          </div>
          <label className="block">
            <span className="form-label-sm">Traffic</span>
            <input
              type="number"
              min={0}
              className="form-input-body"
              value={form.traffic}
              onChange={(e) => setForm({ ...form, traffic: Number(e.target.value) || 0 })}
            />
          </label>
          <div>
            <span className="form-label-sm">Country</span>
            <button
              type="button"
              onClick={() => {
                clearFieldError("countryIds");
                setCountryOpen(true);
              }}
              className={cn("form-trigger-body", fieldErrors.countryIds && "form-input-body-invalid")}
            >
              <span className={cn("truncate", form.countryIds.length ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-300")}>
                {form.countryIds.length ? `${form.countryIds.length} selected` : "Choose…"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
            </button>
            {fieldErrors.countryIds ? <p className="form-field-error">{fieldErrors.countryIds}</p> : null}
          </div>
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["dr", "DR"],
              ["mozDa", "Moz DA"],
              ["authorityScore", "Authority score"],
              ["referringDomains", "Ref. domains"],
              ["backlinks", "Backlinks"],
              ["trustFlow", "Trust flow"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="form-label-sm">{label}</span>
              <input
                type="number"
                min={0}
                max={k === "dr" || k === "mozDa" || k === "authorityScore" ? 100 : undefined}
                className="form-input-body"
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) || 0 })}
              />
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="form-label-sm">TAT (turnaround)</span>
            <div className="mt-1 flex w-full max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900/70">
              <select
                className="border-0 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500/30 dark:bg-slate-800/90 dark:text-slate-100"
                value={form.tatUnit}
                onChange={(e) => setForm({ ...form, tatUnit: e.target.value as "HOURS" | "DAYS" })}
              >
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
              </select>
              <input
                type="number"
                min={0}
                className="min-w-0 flex-1 border-0 bg-white px-2 py-2 text-sm font-semibold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500/30 dark:bg-transparent dark:text-slate-100"
                value={form.tatValue}
                onChange={(e) => setForm({ ...form, tatValue: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <label className="block sm:col-span-1">
            <span className="form-label-sm">Currency</span>
            <select
              className="form-input-body"
              value={form.currencyId}
              onChange={(e) => setForm({ ...form, currencyId: e.target.value })}
            >
              {ref.currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="form-label-sm">Guest post cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input-body"
                value={form.guestPostCost}
                onChange={(e) => setForm({ ...form, guestPostCost: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block">
              <span className="form-label-sm">Niche edit cost</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input-body"
                value={form.nicheEditCost}
                onChange={(e) => setForm({ ...form, nicheEditCost: Number(e.target.value) || 0 })}
              />
            </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="form-label-sm">Guest Post Reselling Price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input-body"
                value={form.guestPostPrice}
                onChange={(e) => setForm({ ...form, guestPostPrice: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block">
              <span className="form-label-sm">Niche Edit Reselling Price</span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input-body"
                value={form.nicheEditPrice}
                onChange={(e) => setForm({ ...form, nicheEditPrice: Number(e.target.value) || 0 })}
              />
            </label>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="block min-w-[200px] flex-1">
            <span className="form-label-sm">Payment terms</span>
            <select
              className="form-input-body"
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value as "ADVANCE" | "AFTER_LIVE_LINK" })}
            >
              <option value="ADVANCE">Advance</option>
              <option value="AFTER_LIVE_LINK">After live link</option>
            </select>
          </label>
          {form.paymentTerms === "AFTER_LIVE_LINK" ? (
            <label className="block min-w-[200px] flex-1">
              <span className="form-label-sm">After live — timing</span>
              <select
                className="form-input-body"
                value={form.afterLiveOptionId}
                onChange={(e) => setForm({ ...form, afterLiveOptionId: e.target.value })}
              >
                <option value="">Choose…</option>
                {ref.afterLiveOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="min-w-[200px] flex-1">
            <span className="form-label-sm">Payment methods</span>
            <button type="button" onClick={() => setPayOpen(true)} className="form-trigger-body">
              <span className={cn("truncate", form.paymentMethodIds.length ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-300")}>
                {form.paymentMethodIds.length ? `${form.paymentMethodIds.length} selected` : "Choose…"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label-sm">Email</span>
            <textarea
              className={cn("form-input-body min-h-[72px] resize-y", fieldErrors.contactEmail && "form-input-body-invalid")}
              rows={3}
              placeholder="One or more emails, separated by comma, semicolon, or newline"
              value={form.contactEmail}
              onChange={(e) => {
                clearFieldError("contactEmail");
                setForm({ ...form, contactEmail: e.target.value });
              }}
            />
            {fieldErrors.contactEmail ? <p className="form-field-error">{fieldErrors.contactEmail}</p> : null}
          </label>
          <label className="block">
            <span className="form-label-sm">Contact page URL</span>
            <input
              className="form-input-body"
              placeholder="https://…"
              value={form.contactPageUrl}
              onChange={(e) => setForm({ ...form, contactPageUrl: e.target.value })}
              onBlur={(e) =>
                setForm({
                  ...form,
                  contactPageUrl: e.target.value.trim() ? normalizeSiteUrlInput(e.target.value) : "",
                })
              }
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label-sm">Deal status</span>
            <select
              className="form-input-body"
              value={form.dealStatus}
              onChange={(e) => setForm({ ...form, dealStatus: e.target.value as "DEAL_DONE" | "PENDING" })}
            >
              <option value="DEAL_DONE">Deal done</option>
              <option value="PENDING">Pending</option>
            </select>
          </label>
          <label className="block">
            <span className="form-label-sm">Date</span>
            <input
              type="date"
              className="form-input-body"
              value={form.recordDate}
              onChange={(e) => setForm({ ...form, recordDate: e.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="form-label-sm">Notes</span>
          <textarea
            className="form-input-body min-h-[56px] resize-y"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>

        <div className="mt-5">
          <button
            type="button"
            className="btn-save-primary"
            onClick={() => void save()}
          >
            Save vendor
          </button>
        </div>
      </div>
    </div>
  );
}
