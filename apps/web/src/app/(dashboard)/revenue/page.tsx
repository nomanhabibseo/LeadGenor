"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MiniChart } from "@/components/dashboard/chart-svg";
import {
  TIME_RANGE_OPTIONS,
  buildInsightsPath,
  defaultRanges,
  type DashboardInsights,
  type TimeRangeKey,
} from "@/lib/dashboard-insights";
import { ChevronDown, DollarSign } from "lucide-react";
import { useMemo, useState } from "react";

export default function RevenuePage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [rangeRevenue, setRangeRevenue] = useState<TimeRangeKey>(() => defaultRanges().revenue);
  const [rangeProfit, setRangeProfit] = useState<TimeRangeKey>(() => defaultRanges().profit);

  const last7From = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const insightsRanges = useMemo(() => {
    const base = defaultRanges();
    return {
      leads: base.leads,
      delivery: base.delivery,
      response: base.response,
      revenue: rangeRevenue,
      profit: rangeProfit,
    };
  }, [rangeProfit, rangeRevenue]);

  const { data: insights } = useQuery({
    queryKey: ["stats", "dashboard", "insights", insightsRanges],
    queryFn: () => apiFetch<DashboardInsights>(buildInsightsPath(insightsRanges), token),
    enabled: !!token,
  });

  const { data: latestOrders } = useQuery({
    queryKey: ["revenue", "latest-orders", last7From],
    queryFn: () =>
      apiFetch<{
        data: {
          id: string;
          orderDate: string;
          status: string;
          linkType: string;
          totalPayment: string | { toString(): string };
          client: { siteUrl: string };
          vendor: { siteUrl: string };
          currency: { code: string; symbol: string };
        }[];
        total: number;
      }>(
        `/orders?scope=completed&page=1&limit=10&dateFrom=${encodeURIComponent(last7From)}`,
        token,
      ),
    enabled: !!token,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-2 pb-16 sm:px-4">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Revenue (USD)</h1>
      {insights ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            className={cn(
              "flex min-h-[260px] flex-col rounded-2xl border-2 border-emerald-200/50 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-md ring-1 ring-black/5 dark:border-emerald-900/45 dark:from-emerald-950/40 dark:to-slate-900 dark:ring-white/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/50 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800/45">
                  <DollarSign className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revenue</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Total revenue</p>
                </div>
              </div>
              <div className="relative inline-flex min-w-[7.5rem] shrink-0 items-center">
                <select
                  className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-1.5 pl-3 pr-8 text-left text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-violet-200/80 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:shadow-none dark:hover:border-slate-500 dark:focus:ring-violet-600/30"
                  value={rangeRevenue}
                  onChange={(e) => setRangeRevenue(e.target.value as TimeRangeKey)}
                  aria-label="Revenue time range"
                >
                  {TIME_RANGE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              ${insights.revenue.usd.toFixed(2)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Total sales (USD) in this period</p>
            <div className="mt-2 min-h-0 flex-1">
              <MiniChart points={insights.revenue.series} color="#10b981" variant="line" showGrid />
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-[260px] flex-col rounded-2xl border-2 border-teal-200/50 bg-gradient-to-b from-teal-50/80 to-white p-4 shadow-md ring-1 ring-black/5 dark:border-teal-900/45 dark:from-teal-950/40 dark:to-slate-900 dark:ring-white/5",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/80 text-teal-700 ring-1 ring-teal-200/50 dark:bg-teal-950/45 dark:text-teal-200 dark:ring-teal-800/45">
                  <span className="text-sm font-bold leading-none">$</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profit</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">After vendor costs (completed orders)</p>
                </div>
              </div>
              <div className="relative inline-flex min-w-[7.5rem] shrink-0 items-center">
                <select
                  className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-1.5 pl-3 pr-8 text-left text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-violet-200/80 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:shadow-none dark:hover:border-slate-500 dark:focus:ring-violet-600/30"
                  value={rangeProfit}
                  onChange={(e) => setRangeProfit(e.target.value as TimeRangeKey)}
                  aria-label="Profit time range"
                >
                  {TIME_RANGE_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
              ${insights.profit.usd.toFixed(2)}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Net profit in this period</p>
            <div className="mt-2 min-h-0 flex-1">
              <MiniChart points={insights.profit.series} color="#14b8a6" variant="line" showGrid />
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Latest orders</h2>
          <Link
            href="/orders/completed"
            className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
          >
            Show complete list
          </Link>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Last 7 days · Completed orders</p>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Link type</th>
                <th className="py-2 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {(latestOrders?.data ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-200/80 text-slate-800 dark:border-slate-800 dark:text-slate-200"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.orderDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">{r.client?.siteUrl ?? "—"}</td>
                  <td className="py-2 pr-3">{r.vendor?.siteUrl ?? "—"}</td>
                  <td className="py-2 pr-3">{r.linkType ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.currency?.symbol ?? "$"}
                    {Number(r.totalPayment ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {!latestOrders?.data?.length ? (
                <tr>
                  <td className="py-3 text-sm text-slate-500 dark:text-slate-400" colSpan={5}>
                    No completed orders in the last 7 days.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
