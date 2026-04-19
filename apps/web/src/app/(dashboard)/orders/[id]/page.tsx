"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch, apiUrl } from "@/lib/api";

export default function OrderDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<Record<string, unknown>>(`/orders/${id}`, token),
    enabled: !!token && !!id,
  });

  async function sendInvoice() {
    await fetch(apiUrl(`/invoices/${id}/send`), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    void qc.invalidateQueries({ queryKey: ["order", id] });
    alert("Sent (or check SMTP config)");
  }

  if (isLoading || !o) return <p>Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h1 className="text-2xl font-semibold">Order</h1>
        <Link href={`/orders/${id}/edit`} className="text-sky-600">
          Edit
        </Link>
      </div>
      <p className="text-sm text-slate-600">Status: {String(o.status)}</p>
      <div className="flex gap-2">
        <button type="button" className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white" onClick={() => void sendInvoice()}>
          Send invoice
        </button>
        <a
          href={apiUrl(`/invoices/${id}/pdf`)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
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
        </a>
      </div>
    </div>
  );
}
