"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { SmoothHashLink } from "@/components/smooth-hash-link";
import { cn } from "@/lib/utils";

const navMuted = cn(
  "rounded-xl px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white",
);

const navDrawerMuted = cn(
  "block w-full rounded-xl px-4 py-3 text-left text-base font-medium text-slate-100 transition hover:bg-white/10",
);

const drawerAccountGap = "mt-auto border-t border-white/10 pt-4 px-3";

export function MarketingHeader({ className }: { className?: string }) {
  const drawerId = useId();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen, closeMobileNav]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 shrink-0 border-b border-white/10 bg-slate-950/90 backdrop-blur-md dark:bg-slate-950/90",
          className,
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-2 px-4 py-3 md:gap-4 md:py-4">
          <Link href="/" className="flex min-w-0 shrink items-center py-1">
            <BrandMark variant="marketing" priority className="shrink-0" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            <nav
              className="hidden flex-1 items-center justify-center gap-1 lg:flex"
              aria-label="Primary"
            >
              <SmoothHashLink id="features" className={navMuted}>
                Features
              </SmoothHashLink>
              <Link href="/pricing" className={navMuted}>
                Pricing
              </Link>
              <Link href="/blogs" className={navMuted}>
                Blogs
              </Link>
              <Link href="/contact" className={navMuted}>
                Contact
              </Link>
            </nav>

            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 lg:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls={drawerId}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <nav className="hidden shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2 lg:flex" aria-label="Account">
              <Link href="/login" className={cn(navMuted, "whitespace-nowrap")}>
                Login
              </Link>
              <Link
                href="/register"
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-brand-500 to-accent-violet px-3 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 sm:gap-2 sm:px-4 md:px-5 md:py-2.5",
                )}
              >
                Get Started
                <ArrowRight className="hidden h-4 w-4 sm:inline" aria-hidden />
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-[2px]"
            aria-label="Dismiss menu"
            onClick={closeMobileNav}
          />
          <div
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-y-0 right-0 z-[70] flex w-[min(100vw-4rem,20rem)] flex-col border-l border-white/10 bg-slate-950/98 py-6 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 pb-4">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55"
                aria-label="Close menu"
                onClick={closeMobileNav}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3" aria-label="Primary mobile">
                <SmoothHashLink id="features" className={navDrawerMuted} onNavigate={closeMobileNav}>
                  Features
                </SmoothHashLink>
                <Link href="/pricing" className={navDrawerMuted} onClick={closeMobileNav}>
                  Pricing
                </Link>
                <Link href="/blogs" className={navDrawerMuted} onClick={closeMobileNav}>
                  Blogs
                </Link>
                <Link href="/contact" className={navDrawerMuted} onClick={closeMobileNav}>
                  Contact
                </Link>
              </nav>
              <div className={drawerAccountGap}>
                <Link href="/login" className={navDrawerMuted} onClick={closeMobileNav}>
                  Login
                </Link>
                <Link
                  href="/register"
                  className={cn(
                    "mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-accent-violet px-4 py-3 text-sm font-semibold text-white shadow-brand transition hover:brightness-110",
                  )}
                  onClick={closeMobileNav}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
