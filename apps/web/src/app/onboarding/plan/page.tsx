"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { MarketingHeader } from "@/components/marketing-header";
import { apiFetch, apiUrl } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
const PAYPHONE = process.env.NEXT_PUBLIC_PAYMENT_SADAPAY_MSISDN || "03211174453";
const WA_HREF =
  process.env.NEXT_PUBLIC_PAYMENT_WHATSAPP_URL ||
  "https://wa.me/923211174453?text=Hi%20—%20I%20paid%20for%20LeadGenor%20and%20am%20sending%20my%20payment%20screenshot.";

function tierLabel(t: string) {
  switch (t) {
    case "FREE":
      return "Free";
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    default:
      return t;
  }
}

export default function OnboardingPlanPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const qc = useQueryClient();
  const [fromDashboard, setFromDashboard] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setFromDashboard(sp.get("from") === "dashboard");
  }, []);

  const continueHref = useMemo(() => (fromDashboard ? "/dashboard" : "/login"), [fromDashboard]);

  const { data: plans } = useQuery({
    queryKey: ["subscriptions", "plans", token],
    queryFn: () =>
      apiFetch<{ whatsappInstruction: string; plans: { tier: string; title: string; priceUsd: string | null }[] }>(
        "/subscriptions/plans",
        token,
      ),
    enabled: !!token,
  });

  const choose = useMutation({
    mutationFn: async (interest?: string) => {
      const res = await fetch(apiUrl("/subscriptions/choose-plan"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ interest }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ ok: boolean }>;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users", "me"] });
      // After selecting a paid plan from Pricing, users land here for manual payment instructions.
      // We keep them here; they can go to dashboard from the header/nav.
      router.refresh();
    },
  });

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-slate-100">
        <p>Please sign in first.</p>
        <Link href="/login" className="font-semibold text-violet-400 underline">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50 dark:opacity-35" aria-hidden />
      <MarketingHeader />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Choose your plan</h1>
          <p className="mt-2 text-sm text-slate-400">
            Same account upgrades after payment — manual activation applies your Pro/Business privileges.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(plans?.plans ?? [
            { tier: "FREE", title: "Free", priceUsd: null },
            { tier: "PRO", title: "Pro", priceUsd: "12.99" },
            { tier: "BUSINESS", title: "Business", priceUsd: "29.99" },
          ]).map((p) => {
            const pendingThis = choose.isPending && choose.variables === p.tier;
            return (
            <div
              key={p.tier}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl dark:border-slate-700/80 dark:bg-slate-800/95 dark:text-slate-100"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tierLabel(p.tier)}</h2>
              <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-cyan-400/90">
                {p.priceUsd == null ? "PKR 0" : `$${p.priceUsd}/mo`}
              </p>
              <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-300">
                {p.tier === "FREE"
                  ? "Core CRM + capped email finder, lists, campaigns, templates, inbox sync."
                  : p.tier === "PRO"
                    ? "Higher monthly caps for outbound + finder."
                    : "Unlimited outbound and finder quotas."}
              </p>
              <div className="mt-4 space-y-2">
                {p.tier === "FREE" ? (
                  <button
                    type="button"
                    disabled={choose.isPending}
                    onClick={async () => {
                      await choose.mutateAsync("FREE");
                      router.push(continueHref);
                    }}
                    className="btn-save-primary-block w-full rounded-xl py-2.5 text-sm"
                  >
                    {pendingThis ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Continue with Free"}
                  </button>
                ) : (
                  <>
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                      <p className="font-semibold">Pay manually</p>
                      <p className="mt-1">
                        Send payment to <span className="font-mono font-bold">Sadapay {PAYPHONE}</span>. Then WhatsApp your
                        payment screenshot to the same number so we can activate <strong>{tierLabel(p.tier)}</strong> on
                        this account.
                      </p>
                      <a
                        href={WA_HREF}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block font-semibold text-amber-900 underline dark:text-amber-200"
                      >
                        Open WhatsApp
                      </a>
                    </div>
                    <button
                      type="button"
                      disabled={choose.isPending}
                      onClick={async () => {
                        await choose.mutateAsync(p.tier);
                        router.push(continueHref);
                      }}
                      className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700/60"
                    >
                      {pendingThis ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        "I’ve sent payment / continue"
                      )}
                    </button>
                    <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                      {fromDashboard ? (
                        <>
                          Continue will take you <span className="font-semibold">back to dashboard</span>.
                        </>
                      ) : (
                        <>
                          Continue will take you to <Link href="/login" className="font-semibold underline">Login</Link>.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-500">
          Need help? Contact us on WhatsApp ({plans?.whatsappInstruction ?? PAYPHONE}).
        </p>
      </div>
    </div>
  );
}
