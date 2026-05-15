"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

export type ReferenceData = {
  currencies: { id: string; code: string; symbol: string; name: string }[];
  niches: { id: string; slug: string; label: string }[];
  countries: { id: string; code: string; name: string }[];
  languages: { id: string; code: string; name: string }[];
  paymentMethods: { id: string; slug: string; label: string }[];
  afterLiveOptions: { id: string; label: string }[];
  deliveryDayOptions: number[];
};

export function useReference() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  return useQuery({
    queryKey: ["reference"],
    queryFn: () => apiFetch<ReferenceData>("/reference", token),
    enabled: !!token,
    retry: 1,
    staleTime: 300_000,
  });
}
