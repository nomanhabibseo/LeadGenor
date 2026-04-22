"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { PasswordField } from "@/components/password-field";
import { apiUrl } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nameTrim = name.trim();
    if (!nameTrim) {
      setError("Please enter your name.");
      return;
    }
    let res: Response;
    try {
      res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: nameTrim }),
      });
    } catch {
      setError(
        "Cannot reach the API. Start it with: npm run dev (from project root) so port 4000 is up. Check NEXT_PUBLIC_API_URL in apps/web/.env.local.",
      );
      return;
    }
    if (!res.ok) {
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
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-60 dark:opacity-40" aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur dark:border-slate-700/80 dark:bg-slate-800/95">
        <Link href="/" className="mb-8 flex justify-center">
          <BrandMark variant="auth" priority />
        </Link>
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100">Create your account</h1>
        <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">Start managing vendors and orders</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="form-label">Name</span>
            <input
              type="text"
              required
              minLength={1}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
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
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-save-primary-block rounded-xl py-3">
            Sign up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-cyan-400/90">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
