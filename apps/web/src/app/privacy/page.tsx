import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Privacy Policy — LeadGenor",
  description: "How LeadGenor collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  const ul = "ml-5 mt-2 list-disc space-y-2";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50" aria-hidden />

      <MarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-14 pb-20">
        <article className="space-y-4 text-base leading-relaxed text-slate-300 [&_a]:font-medium [&_a]:text-cyan-400 [&_a]:underline-offset-2 hover:[&_a]:text-cyan-300">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy Policy</h1>

          <p>
            LeadGenor (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) values your privacy. This Privacy Policy explains how we
            collect, use, and protect your information when you use our platform.
          </p>
          <p>By using LeadGenor, you agree to the terms outlined in this policy.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">1. Information We Collect</h2>
          <p>We may collect the following types of information:</p>

          <h3 className="mt-6 text-lg font-bold tracking-tight text-white">a) Account Information</h3>
          <ul className={ul}>
            <li>Name</li>
            <li>Email address</li>
            <li>Login credentials</li>
          </ul>

          <h3 className="mt-6 text-lg font-bold tracking-tight text-white">b) Usage Data</h3>
          <ul className={ul}>
            <li>Pages visited</li>
            <li>Features used</li>
            <li>Actions taken within the platform</li>
          </ul>

          <h3 className="mt-6 text-lg font-bold tracking-tight text-white">c) Outreach Data</h3>
          <ul className={ul}>
            <li>Website URLs</li>
            <li>Contact emails</li>
            <li>Campaign data and email content</li>
          </ul>

          <h3 className="mt-6 text-lg font-bold tracking-tight text-white">d) Technical Data</h3>
          <ul className={ul}>
            <li>IP address</li>
            <li>Browser type</li>
            <li>Device information</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">2. How We Use Your Information</h2>
          <p>We use your data to:</p>
          <ul className={ul}>
            <li>Provide and improve our services</li>
            <li>Manage your account</li>
            <li>Run outreach campaigns</li>
            <li>Analyze performance and usage</li>
            <li>Communicate with you regarding updates or support</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">3. Data Protection</h2>
          <p>
            We take reasonable measures to protect your data from unauthorized access, misuse, or loss.
          </p>
          <p>However, no system is completely secure, and we cannot guarantee absolute security.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">4. Data Sharing</h2>
          <p>We do not sell your personal data.</p>
          <p>We may share data only in the following cases:</p>
          <ul className={ul}>
            <li>With trusted service providers (e.g., hosting, email services)</li>
            <li>If required by law or legal process</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">5. Cookies</h2>
          <p>We may use cookies and similar technologies to improve user experience and track usage.</p>
          <p>You can control cookies through your browser settings.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">6. Data Retention</h2>
          <p>We retain your data as long as your account is active or as needed to provide services.</p>
          <p>You may request deletion of your data at any time.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className={ul}>
            <li>Access your data</li>
            <li>Request correction</li>
            <li>Request deletion</li>
            <li>Contact us regarding your privacy concerns</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">8. Third-Party Services</h2>
          <p>
            LeadGenor may integrate with third-party tools (such as email providers). We are not responsible for their privacy
            practices.
          </p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time.</p>
          <p>Any changes will be posted on this page with an updated date.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">10. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, you can contact us at:</p>
          <p>
            <strong className="text-slate-200">Email:</strong>{" "}
            <a href="mailto:support@leadgenor.com">support@leadgenor.com</a>
          </p>

          <hr className="my-10 border-white/15" />

          <p className="pb-2">
            We are committed to protecting your privacy and ensuring transparency in how your data is handled.
          </p>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}
