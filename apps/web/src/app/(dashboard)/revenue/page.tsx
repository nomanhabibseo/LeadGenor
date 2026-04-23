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
    <div className="mx-auto max-w-4xl space-y-8 px-2 pb-16 sm:px-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Revenue (USD)</h1>
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total sales</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">${stats.totalSaleUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total profit</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">${stats.totalProfitUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Last month sales</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">${stats.lastMonthSaleUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">Last month profit</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">${stats.lastMonthProfitUsd.toFixed(2)}</p>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/50">
        <h2 className="text-lg font-medium text-slate-900 dark:text-white">Completed orders (USD)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {orders?.data?.map((row) => (
            <li
              key={row.order.id}
              className="border-b border-slate-100 pb-2 last:border-0 dark:border-slate-700/80 last:pb-0"
            >
              <Link
                href={`/orders/${row.order.id}`}
                className="text-sky-600 transition hover:underline dark:text-sky-400"
              >
                Order {row.order.id.slice(0, 8)}… — sale ${Number(row.saleUsd).toFixed(2)} — profit ${Number(row.profitUsd).toFixed(2)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
