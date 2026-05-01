import { apiUrl } from "@/lib/api";
import type { PricingPlanId } from "@/lib/pricing-plan-details";

export async function postChoosePlan(token: string | undefined, interest: PricingPlanId) {
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
}
