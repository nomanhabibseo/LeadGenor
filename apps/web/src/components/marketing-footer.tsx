import Link from "next/link";
import Image from "next/image";
import { LOGO_PATH } from "@/lib/branding";
import { SmoothHashLink } from "@/components/smooth-hash-link";
import { cn } from "@/lib/utils";

const mutedLink =
  "text-sm text-slate-400 transition hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 rounded";

export function MarketingFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn("border-t border-white/10 bg-slate-950/95 text-slate-400 backdrop-blur-sm", className)}
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 lg:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src={LOGO_PATH}
                alt="LeadGenor"
                width={800}
                height={250}
                className="h-11 w-auto max-h-11 max-w-[min(100%,240px)] shrink-0 object-contain object-left"
                unoptimized
              />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              Automate your email outreach campaigns and manage vendors, clients, and orders in one platform.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Product</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <SmoothHashLink id="features" className={cn(mutedLink, "inline-block")}>
                  Features
                </SmoothHashLink>
              </li>
              <li>
                <Link href="/pricing" className={cn(mutedLink, "inline-block")}>
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Resources</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/blogs" className={cn(mutedLink, "inline-block")}>
                  Blogs
                </Link>
              </li>
              <li>
                <Link href="/contact" className={cn(mutedLink, "inline-block")}>
                  Contact
                </Link>
              </li>
              <li>
                <SmoothHashLink id="About" className={cn(mutedLink, "inline-block")}>
                  About us
                </SmoothHashLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Legal</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/privacy" className={cn(mutedLink, "inline-block")}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms-conditions" className={cn(mutedLink, "inline-block")}>
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-slate-500">
          © LeadGenor | All rights reserved.
        </p>
      </div>
    </footer>
  );
}
