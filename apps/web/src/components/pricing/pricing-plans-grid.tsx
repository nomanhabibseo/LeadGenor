"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PricingPlanCta } from "@/components/pricing/pricing-plan-cta";
import { PRICING_PLANS } from "@/lib/pricing-plan-details";
import { cn } from "@/lib/utils";

export function PricingPlansGrid({
  fromDashboard,
  variant = "marketing",
  assumeGuestAudience = false,
}: {
  /** True on /pricing?from=dashboard and on in-app `/plans`. */
  fromDashboard: boolean;
  variant?: "marketing" | "dashboard";
  /** Public marketing pricing: CTAs → login only; no “current plan” from session. */
  assumeGuestAudience?: boolean;
}) {
  const dash = variant === "dashboard";

  return (
    <>
      <div className={cn("grid gap-5 lg:grid-cols-3", dash ? "mt-6" : "mt-10")}>
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-xl border p-5 shadow-xl",
              dash
                ? cn(
                    "bg-white shadow-md dark:bg-slate-900/90",
                    plan.emphasized
                      ? "border-violet-400/60 ring-2 ring-violet-500/25 dark:border-violet-600/50"
                      : "border-slate-200/90 dark:border-slate-700/80",
                  )
                : cn(
                    "bg-white/95 dark:bg-slate-900/90",
                    plan.emphasized
                      ? "border-violet-400/60 ring-2 ring-violet-500/30 dark:border-violet-600/50"
                      : "border-slate-200/90 dark:border-slate-700/80",
                  ),
            )}
          >
            {plan.emphasized ? (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-md">
                Popular
              </span>
            ) : null}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{plan.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{plan.subtitle}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{plan.priceLabel}</span>
              {plan.priceNote ? (
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/{plan.priceNote}</span>
              ) : null}
            </div>

            <ul className="mt-5 flex flex-1 flex-col gap-2 text-xs text-slate-700 dark:text-slate-200">
              {plan.bullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      plan.emphasized ? "text-violet-600 dark:text-violet-400" : "text-emerald-600 dark:text-emerald-400",
                    )}
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {!dash ? (
              <Link href={plan.ctaHref} className="sr-only">
                {plan.ctaLabel}
              </Link>
            ) : null}
            <PricingPlanCta
              planId={plan.id}
              emphasized={plan.emphasized}
              fromDashboard={fromDashboard}
              assumeGuestAudience={assumeGuestAudience}
            />
          </div>
        ))}
      </div>

      <p
        className={cn(
          "mx-auto max-w-2xl text-center text-sm text-slate-500 dark:text-slate-400",
          dash ? "mt-8" : "mt-12",
        )}
      >
        Monthly counters reset on UTC calendar months. Pro &amp; Business billing is manual (e.g. JazzCash / Easypaisa /
        bank) — after you pay, your plan is enabled on this same account.
      </p>
    </>
  );
}
