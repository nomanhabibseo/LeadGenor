"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, apiUrl } from "@/lib/api";
import { normalizeSiteUrlInput, siteUrlsEqual } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { useReference } from "@/hooks/use-reference";

export function OrderForm({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;
  const { data: ref } = useReference();

  const {
    data: clients,
    isLoading: clientsLoading,
    isError: clientsError,
  } = useQuery({
    queryKey: ["clients", "list", token],
    queryFn: () =>
      apiFetch<{ data: { id: string; siteUrl: string; email: string }[] }>("/clients?page=1&limit=200", token),
    enabled: !!token,
  });

  const {
    data: vendors,
    isLoading: vendorsLoading,
    isError: vendorsError,
  } = useQuery({
    queryKey: ["vendors", "list", token],
    queryFn: () =>
      apiFetch<{ data: { id: string; siteUrl: string }[] }>("/vendors?scope=all&page=1&limit=200", token),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    clientId: "",
    vendorId: "",
    linkType: "GUEST_POST" as "GUEST_POST" | "NICHE_EDIT",
    articleWriting: false,
    articleWritingFeeUsd: 0,
    paymentTerms: "ADVANCE" as "ADVANCE" | "AFTER_LIVE_LINK",
    deliveryDays: 7,
    status: "PENDING" as "COMPLETED" | "PENDING",
    orderDate: new Date().toISOString().slice(0, 10),
  });

  /** paypal | payoneer | payment method id from reference */
  const [paymentChannel, setPaymentChannel] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");

  const [clientSiteInput, setClientSiteInput] = useState("");
  const [vendorSiteInput, setVendorSiteInput] = useState("");

  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resolvedClientId = useMemo(() => {
    const t = clientSiteInput.trim();
    if (!t || !clients?.data?.length) return "";
    const c = clients.data.find((x) => siteUrlsEqual(x.siteUrl, t));
    return c?.id ?? "";
  }, [clientSiteInput, clients]);

  const resolvedVendorId = useMemo(() => {
    const t = vendorSiteInput.trim();
    if (!t || !vendors?.data?.length) return "";
    const v = vendors.data.find((x) => siteUrlsEqual(x.siteUrl, t));
    return v?.id ?? "";
  }, [vendorSiteInput, vendors]);

  const effectiveVendorId = resolvedVendorId || form.vendorId;
  const articleFeeForPreview =
    form.articleWriting && form.articleWritingFeeUsd > 0 ? form.articleWritingFeeUsd : 0;

  const { data: preview } = useQuery({
    queryKey: [
      "order-preview",
      effectiveVendorId,
      form.linkType,
      form.orderDate,
      articleFeeForPreview,
    ],
    queryFn: () => {
      const qs = new URLSearchParams({
        vendorId: effectiveVendorId,
        linkType: form.linkType,
        orderDate: form.orderDate,
      });
      if (articleFeeForPreview > 0) {
        qs.set("articleWritingFeeUsd", String(articleFeeForPreview));
      }
      return apiFetch<{
        resellerPrice: string;
        totalPayment: string;
        currency: { symbol: string };
      }>(`/orders/preview-price?${qs.toString()}`, token);
    },
    enabled: !!token && !!effectiveVendorId,
  });

  useEffect(() => {
    async function load() {
      if (!orderId || !token) return;
      const o = await apiFetch<Record<string, unknown>>(`/orders/${orderId}`, token);
      const note = String(o.paymentMethodNote ?? "");
      const sep = note.indexOf(" — ");
      if (sep > -1) {
        const left = note.slice(0, sep).trim();
        const right = note.slice(sep + 3).trim();
        const lower = left.toLowerCase();
        if (lower === "paypal") setPaymentChannel("paypal");
        else if (lower === "payoneer") setPaymentChannel("payoneer");
        else setPaymentChannel("");
        setPaymentDetails(right);
      } else {
        setPaymentChannel("");
        setPaymentDetails(note);
      }
      setForm({
        clientId: String(o.clientId),
        vendorId: String(o.vendorId),
        linkType: o.linkType as "GUEST_POST" | "NICHE_EDIT",
        articleWriting: Boolean(o.articleWriting),
        articleWritingFeeUsd: Number(o.articleWritingFeeUsd ?? 0),
        paymentTerms: o.paymentTerms as "ADVANCE" | "AFTER_LIVE_LINK",
        deliveryDays: Number(o.deliveryDays),
        status: o.status as "COMPLETED" | "PENDING",
        orderDate: String(o.orderDate).slice(0, 10),
      });
    }
    void load();
  }, [orderId, token]);

  useEffect(() => {
    if (!form.clientId || !clients?.data) return;
    const c = clients.data.find((x) => x.id === form.clientId);
    if (c) setClientSiteInput(c.siteUrl);
  }, [form.clientId, clients]);

  useEffect(() => {
    if (!form.vendorId || !vendors?.data) return;
    const v = vendors.data.find((x) => x.id === form.vendorId);
    if (v) setVendorSiteInput(v.siteUrl);
  }, [form.vendorId, vendors]);

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function buildPaymentNote(): string {
    const label =
      paymentChannel === "paypal"
        ? "PayPal"
        : paymentChannel === "payoneer"
          ? "Payoneer"
          : paymentChannel && ref?.paymentMethods
            ? ref.paymentMethods.find((p) => p.id === paymentChannel)?.label ?? paymentChannel
            : "";
    const detail = paymentDetails.trim();
    if (label && detail) return `${label} — ${detail}`;
    if (label) return label;
    return detail;
  }

  function validateFields(clientId: string, vendorId: string): boolean {
    const e: Record<string, string> = {};
    if (!clientId) e.clientId = "Enter or choose a client site URL that exists in your list.";
    if (!vendorId) e.vendorId = "Enter or choose a vendor site URL that exists in your list.";
    if (form.articleWriting && (!form.articleWritingFeeUsd || form.articleWritingFeeUsd <= 0)) {
      e.articleWritingFeeUsd = "Enter a fee greater than 0.";
    }
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    setSaveError(null);
    if (!token) {
      setSaveError("You are not signed in.");
      return;
    }
    const cid = resolvedClientId || form.clientId;
    const vid = resolvedVendorId || form.vendorId;
    if (!validateFields(cid, vid)) return;
    const path = orderId ? `/orders/${orderId}` : "/orders";
    const method = orderId ? "PUT" : "POST";
    const paymentMethodNote = buildPaymentNote() || undefined;
    const res = await fetch(apiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...form,
        clientId: cid,
        vendorId: vid,
        articleWritingFeeUsd: form.articleWriting ? form.articleWritingFeeUsd : undefined,
        paymentMethodNote,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text || "Save failed";
      try {
        const j = JSON.parse(text) as { message?: unknown };
        if (typeof j.message === "string") msg = j.message;
        else if (Array.isArray(j.message)) msg = JSON.stringify(j.message);
      } catch {
        /* keep msg */
      }
      setSaveError(msg);
      return;
    }
    const body = (await res.json()) as { id: string };
    const id = body.id ?? orderId;
    if (id) router.push(`/orders/${id}`);
    router.refresh();
  }

  if (sessionStatus === "loading") {
    return <p className="text-sm text-slate-600">Checking session…</p>;
  }

  if (sessionStatus === "unauthenticated" || !token) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
        style={{ maxWidth: 480 }}
      >
        <p className="font-medium">Sign in required</p>
        <p className="mt-1 text-amber-900/90">You must be logged in to create or edit orders.</p>
        <Link href="/login" className="mt-3 inline-block font-semibold text-brand-700 underline">
          Go to login
        </Link>
      </div>
    );
  }

  if (clientsLoading || vendorsLoading) {
    return <p className="text-sm text-slate-600">Loading clients and vendors…</p>;
  }

  if (clientsError || vendorsError) {
    return (
      <p className="text-sm text-red-700">
        Could not load clients or vendors. Check that the API is running and you are signed in.
      </p>
    );
  }

  return (
    <div className="w-full max-w-5xl pb-10">
      {!orderId && (
        <div className="mb-6 border-b border-slate-200 pb-4 dark:border-slate-700">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Create New Order
          </h1>
        </div>
      )}

      <div className="space-y-5">
        {saveError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {saveError}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="form-label-sm">Client site URL</span>
            <input
              className={cn("form-input-body", fieldErrors.clientId && "form-input-body-invalid")}
              list="order-client-sites"
              placeholder="https://… or pick from suggestions"
              value={clientSiteInput}
              onChange={(e) => {
                clearFieldError("clientId");
                setClientSiteInput(e.target.value);
                const t = e.target.value.trim();
                if (!t) {
                  setForm((f) => ({ ...f, clientId: "" }));
                  return;
                }
                const c = clients?.data?.find((x) => siteUrlsEqual(x.siteUrl, t));
                if (c) setForm((f) => ({ ...f, clientId: c.id }));
              }}
              onBlur={(e) => {
                const t = normalizeSiteUrlInput(e.target.value);
                if (t !== e.target.value) setClientSiteInput(t);
                const c = clients?.data?.find((x) => siteUrlsEqual(x.siteUrl, t));
                if (c) setForm((f) => ({ ...f, clientId: c.id }));
              }}
            />
            <datalist id="order-client-sites">
              {clients?.data?.map((c) => (
                <option key={c.id} value={c.siteUrl} />
              ))}
            </datalist>
            {fieldErrors.clientId ? <p className="form-field-error">{fieldErrors.clientId}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Type a URL or choose from your saved clients.</p>
          </label>
          <label className="block">
            <span className="form-label-sm">Vendor site URL</span>
            <input
              className={cn("form-input-body", fieldErrors.vendorId && "form-input-body-invalid")}
              list="order-vendor-sites"
              placeholder="https://… or pick from suggestions"
              value={vendorSiteInput}
              onChange={(e) => {
                clearFieldError("vendorId");
                setVendorSiteInput(e.target.value);
                const t = e.target.value.trim();
                if (!t) {
                  setForm((f) => ({ ...f, vendorId: "" }));
                  return;
                }
                const v = vendors?.data?.find((x) => siteUrlsEqual(x.siteUrl, t));
                if (v) setForm((f) => ({ ...f, vendorId: v.id }));
              }}
              onBlur={(e) => {
                const t = normalizeSiteUrlInput(e.target.value);
                if (t !== e.target.value) setVendorSiteInput(t);
                const v = vendors?.data?.find((x) => siteUrlsEqual(x.siteUrl, t));
                if (v) setForm((f) => ({ ...f, vendorId: v.id }));
              }}
            />
            <datalist id="order-vendor-sites">
              {vendors?.data?.map((v) => (
                <option key={v.id} value={v.siteUrl} />
              ))}
            </datalist>
            {fieldErrors.vendorId ? <p className="form-field-error">{fieldErrors.vendorId}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Type a URL or choose from your saved vendors.</p>
          </label>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="block min-w-[160px] max-w-xs flex-1">
            <span className="form-label-sm">Link type</span>
            <select
              className="form-input-body"
              value={form.linkType}
              onChange={(e) => setForm({ ...form, linkType: e.target.value as "GUEST_POST" | "NICHE_EDIT" })}
            >
              <option value="GUEST_POST">Guest post</option>
              <option value="NICHE_EDIT">Niche edit</option>
            </select>
          </label>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                checked={form.articleWriting}
                onChange={(e) => setForm({ ...form, articleWriting: e.target.checked })}
              />
              Article writing
            </label>
            {form.articleWriting ? (
              <label className="block max-w-[200px]">
                <span className="form-label-sm">Article writing fee (USD)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={cn("form-input-body", fieldErrors.articleWritingFeeUsd && "form-input-body-invalid")}
                  value={form.articleWritingFeeUsd || ""}
                  onChange={(e) => {
                    clearFieldError("articleWritingFeeUsd");
                    setForm({ ...form, articleWritingFeeUsd: Number(e.target.value) });
                  }}
                />
                {fieldErrors.articleWritingFeeUsd ? (
                  <p className="form-field-error">{fieldErrors.articleWritingFeeUsd}</p>
                ) : null}
              </label>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/50">
            <span className="form-label-sm">Total payment</span>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {preview
                ? `${preview.currency.symbol}${preview.totalPayment}`
                : effectiveVendorId
                  ? "—"
                  : "Pick a vendor"}
            </p>
          </div>
          <label className="block">
            <span className="form-label-sm">Payment method</span>
            <select
              className="form-input-body"
              value={paymentChannel}
              onChange={(e) => setPaymentChannel(e.target.value)}
            >
              <option value="">Choose…</option>
              <option value="paypal">PayPal</option>
              <option value="payoneer">Payoneer</option>
              {ref?.paymentMethods?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block lg:col-span-1">
            <span className="form-label-sm">Account / card / bank ID</span>
            <input
              className="form-input-body"
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder="ID, card number, or note"
            />
          </label>
          <label className="block">
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
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="form-label-sm">Delivery (days)</span>
            <select
              className="form-input-body"
              value={form.deliveryDays}
              onChange={(e) => setForm({ ...form, deliveryDays: Number(e.target.value) })}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="form-label-sm">Order status</span>
            <select
              className="form-input-body"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as "COMPLETED" | "PENDING" })}
            >
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <label className="block">
            <span className="form-label-sm">Date</span>
            <input
              type="date"
              className="form-input-body"
              value={form.orderDate}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-2">
          <button type="button" className="btn-save-primary" onClick={() => void save()}>
            Save order
          </button>
        </div>
      </div>
    </div>
  );
}
