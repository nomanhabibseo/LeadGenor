"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { sanitizeAppCallbackUrl } from "@/lib/sanitize-app-callback-url";
import { BrandMark } from "@/components/brand-mark";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { PasswordField } from "@/components/password-field";
import { cn } from "@/lib/utils";

const SAVED_EMAIL_KEY = "leadgenor_saved_login_email";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/plans");
  }, [router]);

  const loginCallbackPreserve = sanitizeAppCallbackUrl(searchParams.get("callbackUrl"));
  const registerHref = loginCallbackPreserve
    ? `/register?callbackUrl=${encodeURIComponent(loginCallbackPreserve)}`
    : "/register";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    let navigated = false;
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        if (res.error === "Configuration") {
          setError(
            "Server configuration error. Set NEXTAUTH_SECRET and NEXTAUTH_URL in apps/web/.env.local, then restart dev.",
          );
          return;
        }
        if (res.error === "CredentialsSignin" || res.status === 401) {
          setError("Invalid email or password.");
          return;
        }
        setError(`Sign-in failed (${res.error}). Is the API running on port 4000?`);
        return;
      }
      if (res?.ok) {
        try {
          if (rememberMe && email.trim()) {
            localStorage.setItem(SAVED_EMAIL_KEY, email.trim());
          } else {
            localStorage.removeItem(SAVED_EMAIL_KEY);
          }
        } catch {
          /* ignore */
        }
        // Full navigation so middleware sees session cookies. Plan gating runs in `DashboardShell` (one `/users/me`).
        navigated = true;
        const next = sanitizeAppCallbackUrl(searchParams.get("callbackUrl")) ?? "/dashboard";
        window.location.assign(next);
      }
    } finally {
      if (!navigated) setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <MarketingHeader />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 pb-16">
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/95">
          <div className="mb-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800"
            >
              <BrandMark variant="auth" priority className="max-w-[min(100%,280px)]" />
            </Link>
          </div>
          <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            Sign in to your LeadGenor account
          </p>
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-5"
            aria-busy={pending}
          >
            <label className="block">
              <span className="form-label">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                autoComplete="email"
                disabled={pending}
              />
            </label>
            <label className="block">
              <span className="form-label">Password</span>
              <PasswordField
                value={password}
                onChange={setPassword}
                className="form-input"
                autoComplete="current-password"
                aria-label="Password"
                required
                disabled={pending}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 disabled:opacity-50 dark:border-slate-500"
                  disabled={pending}
                />
                Remember me
              </label>
              <Link
                href="/forgot-password"
                className="font-medium text-brand-700 hover:underline dark:text-cyan-400/90"
                tabIndex={pending ? -1 : 0}
              >
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className={cn(
                "btn-save-primary-block inline-flex items-center justify-center gap-2 rounded-xl py-3",
                pending && "pointer-events-none opacity-90",
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            No account?{" "}
            <Link
              href={registerHref}
              className="font-semibold text-brand-700 hover:underline dark:text-cyan-400/90"
              tabIndex={pending ? -1 : 0}
            >
              Get started
            </Link>
          </p>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-slate-950 dark:bg-black">
          <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
          <MarketingHeader />
          <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 pb-16">
            <Loader2 className="h-8 w-8 shrink-0 animate-spin text-slate-400" aria-hidden />
          </div>
          <MarketingFooter />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
