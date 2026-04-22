"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarRange,
  CheckCircle2,
  Clock,
  DollarSign,
  Hourglass,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { apiFetch } from "@/lib/api";

type DashboardStats = {
  totalSaleUsd: number;
  last30DaysSaleUsd: number;
  totalProfitUsd: number;
  last30DaysProfitUsd: number;
  totalVendors: number;
  dealDoneVendors: number;
  pendingDeals: number;
  totalClients: number;
  completedOrders: number;
  pendingOrders: number;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-5 mt-12 border-b border-slate-200/80 pb-2 first:mt-0 dark:border-slate-700/80">
      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const { data, isLoading } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: () => apiFetch<DashboardStats>("/stats/dashboard", token),
    enabled: !!token,
  });

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-48 rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h1>

      <SectionTitle title="Revenue & profit" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Sale"
          value={fmtUsd(data.totalSaleUsd)}
          href="/revenue"
          icon={DollarSign}
          accentClassName="group-hover:bg-emerald-50 group-hover:text-emerald-700"
        />
        <StatCard
          label="Last 30 Days Sales"
          value={fmtUsd(data.last30DaysSaleUsd)}
          href="/revenue"
          icon={CalendarRange}
          accentClassName="group-hover:bg-sky-50 group-hover:text-sky-700"
        />
        <StatCard
          label="Total Profit"
          value={fmtUsd(data.totalProfitUsd)}
          href="/revenue"
          icon={TrendingUp}
          accentClassName="group-hover:bg-violet-50 group-hover:text-violet-700"
        />
        <StatCard
          label="Last 30 Days Profit"
          value={fmtUsd(data.last30DaysProfitUsd)}
          href="/revenue"
          icon={Activity}
          accentClassName="group-hover:bg-amber-50 group-hover:text-amber-700"
        />
      </div>

      <SectionTitle title="Vendors" />
      <div className="-mx-1 grid gap-4 px-1 sm:grid-cols-2 xl:grid-cols-3 md:-mx-2 md:px-2">
        <StatCard
          label="Total Vendors"
          value={data.totalVendors}
          href="/vendors"
          icon={Building2}
          compactValue
        />
        <StatCard
          label="Deal Done Vendors"
          value={data.dealDoneVendors}
          href="/vendors/deal-done"
          icon={BadgeCheck}
          accentClassName="group-hover:bg-emerald-50 group-hover:text-emerald-700"
          compactValue
        />
        <StatCard
          label="Pending Deals"
          value={data.pendingDeals}
          href="/vendors/pending"
          icon={Hourglass}
          accentClassName="group-hover:bg-amber-50 group-hover:text-amber-700"
          compactValue
        />
      </div>

      <SectionTitle title="Clients & orders" />
      <div className="-mx-1 grid gap-4 px-1 sm:grid-cols-2 xl:grid-cols-3 md:-mx-2 md:px-2">
        <StatCard
          label="Total Clients"
          value={data.totalClients}
          href="/clients"
          icon={UsersRound}
          compactValue
        />
        <StatCard
          label="Completed Orders"
          value={data.completedOrders}
          href="/orders/completed"
          icon={CheckCircle2}
          accentClassName="group-hover:bg-emerald-50 group-hover:text-emerald-700"
          compactValue
        />
        <StatCard
          label="Pending Orders"
          value={data.pendingOrders}
          href="/orders/pending"
          icon={Clock}
          accentClassName="group-hover:bg-amber-50 group-hover:text-amber-700"
          compactValue
        />
      </div>
    </div>
  );
}
