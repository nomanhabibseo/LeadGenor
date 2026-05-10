"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { useEffect } from "react";

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

  const { data: plans } = useQuery({
    queryKey: ["subscriptions", "plans", token],
    queryFn: () =>
      apiFetch<{ whatsappInstruction: string; plans: { tier: string; title: string; priceUsd: string | null }[] }>(
        "/subscriptions/plans",
        token,
      ),
    enabled: !!token,
    staleTime: 300_000,
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
      router.refresh();
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=${encodeURIComponent("/onboarding/plan?from=dashboard")}`);
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center text-slate-600 dark:text-slate-400">
        <p>Please sign in to continue.</p>
        <Link href="/login" className="font-semibold text-violet-700 underline hover:text-violet-900 dark:text-violet-300">
          Go to login
        </Link>
      </div>
    );
  }

  const continueHref = "/dashboard";

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Activate your plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Same account after payment — manual activation applies Pro/Business. Use <strong>Continue</strong> when you&apos;re
          done to return to your dashboard.
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
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-md dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tierLabel(p.tier)}</h2>
              <p className="mt-1 text-2xl font-bold text-violet-700 dark:text-cyan-400/90">
                {p.priceUsd == null ? "$0" : `$${p.priceUsd}/mo`}
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
                    <div className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/35 dark:text-amber-50">
                      <p className="font-semibold">Pay manually</p>
                      <p className="mt-1">
                        Send payment to <span className="font-mono font-bold">Sadapay {PAYPHONE}</span>. Then WhatsApp your
                        payment screenshot to the same number so we can activate <strong>{tierLabel(p.tier)}</strong> on this
                        account.
                      </p>
                      <a
                        href={WA_HREF}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block font-semibold text-amber-900 underline dark:text-amber-100"
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
                      className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800/70"
                    >
                      {pendingThis ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        "I’ve sent payment / continue"
                      )}
                    </button>
                    <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                      Continue returns you to the <span className="font-semibold">dashboard</span>.
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Need help? WhatsApp ({plans?.whatsappInstruction ?? PAYPHONE}).
      </p>
    </div>
  );
}
