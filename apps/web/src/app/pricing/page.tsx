import { PricingPlanNotice } from "@/components/pricing/pricing-plan-notice";
import { PricingPlansGrid } from "@/components/pricing/pricing-plans-grid";
import { MarketingHeader } from "@/components/marketing-header";
import { MarketingFooter } from "@/components/marketing-footer";

type PricingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const sp = (await searchParams) ?? {};
  const fromDashboard =
    (Array.isArray(sp.from) ? sp.from[0] : sp.from ?? "").toString() === "dashboard";
  /** Standard marketing /pricing: no account-based “current plan” UI; choose plan → login → onboarding. */
  const publicMarketingPricing = !fromDashboard;
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
          <PricingPlanNotice publicMarketingPage={publicMarketingPricing} />
        </div>

        <PricingPlansGrid
          fromDashboard={fromDashboard}
          variant="marketing"
          assumeGuestAudience={publicMarketingPricing}
        />
      </main>

      <MarketingFooter />
    </div>
  );
}
