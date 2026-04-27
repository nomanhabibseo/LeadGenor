export type TimeRangeKey = "h24" | "d7" | "d30" | "m6" | "y1" | "life";

export const TIME_RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: "h24", label: "24 hours" },
  { key: "d7", label: "7 days" },
  { key: "d30", label: "30 days" },
  { key: "m6", label: "6 months" },
  { key: "y1", label: "Last year" },
  { key: "life", label: "Lifetime" },
];

export function defaultRanges(): Record<
  "leads" | "delivery" | "response" | "revenue" | "profit",
  TimeRangeKey
> {
  return {
    leads: "d30",
    delivery: "d30",
    response: "d30",
    revenue: "d30",
    profit: "d30",
  };
}

export function buildInsightsPath(ranges: {
  leads: TimeRangeKey;
  delivery: TimeRangeKey;
  response: TimeRangeKey;
  revenue: TimeRangeKey;
  profit: TimeRangeKey;
}) {
  const p = new URLSearchParams();
  p.set("leads", ranges.leads);
  p.set("delivery", ranges.delivery);
  p.set("response", ranges.response);
  p.set("revenue", ranges.revenue);
  p.set("profit", ranges.profit);
  return `/stats/dashboard/insights?${p.toString()}`;
}

export type SeriesPoint = { t: string; v: number };

export type DashboardInsights = {
  snapshot: {
    runningCampaigns: number;
    completedCampaigns: number;
    scheduledCampaigns: number;
    totalVendors: number;
    dealDoneVendors: number;
    pendingDeals: number;
    totalClients: number;
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
  };
  leads: {
    range: string;
    from: string;
    to: string;
    total: number;
    series: SeriesPoint[];
  };
  delivery: {
    range: string;
    from: string;
    to: string;
    pct: number;
    series: SeriesPoint[];
  };
  response: {
    range: string;
    from: string;
    to: string;
    pct: number;
    series: SeriesPoint[];
  };
  revenue: {
    range: string;
    from: string;
    to: string;
    usd: number;
    series: SeriesPoint[];
  };
  profit: {
    range: string;
    from: string;
    to: string;
    usd: number;
    marginPct: number;
    series: SeriesPoint[];
  };
};
