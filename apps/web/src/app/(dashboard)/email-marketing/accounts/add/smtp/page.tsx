"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Info } from "lucide-react";
import { SmtpProviderLogo } from "@/components/email-marketing/smtp-provider-logo";
import { SMTP_PROVIDER_PRESETS } from "@/lib/smtp-provider-presets";

export default function SmtpProviderPickerPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-slate-500 dark:text-slate-400">Loading…</div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Please sign in.</p>
        <Link href="/login" className="mt-2 inline-block text-cyan-600 underline dark:text-cyan-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/email-marketing/accounts/add"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Back"
            >
              ←
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Add email account</h1>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 dark:border-slate-600"
              title="Pick your provider; we’ll fill typical SMTP/IMAP hosts."
            >
              <Info className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Pick your sender account&apos;s email provider.
          </p>
        </div>
        <Link
          href="/email-marketing/accounts/add"
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Close
        </Link>
      </div>

      <div className="grid max-h-[min(82vh,960px)] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {SMTP_PROVIDER_PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/email-marketing/accounts/add/smtp/form?preset=${encodeURIComponent(p.id)}`}
            className="group flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-cyan-500/50 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-cyan-500/40"
          >
            <div className="relative flex min-h-[44px] w-full items-center justify-center">
              <SmtpProviderLogo id={p.id} />
              {p.id === "gmail-smtp" || p.id === "google-workspace" || p.id === "icloud" || p.id === "proton" ? (
                <span
                  className="absolute right-0 top-0 text-slate-400"
                  title={
                    p.id === "icloud"
                      ? "App-specific password from Apple ID."
                      : p.id === "proton"
                        ? "IMAP/SMTP may require a paid plan or Proton Bridge."
                        : "You may need an App Password if 2FA is on."
                  }
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
            <span className="mt-3 text-center text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {p.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
