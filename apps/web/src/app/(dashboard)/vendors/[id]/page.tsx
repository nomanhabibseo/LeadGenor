"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

type VendorDetail = {
  id: string;
  companyName: string;
  siteUrl: string;
  traffic: number;
  dr: number;
  mozDa: number;
  authorityScore: number;
  referringDomains: number;
  backlinks: number;
  trustFlow: number;
  seoLinkAttribute: string;
  seoLinkQuantity: number;
  tatUnit: string;
  tatValue: number;
  guestPostCost: string | number;
  nicheEditCost: string | number;
  guestPostPrice: string | number;
  nicheEditPrice: string | number;
  paymentTerms: string;
  contactEmail: string;
  contactPageUrl?: string | null;
  dealStatus: string;
  recordDate?: string | null;
  notes?: string | null;
  currency: { code: string; symbol: string; name: string };
  language: { name: string; code: string };
  niches: { niche: { label: string } }[];
  countries: { country: { name: string; code: string } }[];
  paymentMethods: { paymentMethod: { label: string } }[];
  afterLiveOption?: { label: string } | null;
  _count?: { orders: number };
};

function dec(v: string | number) {
  if (typeof v === "number") return String(v);
  return v;
}

function seoLinkAttrLabel(a: string) {
  if (a === "NO_FOLLOW") return "No-follow";
  if (a === "SPONSORED") return "Sponsored";
  return "Do-follow";
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="form-section-card">
      <h2 className="form-section-card-title">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100/80 py-2 last:border-0 dark:border-slate-700/80 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-900 dark:text-slate-100 sm:text-right">{value}</dd>
    </div>
  );
}

export default function VendorViewPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const token = session?.accessToken;

  const { data: v, isLoading } = useQuery({
    queryKey: ["vendor", id],
    queryFn: () => apiFetch<VendorDetail>(`/vendors/${id}`, token),
    enabled: !!token && !!id,
  });

  if (isLoading || !v) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
    );
  }

  const tatLabel = v.tatUnit === "DAYS" ? `${v.tatValue} day(s)` : `${v.tatValue} hour(s)`;
  const ordersDone = v._count?.orders ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{v.companyName}</h1>
          <a
            href={v.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-sm text-brand-700 hover:underline dark:text-cyan-400/90"
          >
            {v.siteUrl}
          </a>
        </div>
        <Link
          href={`/vendors/${id}/edit`}
          className="btn-save-primary-sm inline-flex shrink-0 items-center justify-center px-4"
        >
          Edit vendor
        </Link>
      </div>

      <DetailCard title="Identity & audience">
        <dl>
          <Row label="Contact email" value={v.contactEmail} />
          <Row label="Contact page" value={v.contactPageUrl || "—"} />
          <Row
            label="Niche"
            value={
              v.niches.length ? (
                <span className="text-left">{v.niches.map((x) => x.niche.label).join(", ")}</span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Country"
            value={
              v.countries.length ? (
                <span className="text-left">{v.countries.map((x) => x.country.name).join(", ")}</span>
              ) : (
                "—"
              )
            }
          />
          <Row label="Language" value={v.language.name} />
          <Row label="Traffic" value={v.traffic.toLocaleString()} />
        </dl>
      </DetailCard>

      <DetailCard title="Authority & links">
        <dl>
          <Row label="DR" value={v.dr} />
          <Row label="Moz DA" value={v.mozDa} />
          <Row label="Authority score" value={v.authorityScore} />
          <Row label="Referring domains" value={v.referringDomains.toLocaleString()} />
          <Row label="Backlinks" value={v.backlinks.toLocaleString()} />
          <Row label="Trust flow" value={v.trustFlow} />
        </dl>
      </DetailCard>

      <DetailCard title="TAT & pricing">
        <dl>
          <Row
            label="Link type"
            value={`${v.seoLinkQuantity} × ${seoLinkAttrLabel(v.seoLinkAttribute)}`}
          />
          <Row label="Turnaround (TAT)" value={tatLabel} />
          <Row label="Currency" value={`${v.currency.code} (${v.currency.symbol}) — ${v.currency.name}`} />
          <Row
            label="Guest post cost (vendor)"
            value={`${v.currency.symbol}${dec(v.guestPostCost)}`}
          />
          <Row
            label="Niche edit cost (vendor)"
            value={`${v.currency.symbol}${dec(v.nicheEditCost)}`}
          />
          <Row
            label="Guest post price (reseller)"
            value={`${v.currency.symbol}${dec(v.guestPostPrice)}`}
          />
          <Row
            label="Niche edit price (reseller)"
            value={`${v.currency.symbol}${dec(v.nicheEditPrice)}`}
          />
        </dl>
      </DetailCard>

      <DetailCard title="Payment & status">
        <dl>
          <Row label="Payment terms" value={v.paymentTerms === "ADVANCE" ? "Advance" : "After live link"} />
          {v.paymentTerms === "AFTER_LIVE_LINK" && (
            <Row label="After live timing" value={v.afterLiveOption?.label ?? "—"} />
          )}
          <Row
            label="Payment methods"
            value={
              v.paymentMethods.length ? v.paymentMethods.map((p) => p.paymentMethod.label).join(", ") : "—"
            }
          />
          <Row label="Deal status" value={v.dealStatus === "DEAL_DONE" ? "Deal done" : "Pending"} />
          <Row
            label="Date"
            value={v.recordDate ? String(v.recordDate).slice(0, 10) : "—"}
          />
          <Row label="Completed orders (guest posts)" value={ordersDone} />
        </dl>
      </DetailCard>

      {v.notes ? (
        <section className="form-section-card">
          <h2 className="form-section-card-title">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{v.notes}</p>
        </section>
      ) : null}
    </div>
  );
}
