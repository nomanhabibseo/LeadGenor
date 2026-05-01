"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { PricingPlanId } from "@/lib/pricing-plan-details";
import type { UsersMePayload } from "@/lib/user-subscription";
import { postChoosePlan } from "@/lib/pricing-choose-plan";
import { cn } from "@/lib/utils";

export function PricingPlanCta({
  planId,
  emphasized,
  fromDashboard,
}: {
  planId: PricingPlanId;
  emphasized?: boolean;
  fromDashboard?: boolean;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken as string | undefined;

  const [me, setMe] = useState<UsersMePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isLoggedIn = status === "authenticated";

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) return;
      try {
        const res = await fetch(apiUrl("/users/me"), {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as UsersMePayload;
        if (!cancelled) setMe(j);
      } catch {
        /* ignore */
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const alreadyChosen = useMemo(() => !!me?.planChosenAt, [me]);
  const currentTier = me?.subscription?.effectiveTier;
  const isCurrentPlan =
    (planId === "FREE" && currentTier === "FREE") ||
    (planId === "PRO" && currentTier === "PRO") ||
    (planId === "BUSINESS" && currentTier === "BUSINESS");

  if (!isLoggedIn) {
    // Marketing default
    const href = planId === "FREE" ? "/register" : "/login";
    const label = planId === "FREE" ? "Create free account" : "Login to choose";
    return (
      <Link
        href={href}
        className={cn(
          "mt-10 block w-full rounded-xl py-3 text-center text-sm font-semibold transition",
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
      if (planId === "FREE") {
        router.push("/dashboard");
      } else {
        router.push(fromDashboard ? "/onboarding/plan?from=dashboard" : "/onboarding/plan");
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to choose plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10">
      {alreadyChosen && isCurrentPlan ? (
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Current plan
        </p>
      ) : null}
      <button
        type="button"
        onClick={onPick}
        disabled={busy || (alreadyChosen && isCurrentPlan)}
        className={cn(
          "block w-full rounded-xl py-3 text-center text-sm font-semibold transition",
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

