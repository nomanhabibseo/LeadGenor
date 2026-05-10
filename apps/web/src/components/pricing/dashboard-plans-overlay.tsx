"use client";

import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PricingPlanId } from "@/lib/pricing-plan-details";
import { PRICING_PLANS } from "@/lib/pricing-plan-details";
import { postChoosePlan } from "@/lib/pricing-choose-plan";
import type { UsersMePayload } from "@/lib/user-subscription";
import { cn } from "@/lib/utils";

export function DashboardPlansOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  const { data: me } = useQuery({
    queryKey: ["users", "me", token],
    queryFn: () => apiFetch<UsersMePayload>("/users/me", token),
    enabled: !!token && open,
  });

  const current = me?.subscription?.effectiveTier as PricingPlanId | undefined;

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  const choose = useMutation({
    mutationFn: async (planId: PricingPlanId) => {
      await postChoosePlan(token, planId);
      await qc.invalidateQueries({ queryKey: ["users", "me"] });
      if (planId === "FREE") {
        await router.refresh();
        return;
      }
      router.push("/onboarding/plan?from=dashboard");
      router.refresh();
    },
    onSuccess: () => {
      onClose();
    },
    onError: () => {},
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-plans-title"
        className="relative mt-6 w-full max-w-5xl rounded-2xl border border-slate-200 bg-[#f4f6fa] p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-3 top-3 rounded-xl p-2 text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close plans"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-12 text-center">
          <h2
            id="dashboard-plans-title"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl"
          >
            Plans &amp; limits
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Your active plan applies across email marketing quotas. Paid upgrades use manual verification—your account stays the same after activation.
          </p>
        </div>

        {choose.isError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {choose.error instanceof Error ? choose.error.message : "Something went wrong. Try again."}
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const isCurrent =
              !!current &&
              ((plan.id === "FREE" && current === "FREE") ||
                (plan.id === "PRO" && current === "PRO") ||
                (plan.id === "BUSINESS" && current === "BUSINESS"));
            const pendingThis = choose.isPending && choose.variables === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border bg-white p-4 shadow-lg dark:bg-slate-900/95",
                  plan.emphasized && !isCurrent
                    ? "border-violet-400/70 ring-2 ring-violet-500/25 dark:border-violet-600/50"
                    : "border-slate-200 dark:border-slate-700/80",
                  isCurrent && "opacity-85 bg-slate-100 shadow-inner dark:bg-slate-950/90 dark:opacity-95",
                  isCurrent && "ring-1 ring-slate-300 dark:ring-slate-600",
                )}
              >
                {plan.emphasized && !isCurrent ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-md">
                    Popular
                  </span>
                ) : null}

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{plan.title}</h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{plan.subtitle}</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{plan.priceLabel}</span>
                  {plan.priceNote ? (
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">/{plan.priceNote}</span>
                  ) : null}
                </div>

                <ul className="mt-4 flex flex-1 flex-col gap-2 text-xs text-slate-700 dark:text-slate-200">
                  {plan.bullets.slice(0, 6).map((line) => (
                    <li key={line} className="flex gap-1.5">
                      <Check
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          plan.emphasized && !isCurrent
                            ? "text-violet-600 dark:text-violet-400"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                        aria-hidden
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={isCurrent || choose.isPending}
                    onClick={() => choose.mutate(plan.id)}
                    className={cn(
                      "w-full rounded-lg py-2.5 text-center text-xs font-semibold transition",
                      isCurrent
                        ? "cursor-not-allowed border border-slate-300 bg-slate-200/80 text-slate-600 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-400"
                        : plan.emphasized
                          ? "bg-gradient-to-r from-brand-500 to-accent-violet text-white shadow-brand hover:brightness-110 disabled:opacity-60"
                          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/80",
                    )}
                  >
                    {isCurrent
                      ? "Current plan"
                      : pendingThis
                        ? "Please wait..."
                        : plan.id === "FREE"
                          ? "Activate Free"
                          : plan.id === "PRO"
                            ? "Choose Pro"
                            : "Choose Business"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
