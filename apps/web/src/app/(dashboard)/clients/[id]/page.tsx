"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { FormSectionCard } from "@/components/form-section-card";

type ClientDetail = {
  id: string;
  companyName: string;
  clientName: string;
  siteUrl: string;
  email: string;
  whatsapp?: string | null;
  traffic: number;
  dr: number;
  mozDa: number;
  authorityScore: number;
  referringDomains: number;
  backlinks: number;
  language: { name: string };
  niches: { niche: { label: string } }[];
  countries: { country: { name: string; code: string } }[];
  _count?: { orders: number };
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100/80 py-2 last:border-0 dark:border-slate-700/80 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-900 dark:text-slate-100 sm:text-right">{value}</dd>
    </div>
  );
}

export default function ClientViewPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: c, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => apiFetch<ClientDetail>(`/clients/${id}`, token),
    enabled: !!token && !!id,
  });

  if (isLoading || !c) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="h-64 rounded-xl bg-slate-200" />
      </div>
    );
  }

  const ordersDone = c._count?.orders ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{c.companyName}</h1>
          <a
            href={c.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block text-sm text-brand-700 hover:underline dark:text-cyan-400/90"
          >
            {c.siteUrl}
          </a>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Client name: {c.clientName}</p>
        </div>
        <Link
          href={`/clients/${id}/edit`}
          className="btn-save-primary-sm inline-flex shrink-0 items-center justify-center gap-2 px-4"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <FormSectionCard title="Identity & audience">
        <dl>
          <Row label="Email" value={c.email} />
          <Row label="WhatsApp" value={c.whatsapp?.trim() || "—"} />
          <Row
            label="Niche"
            value={
              c.niches.length ? (
                <span className="text-left">{c.niches.map((x) => x.niche.label).join(", ")}</span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Country"
            value={
              c.countries.length ? (
                <span className="text-left">{c.countries.map((x) => x.country.name).join(", ")}</span>
              ) : (
                "—"
              )
            }
          />
          <Row label="Language" value={c.language.name} />
          <Row label="Traffic / mo" value={c.traffic.toLocaleString()} />
        </dl>
      </FormSectionCard>

      <FormSectionCard title="SEO metrics">
        <dl>
          <Row label="DR" value={c.dr} />
          <Row label="Moz DA" value={c.mozDa} />
          <Row label="Authority score" value={c.authorityScore} />
          <Row label="Referring domains" value={c.referringDomains.toLocaleString()} />
          <Row label="Backlinks" value={c.backlinks.toLocaleString()} />
        </dl>
      </FormSectionCard>

      <FormSectionCard title="Orders">
        <dl>
          <Row label="Completed orders (guest posts)" value={ordersDone} />
        </dl>
      </FormSectionCard>
    </div>
  );
}
