"use client";

import dynamic from "next/dynamic";

/** Client-only load: avoids flaky dev SSR chunk maps (ENOENT webpack.js → __webpack_require__ undefined). */
export const EmailAccountsPageClient = dynamic(
  () => import("@/components/email-marketing/email-accounts-page"),
  {
    ssr: false,
    loading: () => <div className="mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>,
  },
);
