import { EmailMailboxPage } from "@/components/email-marketing/email-mailbox-page";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8 text-slate-500">Loading…</div>}>
      <EmailMailboxPage />
    </Suspense>
  );
}
