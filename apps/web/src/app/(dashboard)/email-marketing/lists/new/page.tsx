import { Suspense } from "react";
import { EmailListNewWizardPage } from "@/components/email-marketing/email-list-new-wizard-page";

export default function Page() {
  return (
    <Suspense
      fallback={<div className="em-page mx-auto max-w-6xl p-8 text-slate-500">Loading…</div>}
    >
      <EmailListNewWizardPage />
    </Suspense>
  );
}
