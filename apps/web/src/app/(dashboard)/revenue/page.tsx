"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

export default function RevenuePage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: stats } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: () =>
      apiFetch<{
        totalSaleUsd: number;
        totalProfitUsd: number;
        lastMonthSaleUsd: number;
        lastMonthProfitUsd: number;
      }>("/stats/dashboard", token),
    enabled: !!token,
  });

  const { data: orders } = useQuery({
    queryKey: ["revenue", "orders"],
    queryFn: () =>
      apiFetch<{
        data: { order: { id: string }; saleUsd: string; profitUsd: string }[];
      }>("/revenue/orders?scope=total&page=1&limit=50", token),
    enabled: !!token,
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Revenue (USD)</h1>
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Total sales</p>
            <p className="text-xl font-semibold">${stats.totalSaleUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Total profit</p>
            <p className="text-xl font-semibold">${stats.totalProfitUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Last month sales</p>
            <p className="text-xl font-semibold">${stats.lastMonthSaleUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-slate-500">Last month profit</p>
            <p className="text-xl font-semibold">${stats.lastMonthProfitUsd.toFixed(2)}</p>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-medium">Completed orders (USD)</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {orders?.data?.map((row) => (
            <li key={row.order.id}>
              <Link href={`/orders/${row.order.id}`} className="text-sky-600 hover:underline">
                Order {row.order.id.slice(0, 8)}… — sale ${Number(row.saleUsd).toFixed(2)} — profit $
                {Number(row.profitUsd).toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
