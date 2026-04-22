import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ArrowRight, LayoutDashboard, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-90" aria-hidden />
      <header className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 md:py-6">
          <Link href="/" className="flex shrink-0 items-center py-1">
            <BrandMark variant="marketing" priority />
          </Link>
          <nav className="flex items-center gap-3 text-sm md:gap-4">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2.5 font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-violet px-5 py-2.5 font-semibold text-white shadow-brand transition hover:brightness-110"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 md:pt-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-cyan-200/90 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Guest posts · Vendors · Clients · Orders · Revenue
        </div>
        <h1 className="mt-8 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Run your guest-post agency from{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-amber-300 bg-clip-text text-transparent">
            one dashboard
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
          Track vendors, clients, and orders in one place. Multi-currency vendors, reseller pricing, invoices, and
          revenue in USD — built for agencies and resellers.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            <LayoutDashboard className="h-5 w-5 opacity-80" />
            Login to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
