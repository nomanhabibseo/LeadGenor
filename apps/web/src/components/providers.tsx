"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { AppDialogProvider } from "@/contexts/app-dialog-context";
import { ThemeProvider } from "@/components/theme-provider";
import { SmoothHashScrollEffects } from "@/components/smooth-hash-scroll-effects";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Cache-first navigation; reduces duplicate GETs across dashboard + CRM pages. */
            staleTime: 60_000,
            gcTime: 1000 * 60 * 30,
            refetchOnWindowFocus: false,
            /** API often starts slightly after Next in dev (`ECONNREFUSED`); keep bounded retries. */
            retry: (failureCount) => failureCount < 3,
            retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 8_000),
          },
        },
      }),
  );
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <SmoothHashScrollEffects />
          <AppDialogProvider>{children}</AppDialogProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
