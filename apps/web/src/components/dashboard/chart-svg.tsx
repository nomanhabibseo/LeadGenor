"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/dashboard-insights";

type Props = {
  points: SeriesPoint[];
  className?: string;
  color: string;
  fillGradient?: boolean;
  variant: "line" | "bar";
  /** Line width for line charts (revenue, profit, etc.) */
  lineWidth?: number;
  showGrid?: boolean;
};

function scale(points: SeriesPoint[], w: number, h: number, pad: number) {
  if (points.length === 0) return { d: "", line: "" };
  const vs = points.map((p) => p.v);
  const minV = Math.min(0, ...vs);
  const maxV = Math.max(0.0001, ...vs);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  if (points.length === 1) {
    const y = h - pad - ((points[0]!.v - minV) / (maxV - minV)) * innerH;
    return {
      d: `M ${pad} ${y} L ${w - pad} ${y} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`,
      line: `M ${pad} ${y} L ${w - pad} ${y}`,
    };
  }
  const step = innerW / (points.length - 1);
  const linePts = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - ((p.v - minV) / (maxV - minV)) * innerH;
    return [x, y] as const;
  });
  const line = linePts.map((pt, i) => (i === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`)).join(" ");
  const d = [
    `M ${linePts[0]![0]} ${h - pad}`,
    ...linePts.map((pt) => `L ${pt[0]} ${pt[1]}`),
    `L ${linePts[linePts.length - 1]![0]} ${h - pad}`,
    "Z",
  ].join(" ");
  return { d, line };
}

function GridLines({ w, h, pad, rows }: { w: number; h: number; pad: number; rows: number }) {
  const innerH = h - pad * 2;
  const top = pad;
  const bottom = h - pad;
  const step = innerH / (rows - 1);
  return (
    <g className="text-slate-200/90 dark:text-slate-600/40" pointerEvents="none">
      {Array.from({ length: rows }, (_, i) => {
        const y = top + i * step;
        return (
          <line
            key={i}
            x1={pad}
            x2={w - pad}
            y1={y}
            y2={y}
            stroke="currentColor"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {/* soft vertical column guides */}
      <line x1={pad} x2={pad} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1" />
      <line
        x1={w - pad}
        x2={w - pad}
        y1={top}
        y2={bottom}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
    </g>
  );
}

export function MiniChart({
  points,
  className,
  color,
  fillGradient,
  variant,
  lineWidth = 1.35,
  showGrid = true,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const w = 300;
  const h = 88;
  const pad = 6;
  const { d, line } = useMemo(() => scale(points, w, h, pad), [points]);
  const gradId = `da-${uid}`;

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex h-20 items-end rounded-lg bg-slate-50/50 dark:bg-slate-800/40",
          className,
        )}
      />
    );
  }
  if (variant === "bar") {
    const n = points.length;
    const maxV = Math.max(0.0001, ...points.map((p) => p.v));
    const gap = n > 1 ? 3 : 0;
    const barW = n ? Math.max(2, (w - pad * 2 - gap * Math.max(0, n - 1)) / n) : 0;
    return (
      <svg
        className={cn("w-full max-h-[5.5rem] overflow-visible", className)}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMax meet"
      >
        {showGrid && <GridLines w={w} h={h} pad={pad} rows={4} />}
        {points.map((p, i) => {
          const x = pad + i * (barW + gap);
          const bh = (p.v / maxV) * (h - pad * 2);
          return (
            <rect
              key={i}
              x={x}
              y={h - pad - bh}
              width={barW}
              height={Math.max(1, bh)}
              fill={color}
              opacity={0.82}
              rx={2}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      className={cn("w-full max-h-[5.5rem] overflow-visible [filter:none]", className)}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {showGrid && <GridLines w={w} h={h} pad={pad} rows={5} />}
      {fillGradient && d ? (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="70%" stopColor={color} stopOpacity="0.06" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}
      {fillGradient && d ? <path d={d} fill={`url(#${gradId})`} style={{ filter: "none" }} /> : null}
      {line ? (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

export function DonutChart({
  pct,
  color,
  className,
}: {
  pct: number;
  color: string;
  className?: string;
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const dash = (p / 100) * c;
  return (
    <svg
      className={cn("shrink-0 [filter:none]", className)}
      viewBox="0 0 110 110"
      width={110}
      height={110}
    >
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="9"
        className="text-slate-200 dark:text-slate-600/50"
      />
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 55 55)"
        style={{ filter: "none" }}
      />
    </svg>
  );
}
