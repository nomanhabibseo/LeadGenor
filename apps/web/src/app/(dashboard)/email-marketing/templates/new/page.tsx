import { Suspense } from "react";
import { EmailNewTemplatePage } from "@/components/email-marketing/email-new-template-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-8 text-slate-500">Loading…</div>}>
      <EmailNewTemplatePage />
    </Suspense>
  );
}
