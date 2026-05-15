"use client";

import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <MarketingHeader />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 pb-16">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/95">
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Forgot password</h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Self-service password reset is not enabled for this workspace yet. Please contact your administrator or the
          person who created your account to reset your password.
        </p>
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          If you are self-hosting LeadGenor, you can reset a user in the database or add a reset flow in a future
          release.
        </p>
        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Back to sign in
          </Link>
        </div>
      </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
