"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch, apiUrl } from "@/lib/api";
import { FormSectionCard } from "@/components/form-section-card";

type OrderDetail = {
  id: string;
  status: string;
  linkType: string;
  seoLinkAttribute: string;
  seoLinkQuantity: number;
  articleWriting: boolean;
  articleWritingFeeUsd?: string | number | null;
  paymentTerms: string;
  deliveryDays: number;
  orderDate: string;
  totalPayment: string | number | { toString(): string };
  paymentMethodNote?: string | null;
  client: { siteUrl: string; email: string };
  vendor: { siteUrl: string };
  currency: { symbol: string; code: string };
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100/80 py-2 last:border-0 dark:border-slate-700/80 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-900 dark:text-slate-100 sm:text-right">{value}</dd>
    </div>
  );
}

function linkTypeLabel(lt: string) {
  if (lt === "GUEST_POST") return "Guest post";
  if (lt === "NICHE_EDIT") return "Niche edit";
  return lt;
}

function attrLabel(a: string) {
  if (a === "NO_FOLLOW") return "No-follow";
  if (a === "SPONSORED") return "Sponsored";
  return "Do-follow";
}

function payTermsLabel(p: string) {
  return p === "ADVANCE" ? "Advance" : "After live link";
}

function pay(v: string | number | { toString(): string }) {
  if (typeof v === "object") return v.toString();
  return String(v);
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const { data: o, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`, token),
    enabled: !!token && !!id,
  });

  async function sendInvoice() {
    await fetch(apiUrl(`/invoices/${id}/send`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    void qc.invalidateQueries({ queryKey: ["order", id] });
    void showAlert("Sent (or check SMTP config)");
  }

  if (isLoading || !o) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
    );
  }

  const tp = pay(o.totalPayment);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Order</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {String(o.orderDate).slice(0, 10)} · {o.currency.code}
          </p>
        </div>
        <Link
          href={`/orders/${id}/edit`}
          className="btn-save-primary-sm inline-flex shrink-0 items-center justify-center gap-2 px-4"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <FormSectionCard title="Client & vendor">
        <dl>
          <Row label="Client site" value={o.client.siteUrl} />
          <Row label="Client email" value={o.client.email} />
          <Row label="Vendor site" value={o.vendor.siteUrl} />
        </dl>
      </FormSectionCard>

      <FormSectionCard title="Placement & link">
        <dl>
          <Row label="Placement type" value={linkTypeLabel(o.linkType)} />
          <Row label="Link type" value={`${o.seoLinkQuantity} × ${attrLabel(o.seoLinkAttribute)}`} />
          <Row label="Article writing" value={o.articleWriting ? "Yes" : "No"} />
          {o.articleWriting ? (
            <Row
              label="Article writing fee (USD)"
              value={o.articleWritingFeeUsd != null ? String(o.articleWritingFeeUsd) : "—"}
            />
          ) : null}
        </dl>
      </FormSectionCard>

      <FormSectionCard title="Payment & delivery">
        <dl>
          <Row label="Status" value={o.status} />
          <Row label="Total" value={`${o.currency.symbol}${tp}`} />
          <Row label="Payment terms" value={payTermsLabel(o.paymentTerms)} />
          <Row label="Payment note" value={o.paymentMethodNote?.trim() || "—"} />
          <Row label="Delivery" value={`${o.deliveryDays} day(s)`} />
        </dl>
      </FormSectionCard>

      <section className="form-section-card">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Invoice</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
            onClick={() => void sendInvoice()}
          >
            Send invoice
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
            onClick={(e) => {
              e.preventDefault();
              void fetch(apiUrl(`/invoices/${id}/pdf`), {
                headers: { Authorization: `Bearer ${token}` },
              }).then(async (r) => {
                const blob = await r.blob();
                const u = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = u;
                a.download = "invoice.pdf";
                a.click();
              });
            }}
          >
            Download PDF
          </button>
        </div>
      </section>
    </div>
  );
}
