"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  BarChart2,
  CheckCircle2,
  Clock,
  ChevronDown,
  Mail,
  Package,
  Play,
  Send,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DonutChart, MiniChart } from "@/components/dashboard/chart-svg";
import { apiFetch } from "@/lib/api";
import {
  type TimeRangeKey,
  defaultRanges,
  TIME_RANGE_OPTIONS,
} from "@/lib/dashboard-insights";
import { cn } from "@/lib/utils";

type Snapshot = {
  runningCampaigns: number;
  completedCampaigns: number;
  scheduledCampaigns: number;
  totalVendors: number;
  dealDoneVendors: number;
  pendingDeals: number;
  vendorsLast30: number;
  totalClients: number;
  clientsLast30: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  ordersLast30: number;
};

type MetricPoint = { t: string; v: number };
type LeadsMetric = { total: number; series: MetricPoint[] };
type PctMetric = { pct: number; series: MetricPoint[] };
type UsdMetric = { usd: number; series: MetricPoint[] };
type ProfitMetric = { usd: number; marginPct: number; series: MetricPoint[] };

type HighlightMode = "orders" | "clients" | "vendors";

type HighlightOrders = {
  kind: "orders";
  rows: {
    id: string;
    orderDate: string;
    status: string;
    linkType: string;
    totalPayment: string | number;
    currency?: { code: string; symbol: string } | null;
    client?: { siteUrl: string } | null;
    vendor?: { siteUrl: string } | null;
  }[];
};

type HighlightClients = {
  kind: "clients";
  rows: {
    id: string;
    siteUrl: string;
    traffic: number;
    dr: number;
    countries?: { country: { code: string; name: string } }[];
  }[];
};

type HighlightVendors = {
  kind: "vendors";
  rows: { vendorId: string; siteUrl: string; completedOrders: number }[];
};

type HighlightResponse = HighlightOrders | HighlightClients | HighlightVendors | { kind: string; rows: unknown[] };

const DASH_QUERY_STALE_MS = 60_000;

