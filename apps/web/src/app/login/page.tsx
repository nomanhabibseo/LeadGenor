"use client";

import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { PasswordField } from "@/components/password-field";
import { apiUrl } from "@/lib/api";
import type { UsersMePayload } from "@/lib/user-subscription";

const SAVED_EMAIL_KEY = "leadgenor_saved_login_email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      try {
        const session = await getSession();
        const t = session?.accessToken as string | undefined;
        if (t) {
          const mr = await fetch(apiUrl("/users/me"), { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
          if (mr.ok) {
            const j = (await mr.json()) as UsersMePayload;
            if (!j.planChosenAt) {
              router.push("/pricing");
              router.refresh();
              return;
            }
          }
        }
      } catch {
        /* fall through */
      }
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <MarketingHeader />
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 pb-16">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/95">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800 rounded-lg">
            <BrandMark variant="auth" priority className="max-w-[min(100%,280px)]" />
          </Link>
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">Sign in to your LeadGenor account</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="form-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              autoComplete="email"
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
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30 dark:border-slate-500"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="font-medium text-brand-700 hover:underline dark:text-cyan-400/90"
            >
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-save-primary-block rounded-xl py-3">
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          No account?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline dark:text-cyan-400/90">
            Get started
          </Link>
        </p>
      </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
