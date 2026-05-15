import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Contact — LeadGenor",
  description: "Contact LeadGenor for customer support, guest posting, or feedback.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50" aria-hidden />

      <MarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-14 pb-20">
        <article className="space-y-4 text-base leading-relaxed text-slate-300 [&_a]:font-medium [&_a]:text-cyan-400 [&_a]:underline-offset-2 hover:[&_a]:text-cyan-300">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Contact LeadGenor</h1>

          <p>We&apos;d love to hear from you.</p>
          <p>
            Whether you need help with your outreach campaigns, have a question about features, or want to collaborate — the
            LeadGenor team is here to support you.
          </p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span aria-hidden>📩 </span>Customer Support
          </h2>
          <p>Need help using LeadGenor or facing an issue?</p>
          <p>Our support team is ready to assist you with:</p>
          <ul className="ml-5 mt-2 list-disc space-y-2">
            <li>Account setup and onboarding</li>
            <li>Campaign issues or errors</li>
            <li>Email sending and deliverability questions</li>
            <li>Feature guidance and usage help</li>
          </ul>
          <p>
            <strong className="text-slate-200">Email:</strong>{" "}
            <a href="mailto:support@leadgenor.com">support@leadgenor.com</a>
          </p>
          <p>We aim to respond as quickly as possible and ensure you have a smooth experience using LeadGenor.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span aria-hidden>🤝 </span>Guest Posting
          </h2>
          <p>
            LeadGenor accepts high-quality guest contributions from marketers, freelancers, and outreach professionals.
          </p>
          <p>If you want to publish your content on LeadGenor, we currently accept guest posts in the following areas:</p>
          <ul className="ml-5 mt-2 list-disc space-y-2">
            <li>SaaS</li>
            <li>Email Marketing</li>
            <li>SEO</li>
            <li>Email Automation</li>
          </ul>

          <h3 className="mt-8 text-lg font-bold tracking-tight text-white">
            <span aria-hidden>📌 </span>Guest Post Guidelines
          </h3>
          <p>To maintain quality and provide real value to our audience:</p>
          <ul className="ml-5 mt-2 list-disc space-y-2">
            <li>Content must be <strong className="text-slate-200">100% original and unique</strong></li>
            <li>
              It should include{" "}
              <strong className="text-slate-200">practical insights, strategies, or real-world examples</strong>
            </li>
            <li>
              Content should be{" "}
              <strong className="text-slate-200">helpful for marketers, freelancers, and outreach professionals</strong>
            </li>
            <li>Avoid spammy, overly promotional, or low-quality submissions</li>
          </ul>
          <p>We reserve the right to edit or reject submissions that do not meet our standards.</p>
          <p>
            <strong className="text-slate-200">For guest posting inquiries:</strong>
            <br />
            Email: <a href="mailto:info@leadgenor.com">info@leadgenor.com</a>
          </p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span aria-hidden>🚀 </span>Your Feedback Matters
          </h2>
          <p>LeadGenor is built to simplify outreach for freelancers and professionals.</p>
          <p>
            If you have suggestions, feedback, or ideas — we&apos;d love to hear from you. Your input helps us improve and
            build a better platform for everyone.
          </p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">
            <span aria-hidden>📬 </span>We&apos;re Just One Email Away
          </h2>
          <p>For any questions — support, guest posting, or feedback — feel free to reach out.</p>
          <p>
            We&apos;re here to help you grow faster and manage outreach more efficiently with LeadGenor.
          </p>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
