"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { apiUrl } from "@/lib/api";

type UsersMeLite = { planChosenAt: string | null };

export function PricingPlanNotice() {
  const { data: session, status } = useSession();
  const token = session?.accessToken as string | undefined;
  const [planChosenAt, setPlanChosenAt] = useState<string | null>(null);

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
        const j = (await res.json()) as UsersMeLite;
        if (!cancelled) setPlanChosenAt(j.planChosenAt);
      } catch {
        /* ignore */
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status !== "authenticated") return null;
  if (planChosenAt) return null;

  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-50">
      Please select a plan first. Once you’ve chosen a plan, you’ll be able to continue to your dashboard.
    </div>
  );
}

