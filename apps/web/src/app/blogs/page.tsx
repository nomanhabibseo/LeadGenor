import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Blogs — LeadGenor",
  description: "Articles and guides from LeadGenor.",
};

export default function BlogsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50" aria-hidden />
      <MarketingHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-white">Blogs</h1>
        <p className="mt-4 text-slate-400">Articles and guides are coming soon.</p>
      </main>
      <MarketingFooter />
    </div>
  );
}
