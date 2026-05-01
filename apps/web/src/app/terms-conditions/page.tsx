import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";

export const metadata: Metadata = {
  title: "Terms & Conditions — LeadGenor",
  description: "Terms and conditions for using LeadGenor.",
};

export default function TermsConditionsPage() {
  const ul = "ml-5 mt-2 list-disc space-y-2";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-50" aria-hidden />

      <MarketingHeader />

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-14 pb-20">
        <article className="space-y-4 text-base leading-relaxed text-slate-300 [&_a]:font-medium [&_a]:text-cyan-400 [&_a]:underline-offset-2 hover:[&_a]:text-cyan-300">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Terms &amp; Conditions
          </h1>

          <p>Welcome to LeadGenor.</p>
          <p>
            By accessing or using our platform, you agree to comply with and be bound by the following Terms &amp;
            Conditions. If you do not agree, please do not use the service.
          </p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">1. Use of Service</h2>
          <p>LeadGenor is designed for outreach professionals, freelancers, and marketers to manage outreach campaigns.</p>
          <p>You agree to use the platform only for lawful purposes and in accordance with these terms.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">2. User Responsibilities</h2>
          <p>By using LeadGenor, you agree that:</p>
          <ul className={ul}>
            <li>You will not use the platform for spam, illegal, or harmful activities</li>
            <li>You are responsible for the data you upload, including emails and content</li>
            <li>You will not misuse or attempt to disrupt the platform</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">3. Account Access</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
          <p>LeadGenor is not liable for any loss or damage resulting from unauthorized access to your account.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">4. Subscription &amp; Payments</h2>
          <p>LeadGenor offers Free, Pro, and Business plans.</p>
          <ul className={ul}>
            <li>Paid plans provide access to advanced features</li>
            <li>Subscription duration is defined at the time of activation</li>
            <li>Access will automatically downgrade to Free once the subscription expires</li>
            <li>Payments (if applicable) are handled manually unless stated otherwise</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">5. Feature Availability</h2>
          <p>We may update, modify, or remove features at any time to improve the platform.</p>
          <p>We do not guarantee that all features will always be available without interruption.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">6. Data &amp; Content</h2>
          <p>You retain ownership of your data.</p>
          <p>However, you grant LeadGenor the right to process and use your data to provide services.</p>
          <p>We are not responsible for the accuracy or legality of user-submitted data.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">7. Email Usage &amp; Compliance</h2>
          <p>You agree to use LeadGenor in compliance with email regulations and best practices.</p>
          <ul className={ul}>
            <li>Do not send spam or unsolicited bulk emails</li>
            <li>Ensure your outreach content is relevant and appropriate</li>
            <li>Respect recipient privacy and consent where applicable</li>
          </ul>
          <p>Violation of these rules may result in account suspension.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">8. Limitation of Liability</h2>
          <p>LeadGenor is provided &quot;as is&quot; without warranties of any kind.</p>
          <p>We are not liable for:</p>
          <ul className={ul}>
            <li>Loss of data</li>
            <li>Business losses</li>
            <li>Email deliverability issues</li>
            <li>Any indirect or consequential damages</li>
          </ul>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">9. Account Suspension</h2>
          <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">10. Changes to Terms</h2>
          <p>We may update these Terms &amp; Conditions at any time.</p>
          <p>Changes will be posted on this page with an updated date.</p>

          <hr className="my-10 border-white/15" />

          <h2 className="mt-8 text-xl font-bold tracking-tight text-white sm:text-2xl">11. Contact</h2>
          <p>For any questions regarding these terms, please contact:</p>
          <p>
            <strong className="text-slate-200">Email:</strong>{" "}
            <a href="mailto:support@leadgenor.com">support@leadgenor.com</a>
          </p>

          <hr className="my-10 border-white/15" />

          <p className="pb-2">
            By using LeadGenor, you acknowledge that you have read, understood, and agreed to these Terms &amp;
            Conditions.
          </p>
        </article>
      </main>

      <MarketingFooter />
    </div>
  );
}

