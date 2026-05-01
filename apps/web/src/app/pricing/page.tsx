import Link from "next/link";
import { Check } from "lucide-react";
import { PricingPlanCta } from "@/components/pricing/pricing-plan-cta";
import { MarketingHeader } from "@/components/marketing-header";
import { PRICING_PLANS } from "@/lib/pricing-plan-details";
import { cn } from "@/lib/utils";
import { PricingPlanNotice } from "@/components/pricing/pricing-plan-notice";
import { MarketingFooter } from "@/components/marketing-footer";

type PricingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const sp = (await searchParams) ?? {};
  const fromDashboard =
    (Array.isArray(sp.from) ? sp.from[0] : sp.from ?? "").toString() === "dashboard";
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50" aria-hidden />

      <MarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-14 pb-12">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-400">Pricing</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Plans that match how you work</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            Vendor &amp; order CRM stays generous on every tier. Email marketing limits scale from Free → Pro → Business.
            Paid plans are activated manually after payment verification — you keep the same account.
          </p>
        </div>

        <div className="mt-8">
          <PricingPlanNotice />
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white/95 p-8 shadow-xl dark:bg-slate-900/90",
                plan.emphasized
                  ? "border-violet-400/60 ring-2 ring-violet-500/30 dark:border-violet-600/50"
                  : "border-slate-200/90 dark:border-slate-700/80",
              )}
            >
              {plan.emphasized ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-4 py-1 text-xs font-bold text-white shadow-md">
                  Popular
                </span>
              ) : null}
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{plan.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{plan.subtitle}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">{plan.priceLabel}</span>
                {plan.priceNote ? (
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/{plan.priceNote}</span>
                ) : null}
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-slate-700 dark:text-slate-200">
                {plan.bullets.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0",
                        plan.emphasized ? "text-violet-600 dark:text-violet-400" : "text-emerald-600 dark:text-emerald-400",
                      )}
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className="sr-only"
              >
                {plan.ctaLabel}
              </Link>
              <PricingPlanCta planId={plan.id} emphasized={plan.emphasized} fromDashboard={fromDashboard} />
            </div>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-slate-500 dark:text-slate-400">
          Monthly counters reset on UTC calendar months. Pro &amp; Business billing is manual (e.g. JazzCash / Easypaisa /
          bank) — after you pay, your plan is enabled on this same account.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
