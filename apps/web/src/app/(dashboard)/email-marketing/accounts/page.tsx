import { Suspense } from "react";
import { EmailAccountsPageClient } from "@/components/email-marketing/email-accounts-page-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl p-8 text-slate-500">Loading…</div>}>
      <EmailAccountsPageClient />
    </Suspense>
  );
}
