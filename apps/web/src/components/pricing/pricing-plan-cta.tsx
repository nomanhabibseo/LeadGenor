"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PricingPlanId } from "@/lib/pricing-plan-details";
import type { UsersMePayload } from "@/lib/user-subscription";
import { postChoosePlan } from "@/lib/pricing-choose-plan";
import { cn } from "@/lib/utils";

export function PricingPlanCta({
  planId,
  emphasized,
  /** Marketing /pricing: generic CTAs → login/register; never show current plan / /users/me. */
  assumeGuestAudience = false,
}: {
  planId: PricingPlanId;
  emphasized?: boolean;
  /** @deprecated Unused; onboarding always opens in-dashboard. Retained so callers pass through without breakage. */
  fromDashboard?: boolean;
  assumeGuestAudience?: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session, status } = useSession();
  const token = session?.accessToken as string | undefined;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isLoggedIn = !assumeGuestAudience && status === "authenticated";

  const { data: me } = useQuery({
    queryKey: ["users", "me", token],
    queryFn: () => apiFetch<UsersMePayload>("/users/me", token),
    enabled: !!token && isLoggedIn,
    staleTime: 60_000,
  });

  const alreadyChosen = useMemo(() => !!me?.planChosenAt, [me]);
  const currentRaw = me?.subscription?.effectiveTier ?? me?.subscriptionTier ?? "FREE";
  const currentTier = String(currentRaw).toUpperCase();
  const isCurrentPlan =
    (planId === "FREE" && currentTier === "FREE") ||
    (planId === "PRO" && currentTier === "PRO") ||
    (planId === "BUSINESS" && currentTier === "BUSINESS");

  if (!isLoggedIn) {
    /** After login or signup → in-app `/plans`; user picks tier then onboarding (in dashboard). */
    const afterAuth = encodeURIComponent("/plans");
    const hrefLogin = `/login?callbackUrl=${afterAuth}`;
    const label =
      planId === "FREE"
        ? "Continue with Free"
        : planId === "PRO"
          ? "Choose Pro"
          : "Choose Business";
    return (
      <Link
        href={hrefLogin}
        className={cn(
          "mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition",
          emphasized
            ? "bg-gradient-to-r from-brand-500 to-accent-violet text-white shadow-brand hover:brightness-110"
            : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/80",
        )}
      >
        {label}
      </Link>
    );
  }

  async function onPick() {
    setErr(null);
    setBusy(true);
    try {
      await postChoosePlan(token, planId);
      await qc.invalidateQueries({ queryKey: ["users", "me"] });
      router.push("/onboarding/plan?from=dashboard");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to choose plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={onPick}
        disabled={busy || (alreadyChosen && isCurrentPlan)}
        className={cn(
          "block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition",
          emphasized
            ? "bg-gradient-to-r from-brand-500 to-accent-violet text-white shadow-brand hover:brightness-110 disabled:opacity-60"
            : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/80",
        )}
      >
        {busy
          ? "Please wait..."
          : alreadyChosen && isCurrentPlan
            ? "Current plan"
            : planId === "FREE"
              ? "Activate Free"
              : planId === "PRO"
                ? "Choose Pro"
                : "Choose Business"}
      </button>
      {err ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">
          {err}
        </p>
      ) : null}
    </div>
  );
}
