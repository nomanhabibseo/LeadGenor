"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

const W = 52;
const H = 20;
const PAD = 2;

/**
 * Diagonal “traffic” line: left = low, right = high (0–10k). Colors by band; 10k+ = full height, green.
 */
export function TrafficSparkline({ value }: { value: number; seed?: string }) {
  const { d, areaD, strokeClass, fillClass } = useMemo(() => {
    const v = Math.max(0, Number(value) || 0);
    const bottom = H - PAD;
    const topY = PAD;
    const span = bottom - topY;

    let strokeClass: string;
    if (v === 0) {
      strokeClass = "stroke-red-600 dark:stroke-red-400";
    } else if (v < 1000) {
      strokeClass = "stroke-red-600 dark:stroke-red-400";
    } else if (v < 10_000) {
      strokeClass = "stroke-sky-600 dark:stroke-sky-400";
    } else {
      strokeClass = "stroke-emerald-600 dark:stroke-emerald-400";
    }

    const fillClass = (() => {
      if (v === 0) return "fill-red-500/[0.10] dark:fill-red-400/[0.12]";
      if (v < 1000) return "fill-red-500/[0.10] dark:fill-red-400/[0.12]";
      if (v < 10_000) return "fill-sky-500/[0.10] dark:fill-sky-400/[0.12]";
      return "fill-emerald-500/[0.10] dark:fill-emerald-400/[0.12]";
    })();

    const x0 = PAD;
    const x1 = W - PAD;
    let y0: number;
    let y1: number;
    if (v === 0) {
      y0 = y1 = bottom;
    } else if (v >= 10_000) {
      y0 = bottom;
      y1 = topY;
    } else {
      y0 = bottom;
      const t = v / 10_000;
      y1 = bottom - t * span;
    }

    const lineD = `M${x0} ${y0} L${x1} ${y1}`;
    const areaD = `${lineD} L${x1} ${bottom} L${x0} ${bottom} Z`;

    return { d: lineD, areaD, strokeClass, fillClass };
  }, [value]);

  return (
    <div className="inline-flex items-center" aria-hidden>
      <svg width={W} height={H} className="shrink-0" viewBox={`0 0 ${W} ${H}`}>
        <path d={areaD} className={cn(fillClass)} />
        <path
          d={d}
          fill="none"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(strokeClass)}
        />
      </svg>
    </div>
  );
}
