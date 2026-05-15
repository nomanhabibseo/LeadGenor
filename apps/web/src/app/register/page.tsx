"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { PasswordField } from "@/components/password-field";
import { apiUrl } from "@/lib/api";
import { sanitizeAppCallbackUrl } from "@/lib/sanitize-app-callback-url";
import { cn } from "@/lib/utils";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const safeCallback = sanitizeAppCallbackUrl(searchParams.get("callbackUrl"));
  const nextAfterAuth = safeCallback ?? "/plans";

  useEffect(() => {
    router.prefetch("/plans");
    router.prefetch("/dashboard");
  }, [router]);

  const loginHref = safeCallback ? `/login?callbackUrl=${encodeURIComponent(safeCallback)}` : "/login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("Please enter your name.");
      return;
    }
    setPending(true);
    let res: Response;
    try {
      res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: nameTrim }),
      });
    } catch {
      setPending(false);
      setError(
        "Cannot reach the API—run `npm run dev` from the project root (web + Nest on port 4000). On another device/LAN URL, Next proxies to localhost; restart the web dev server after env changes.",
      );
      return;
    }
    if (!res.ok) {
      setPending(false);
      const raw = await res.text();
      let msg = raw || "Registration failed";
      try {
        const j = JSON.parse(raw) as { message?: string | string[] };
        if (typeof j.message === "string") msg = j.message;
        else if (Array.isArray(j.message)) msg = j.message.map((x) => String(x)).join(" ");
      } catch {
        // keep raw text
      }
      setError(msg);
      return;
    }
    const sign = await signIn("credentials", { email, password, redirect: false });
    if (sign?.error) {
      setPending(false);
      if (sign.error === "Configuration") {
        setError(
          "Account created but sign-in failed: set NEXTAUTH_SECRET in apps/web/.env.local and restart Next.js.",
        );
        return;
      }
      setError(
        "Account created but automatic sign-in failed. Try logging in manually (check API on port 4000).",
      );
      return;
    }
    if (sign?.ok) {
      window.location.assign(nextAfterAuth);
    } else {
      setPending(false);
    }
  }

  return (
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
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">Start managing vendors and orders</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5" aria-busy={pending}>
          <label className="block">
            <span className="form-label">Name</span>
            <input
              type="text"
              required
              minLength={1}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              disabled={pending}
            />
          </label>
          <label className="block">
            <span className="form-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              disabled={pending}
            />
          </label>
          <label className="block">
            <span className="form-label">Password (min 8)</span>
            <PasswordField
              value={password}
              onChange={setPassword}
              className="form-input"
              minLength={8}
              required
              autoComplete="new-password"
              aria-label="Password"
              disabled={pending}
            />
          </label>
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
                Creating account…
              </>
            ) : (
              "Sign up"
            )}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-brand-700 hover:underline dark:text-cyan-400/90"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <MarketingHeader />
      <Suspense
        fallback={
          <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 pb-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
          </div>
        }
      >
        <RegisterPageContent />
      </Suspense>
      <MarketingFooter />
    </div>
  );
}
