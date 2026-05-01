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
            staleTime: 0,
            gcTime: 1000 * 60 * 30,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  return (
    <SessionProvider refetchOnWindowFocus>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <SmoothHashScrollEffects />
          <AppDialogProvider>{children}</AppDialogProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
