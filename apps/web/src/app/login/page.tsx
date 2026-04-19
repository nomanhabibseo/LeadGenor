"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 dark:bg-brand-gradient">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/95">
        <Link href="/" className="mb-8 flex justify-center">
          <BrandMark variant="auth" priority />
        </Link>
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
            />
          </label>
          <label className="block">
            <span className="form-label">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </label>
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
  );
}
