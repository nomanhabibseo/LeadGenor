"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

export default function ClientViewPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: c, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => apiFetch<Record<string, string>>(`/clients/${id}`, token),
    enabled: !!token && !!id,
  });
  if (isLoading || !c) return <p>Loading…</p>;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{c.companyName}</h1>
        <Link href={`/clients/${id}/edit`} className="btn-save-primary-sm inline-flex items-center justify-center">
          Edit
        </Link>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{c.siteUrl}</p>
    </div>
  );
}
