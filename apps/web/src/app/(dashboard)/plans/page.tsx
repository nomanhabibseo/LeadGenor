import { PricingPlanNotice } from "@/components/pricing/pricing-plan-notice";
import { PricingPlansGrid } from "@/components/pricing/pricing-plans-grid";

export default function DashboardPlansPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Pricing</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Plans that match how you work
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Vendor &amp; order CRM stays generous on every tier. Email marketing limits scale from Free → Pro → Business.
          Paid plans are activated manually after payment verification — you keep the same account.
        </p>
      </div>

      <PricingPlanNotice />

      <PricingPlansGrid fromDashboard variant="dashboard" />
    </div>
  );
}