const EMPTY_SNAPSHOT: Snapshot = {
  runningCampaigns: 0,
  completedCampaigns: 0,
  scheduledCampaigns: 0,
  totalVendors: 0,
  dealDoneVendors: 0,
  pendingDeals: 0,
  vendorsLast30: 0,
  totalClients: 0,
  clientsLast30: 0,
  totalOrders: 0,
  completedOrders: 0,
  pendingOrders: 0,
  ordersLast30: 0,
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtPct(n: number) {
  return `${n < 10 ? n.toFixed(1) : Math.round(n)}%`;
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function firstName(s: string | null | undefined) {
  if (!s?.trim()) return "";
  return s.trim().split(/\s+/)[0] ?? "";
}

function TimeRangeSelect({
  value,
  onChange,
  className,
}: {
  value: TimeRangeKey;
  onChange: (k: TimeRangeKey) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex min-w-[7.5rem] shrink-0 items-center",
        className,
      )}
    >
      <select
        className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200/90 bg-white py-1.5 pl-3 pr-8 text-left text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-violet-200/80 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:shadow-none dark:hover:border-slate-500 dark:focus:ring-violet-600/30"
        value={value}
        onChange={(e) => onChange(e.target.value as TimeRangeKey)}
        aria-label="Time range"
      >
        {TIME_RANGE_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
    </div>
  );
}

function SmallStat({
  title,
  value,
  children,
  iconBg,
  iconColor,
  hint,
}: {
  title: string;
  value: string | number;
  children: React.ReactNode;
  iconBg: string;
  iconColor: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-400/45 bg-white p-4 shadow-sm dark:border-blue-500/35 dark:bg-slate-900/95">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 sm:text-3xl">
        {typeof value === "number" ? fmtInt(value) : value}
      </p>
      {hint ? <div className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">{hint}</div> : null}
      <div
        className={cn(
          "absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full",
          iconBg,
        )}
      >
        <span className={iconColor}>{children}</span>
      </div>
    </div>
  );
}

function BigMetric({
  title,
  subtitle,
  value,
  valueLabel,
  series,
  range,
  onRangeChange,
  color,
  lineWidth = 1.25,
  chartVariant,
  icon,
  iconBoxClass,
}: {
  title: string;
  subtitle: string;
  value: string;
  valueLabel: string;
  series: { t: string; v: number }[];
  range: TimeRangeKey;
  onRangeChange: (k: TimeRangeKey) => void;
  color: string;
  lineWidth?: number;
  chartVariant: "line" | "bar";
  icon: React.ReactNode;
  iconBoxClass: string;
}) {
  return (
    <div className="flex h-full min-h-[260px] flex-col rounded-2xl border border-blue-400/45 bg-white p-4 shadow-sm dark:border-blue-500/35 dark:bg-slate-900/95 sm:min-h-[280px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              iconBoxClass,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>
        <TimeRangeSelect value={range} onChange={onRangeChange} />
      </div>
      <div className="mt-3 min-h-0 flex-1">
        <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
          {value}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{valueLabel}</p>
        <div className="mt-1 min-h-0 sm:mt-2">
          {chartVariant === "bar" ? (
            <MiniChart
              points={series}
              color={color}
              variant="bar"
              showGrid
            />
          ) : (
            <MiniChart
              points={series}
              color={color}
              variant="line"
              fillGradient
              lineWidth={lineWidth}
              showGrid
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;
  const displayName = firstName(session?.user?.name ?? undefined);
  const [ranges, setRanges] = useState(defaultRanges);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("orders");

  useEffect(() => {
    try {
      const key = "lg_dashboard_highlight_mode_v1";
      const prev = Number(localStorage.getItem(key) ?? "0");
      const next = Number.isFinite(prev) ? (prev + 1) % 3 : 0;
      localStorage.setItem(key, String(next));
      setHighlightMode(next === 0 ? "orders" : next === 1 ? "clients" : "vendors");
    } catch {
      setHighlightMode("orders");
    }
  }, []);

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    isError: snapshotError,
    error: snapshotFetchError,
    isFetching: snapshotFetching,
    failureCount: snapshotFailureCount,
  } = useQuery({
    queryKey: ["stats", "dashboard/snapshot", token],
    queryFn: () => apiFetch<Snapshot>("/stats/dashboard/snapshot", token),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });

  const leadsQ = useQuery({
    queryKey: ["stats", "dashboard/metric", "leads", ranges.leads, token],
    queryFn: () =>
      apiFetch<LeadsMetric>(`/stats/dashboard/metric?k=leads&range=${encodeURIComponent(ranges.leads)}`, token),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });
  const deliveryQ = useQuery({
    queryKey: ["stats", "dashboard/metric", "delivery", ranges.delivery, token],
    queryFn: () =>
      apiFetch<PctMetric>(
        `/stats/dashboard/metric?k=delivery&range=${encodeURIComponent(ranges.delivery)}`,
        token,
      ),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });
  const responseQ = useQuery({
    queryKey: ["stats", "dashboard/metric", "response", ranges.response, token],
    queryFn: () =>
      apiFetch<PctMetric>(`/stats/dashboard/metric?k=response&range=${encodeURIComponent(ranges.response)}`, token),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });
  const revenueQ = useQuery({
    queryKey: ["stats", "dashboard/metric", "revenue", ranges.revenue, token],
    queryFn: () =>
      apiFetch<UsdMetric>(`/stats/dashboard/metric?k=revenue&range=${encodeURIComponent(ranges.revenue)}`, token),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });
  const profitQ = useQuery({
    queryKey: ["stats", "dashboard/metric", "profit", ranges.profit, token],
    queryFn: () =>
      apiFetch<ProfitMetric>(`/stats/dashboard/metric?k=profit&range=${encodeURIComponent(ranges.profit)}`, token),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });

  const highlightQ = useQuery({
    queryKey: ["stats", "dashboard/highlight", highlightMode, token],
    queryFn: () =>
      apiFetch<HighlightResponse>(
        `/stats/dashboard/highlight?kind=${encodeURIComponent(highlightMode)}`,
        token,
      ),
    enabled: sessionStatus === "authenticated" && !!token,
    staleTime: DASH_QUERY_STALE_MS,
  });

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && !token)) {
    return (
      <div className="space-y-6">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80"
            />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80"
            />
          ))}
        </div>
      </div>
    );
  }

  if (snapshotError && !snapshot) {
    return (
      <div className="max-w-lg space-y-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-sm shadow-sm dark:border-red-900/55 dark:bg-red-950/40">
        <p className="font-semibold text-red-800 dark:text-red-100">Dashboard data could not be loaded.</p>
        <p className="whitespace-pre-wrap text-red-700/95 dark:text-red-200/90">
          {snapshotFetchError instanceof Error ? snapshotFetchError.message : String(snapshotFetchError ?? "Unknown error")}
        </p>
        <button
          type="button"
          disabled={snapshotFetching}
          className="rounded-xl bg-red-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-red-800 disabled:opacity-55 dark:bg-red-800 dark:hover:bg-red-700"
          onClick={() =>
            void qc.invalidateQueries({
              predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "stats",
            })
          }
        >
          {snapshotFetching ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  const snapPending = snapshotLoading && !snapshot;
  const s = snapshot ?? EMPTY_SNAPSHOT;
  const data = {
    leads: leadsQ.data as LeadsMetric | undefined,
    delivery: deliveryQ.data as PctMetric | undefined,
    response: responseQ.data as PctMetric | undefined,
    revenue: revenueQ.data as UsdMetric | undefined,
    profit: profitQ.data as ProfitMetric | undefined,
  };

  const highlightTitle =
    highlightMode === "orders"
      ? "Your latest orders"
      : highlightMode === "clients"
        ? "Your latest clients"
        : "Your top vendors";

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 sm:text-base">
            Welcome back,{" "}
            <span className="font-semibold text-violet-600 dark:text-violet-400">
              {displayName || "there"}
            </span>
            ! Here’s what’s happening with your business.
          </p>
          {snapPending && snapshotFailureCount > 0 ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">
              Connecting to API (attempt {snapshotFailureCount + 1})… If this persists, ensure the API is running.
            </p>
          ) : null}
        </div>
      </div>

      <h2 className="mb-2 mt-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Campaigns
      </h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SmallStat
          title="Running campaigns"
          value={snapPending ? "—" : s.runningCampaigns}
          iconBg="bg-emerald-200/80 dark:bg-emerald-900/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        >
          <Play className="h-5 w-5 fill-emerald-600 dark:fill-emerald-400" />
        </SmallStat>
        <SmallStat
          title="Completed campaigns"
          value={snapPending ? "—" : s.completedCampaigns}
          iconBg="bg-sky-200/80 dark:bg-sky-900/50"
          iconColor="text-sky-600 dark:text-sky-400"
        >
          <CheckCircle2 className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Scheduled campaigns"
          value={snapPending ? "—" : s.scheduledCampaigns}
          iconBg="bg-amber-200/80 dark:bg-amber-900/50"
          iconColor="text-amber-600 dark:text-amber-400"
        >
          <Clock className="h-5 w-5" />
        </SmallStat>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Outreach Performance
      </h2>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BigMetric
          title="Leads (outreaches)"
          subtitle="Total leads"
          value={fmtInt(data.leads?.total ?? 0)}
          valueLabel="Emails sent in this period"
          series={data.leads?.series ?? []}
          range={ranges.leads}
          onRangeChange={(k) => setRanges((r) => ({ ...r, leads: k }))}
          color="#7c3aed"
          chartVariant="bar"
          icon={<Send className="h-[18px] w-[18px] text-violet-600 dark:text-violet-300" />}
          iconBoxClass="bg-violet-100/90 text-violet-700 ring-1 ring-violet-200/50 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800/50"
        />
        <BigMetric
          title="Delivery ratio"
          subtitle="Successful deliveries"
          value={fmtPct(data.delivery?.pct ?? 0)}
          valueLabel="Successful sends in this range"
          series={data.delivery?.series ?? []}
          range={ranges.delivery}
          onRangeChange={(k) => setRanges((r) => ({ ...r, delivery: k }))}
          color="#3b82f6"
          lineWidth={1.1}
          chartVariant="line"
          icon={<Mail className="h-[18px] w-[18px] text-sky-600 dark:text-sky-300" />}
          iconBoxClass="bg-sky-100/80 text-sky-700 ring-1 ring-sky-200/40 dark:bg-sky-950/45 dark:text-sky-200 dark:ring-sky-800/45"
        />
        <BigMetric
          title="Response rate"
          subtitle="Response rate"
          value={fmtPct(data.response?.pct ?? 0)}
          valueLabel="Replies per sends in this range"
          series={data.response?.series ?? []}
          range={ranges.response}
          onRangeChange={(k) => setRanges((r) => ({ ...r, response: k }))}
          color="#d946ef"
          lineWidth={1.1}
          chartVariant="line"
          icon={
            <BarChart2 className="h-[18px] w-[18px] text-fuchsia-600 dark:text-fuchsia-300" />
          }
          iconBoxClass="bg-fuchsia-100/80 text-fuchsia-700 ring-1 ring-fuchsia-200/40 dark:bg-fuchsia-950/45 dark:text-fuchsia-200 dark:ring-fuchsia-800/40"
        />
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Revinue & Profit
      </h2>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BigMetric
          title="Revenue"
          subtitle="Total revenue"
          value={fmtUsd(data.revenue?.usd ?? 0)}
          valueLabel="Total sales (USD) in this period"
          series={data.revenue?.series ?? []}
          range={ranges.revenue}
          onRangeChange={(k) => setRanges((r) => ({ ...r, revenue: k }))}
          color="#22c55e"
          lineWidth={1.1}
          chartVariant="line"
          icon={<Package className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-300" />}
          iconBoxClass="bg-emerald-100/80 text-emerald-700 ring-1 ring-emerald-200/50 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800/45"
        />
        <div className="flex min-h-[260px] flex-col rounded-2xl border border-blue-400/45 bg-white p-4 shadow-sm dark:border-blue-500/35 dark:bg-slate-900/95 sm:min-h-[280px]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100/90 text-teal-700 ring-1 ring-teal-200/50 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/50">
                <span className="text-sm font-bold leading-none">$</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Profit</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  After vendor costs (completed orders)
                </p>
              </div>
            </div>
            <TimeRangeSelect
              value={ranges.profit}
              onChange={(k) => setRanges((r) => ({ ...r, profit: k }))}
            />
          </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100 sm:text-4xl">
                {fmtUsd(data.profit?.usd ?? 0)}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Net profit in this period</p>
              <div className="mt-1 sm:mt-2">
                <MiniChart
                  points={data.profit?.series ?? []}
                  color="#0d9488"
                  variant="line"
                  fillGradient
                  lineWidth={1.1}
                  showGrid
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center justify-center self-center sm:self-stretch sm:pt-1">
              <DonutChart pct={data.profit?.marginPct ?? 0} color="#14b8a6" className="mx-auto" />
              <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Profit margin
              </p>
              <p className="text-sm font-bold tabular-nums text-teal-800 dark:text-teal-300">
                {fmtPct(data.profit?.marginPct ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Vendor Sites in your Databank
      </h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SmallStat
          title="Total vendors"
          value={snapPending ? "—" : s.totalVendors}
          hint={
            snapPending ? undefined : s.vendorsLast30 > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                +{fmtInt(s.vendorsLast30)} from last 30 days
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-500">+0 from last 30 days</span>
            )
          }
          iconBg="bg-violet-200/80 dark:bg-violet-900/50"
          iconColor="text-violet-600 dark:text-violet-400"
        >
          <UserRound className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Deal done vendors"
          value={snapPending ? "—" : s.dealDoneVendors}
          iconBg="bg-emerald-200/80 dark:bg-emerald-900/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Pending deals"
          value={snapPending ? "—" : s.pendingDeals}
          iconBg="bg-amber-200/80 dark:bg-amber-900/50"
          iconColor="text-amber-600 dark:text-amber-400"
        >
          <Clock className="h-5 w-5" />
        </SmallStat>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Clients & Orders
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SmallStat
          title="Total clients"
          value={snapPending ? "—" : s.totalClients}
          hint={
            snapPending ? undefined : s.clientsLast30 > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                +{fmtInt(s.clientsLast30)} from last 30 days
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-500">+0 from last 30 days</span>
            )
          }
          iconBg="bg-violet-200/80 dark:bg-violet-900/50"
          iconColor="text-violet-600 dark:text-violet-400"
        >
          <UserRound className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Total orders"
          value={snapPending ? "—" : s.totalOrders}
          hint={
            snapPending ? undefined : s.ordersLast30 > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-300">
                +{fmtInt(s.ordersLast30)} from last 30 days
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-500">+0 from last 30 days</span>
            )
          }
          iconBg="bg-sky-200/80 dark:bg-sky-900/50"
          iconColor="text-sky-600 dark:text-sky-400"
        >
          <ShoppingCart className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Completed orders"
          value={snapPending ? "—" : s.completedOrders}
          iconBg="bg-emerald-200/80 dark:bg-emerald-900/50"
          iconColor="text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-5 w-5" />
        </SmallStat>
        <SmallStat
          title="Pending orders"
          value={snapPending ? "—" : s.pendingOrders}
          iconBg="bg-amber-200/80 dark:bg-amber-900/50"
          iconColor="text-amber-600 dark:text-amber-400"
        >
          <Clock className="h-5 w-5" />
        </SmallStat>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{highlightTitle}</h2>
          {highlightMode === "orders" ? (
            <Link href="/orders/completed" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">
              Show complete list
            </Link>
          ) : highlightMode === "clients" ? (
            <Link href="/clients" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">
              Show complete list
            </Link>
          ) : (
            <Link href="/vendors" className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300">
              Show complete list
            </Link>
          )}
        </div>
        <div className="mb-3 h-px w-full bg-slate-200/80 dark:bg-slate-800" aria-hidden />

        {highlightQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : highlightMode === "orders" ? (
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
                {(highlightQ.data?.rows ?? []).map((r: unknown) => {
                  const row = r as {
                    id: string;
                    orderDate: string;
                    linkType: string;
                    totalPayment: string | number;
                    currency?: { symbol?: string | null } | null;
                    client?: { siteUrl?: string | null } | null;
                    vendor?: { siteUrl?: string | null } | null;
                  };
                  return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-200/80 text-slate-800 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(row.orderDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">{row.client?.siteUrl ?? "—"}</td>
                    <td className="py-2 pr-3">{row.vendor?.siteUrl ?? "—"}</td>
                    <td className="py-2 pr-3">{row.linkType ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.currency?.symbol ?? "$"}
                      {Number(row.totalPayment ?? 0).toFixed(2)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : highlightMode === "clients" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Site</th>
                  <th className="py-2 pr-3">Traffic</th>
                  <th className="py-2 pr-3">DR</th>
                  <th className="py-2 pr-3">Country</th>
                </tr>
              </thead>
              <tbody>
                {(highlightQ.data?.rows ?? []).map((r: unknown) => {
                  const row = r as {
                    id: string;
                    siteUrl: string;
                    traffic?: number | null;
                    dr?: number | null;
                    countries?: { country?: { code?: string | null } | null }[] | null;
                  };
                  return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-200/80 text-slate-800 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="py-2 pr-3">{row.siteUrl ?? "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{Number(row.traffic ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-3 tabular-nums">{Number(row.dr ?? 0).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {(row.countries?.[0]?.country?.code ?? "").toString() || "—"}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Vendor site</th>
                  <th className="py-2 pr-3">Completed orders</th>
                </tr>
              </thead>
              <tbody>
                {(highlightQ.data?.rows ?? []).map((r: unknown, idx: number) => {
                  const row = r as {
                    vendorId?: string | null;
                    siteUrl?: string | null;
                    completedOrders?: number | null;
                  };
                  return (
                  <tr
                    key={`${row.vendorId ?? "v"}-${idx}`}
                    className="border-b border-slate-200/80 text-slate-800 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="py-2 pr-3">{row.siteUrl || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{Number(row.completedOrders ?? 0).toLocaleString()}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
