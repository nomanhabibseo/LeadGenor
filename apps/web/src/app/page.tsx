import Link from "next/link";
import Image from "next/image";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const H2 = "text-[30px] leading-tight font-bold tracking-tight text-white";
  const Body = "text-[18px] leading-relaxed text-slate-300";
  const SectionY = "py-12 md:py-14";
  const Divider = () => (
    <div className="my-7 h-px w-full bg-white opacity-20 md:my-9" aria-hidden />
  );
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white dark:bg-black">
      <div className="pointer-events-none fixed inset-0 bg-hero-mesh opacity-90" aria-hidden />
      <MarketingHeader />

      <main className="relative z-10 flex-1">
        <div className="mx-auto max-w-[1200px] px-4">
          {/* SECTION 1 — HERO */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="text-center lg:text-left">
                <div className="mx-auto inline-flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-left text-xs font-medium leading-relaxed text-cyan-200/90 backdrop-blur sm:text-sm lg:mx-0 lg:justify-start">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Manage guest posting vendors &amp; clients → Create targeted campaigns → Automate personalized drip
                    email outreach.
                  </span>
                </div>
                <h1 id="About" className="mt-7 scroll-mt-28 text-[36px] font-bold leading-tight tracking-tight">
                  LeadGenor — The Complete Outreach System for Guest Posting Freelancers
                </h1>
                <p className={cn("mt-5 max-w-2xl lg:mx-0 lg:max-w-xl", Body)}>
                  Stop managing outreach in messy spreadsheets. Manage vendors, clients, emails, and cold outreach
                  campaigns in one powerful platform.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
                  >
                    Start Managing Leads
                    <ArrowRight className="h-4.5 w-4.5" />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
                  >
                    See How It Works
                  </a>
                </div>
                <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-slate-300/90 lg:mx-0 lg:max-w-xl">
                  LeadGenor is built for guest posting freelancers and outreach specialists who want to organize their
                  data, find emails faster, and automate cold email outreach.
                </p>
              </div>

              <div className="mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none">
                <div className="mx-auto w-full max-w-[640px]">
                  <Image
                    src="/landing/hero-dashboard.png"
                    alt="LeadGenor dashboard preview"
                    width={640}
                    height={420}
                    priority
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 2 — PROBLEM */}
          <section id="how-it-works" className={cn(SectionY, "scroll-mt-24")}>
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="order-2 lg:order-1">
                <div className="mx-auto w-full max-w-[640px] lg:mx-0">
                  <Image
                    src="/landing/section2-spreadsheet-vs-leadgenor.png"
                    alt="Messy spreadsheets vs LeadGenor dashboard"
                    width={1024}
                    height={576}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_14px_48px_rgba(0,0,0,0.42)]"
                  />
                </div>
              </div>
              <div className="order-1 text-center lg:order-2 lg:text-left">
                <h2 id="features" className={cn(H2, "scroll-mt-28")}>
                  Guest Posting Freelancers Are Stuck in Spreadsheets
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>Most outreach freelancers manage their data in Google Sheets.</p>
                  <p>But spreadsheets create serious limitations:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Difficult to manage large datasets</li>
                    <li>No advanced filtering system</li>
                    <li>No duplicate URL alerts</li>
                    <li>No automated email finding</li>
                    <li>No outreach automation</li>
                    <li>Data quickly becomes messy and hard to manage</li>
                  </ul>
                  <p>
                    When you are working with hundreds or thousands of websites, managing everything manually becomes
                    exhausting.
                  </p>
                  <p>LeadGenor replaces spreadsheets with a powerful outreach management system.</p>
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 3 — SOLUTION */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Everything You Need to Manage Outreach in One Platform
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>LeadGenor replaces spreadsheets and disconnected tools.</p>
                  <p>With LeadGenor you can:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Organize vendor and client databases</li>
                    <li>Find contact emails instantly</li>
                    <li>Import and manage outreach lists</li>
                    <li>Send personalized cold emails</li>
                    <li>Build automated campaign sequences</li>
                    <li>Track outreach performance and replies</li>
                  </ul>
                  <p>All inside a single dashboard designed for outreach professionals.</p>
                </div>
              </div>
              <div className="mx-auto w-full lg:mx-0">
                <div className="mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section3-workflow.png"
                    alt="LeadGenor outreach workflow"
                    width={1024}
                    height={576}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_14px_48px_rgba(0,0,0,0.42)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 4 — DATA MANAGEMENT */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Manage Vendors, Clients and Websites Without Spreadsheets
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>LeadGenor allows freelancers to organize their entire outreach database.</p>
                  <p>You can store and manage:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Vendor websites</li>
                    <li>Client websites</li>
                    <li>Domain metrics</li>
                    <li>Pricing details</li>
                    <li>Deal status</li>
                    <li>Contact information</li>
                  </ul>
                  <p>Powerful filtering allows you to instantly find the exact websites you need.</p>
                  <p>Additional capabilities include:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Bulk price increase or decrease</li>
                    <li>Advanced filtering based on metrics</li>
                    <li>Duplicate URL detection</li>
                    <li>Organized outreach database</li>
                  </ul>
                </div>
              </div>
              <div className="mx-auto w-full lg:mx-0 lg:justify-self-end">
                <div className="mx-auto w-full max-w-[700px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section4-vendor-db.png"
                    alt="Vendor database management screenshot"
                    width={1200}
                    height={1000}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_16px_54px_rgba(0,0,0,0.44)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 5 — EMAIL FINDER */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <div className="mx-auto w-full max-w-[700px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section5-email-finder.png"
                    alt="Email finder results interface"
                    width={1024}
                    height={576}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_14px_48px_rgba(0,0,0,0.42)]"
                  />
                </div>
              </div>
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Find Website Emails in Seconds
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>Finding contact emails manually can take hours.</p>
                  <p>LeadGenor automatically scans website pages and extracts available email addresses.</p>
                  <p>Simply click Find Email and the system retrieves emails instantly.</p>
                  <p>You can also find emails in bulk for hundreds of websites at once.</p>
                  <p>Perfect for:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Guest posting outreach</li>
                    <li>Blogger outreach</li>
                    <li>Link building</li>
                    <li>Partnerships</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 6 — LIST MANAGEMENT */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Import and Organize Outreach Lists Easily
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>LeadGenor allows you to import and organize outreach lists in seconds.</p>
                  <p>You can import lists using:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>CSV files</li>
                    <li>Google Sheets links</li>
                    <li>Existing LeadGenor database entries</li>
                  </ul>
                  <p>
                    If some websites do not have emails, you can use the bulk email finder to discover them
                    automatically.
                  </p>
                  <p>This allows you to prepare large outreach lists quickly and efficiently.</p>
                </div>
              </div>
              <div className="mx-auto w-full lg:mx-0">
                <div className="mx-auto w-full max-w-[700px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section6-list-import.png"
                    alt="CSV and Google Sheets list import"
                    width={1024}
                    height={576}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_14px_48px_rgba(0,0,0,0.42)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 7 — EMAIL TEMPLATES */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="order-1 text-center lg:order-2 lg:text-left">
                <h2 className={H2}>
                  Create Highly Personalized Outreach Emails
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>Generic outreach emails rarely work.</p>
                  <p>LeadGenor allows you to personalize emails using dynamic variables.</p>
                  <p>You can insert variables such as:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Company Name</li>
                    <li>Website Name</li>
                    <li>Domain Metrics (DR, DA, AS)</li>
                    <li>Traffic</li>
                    <li>Country</li>
                    <li>Client Name</li>
                    <li>Vendor Name</li>
                  </ul>
                  <p className="font-semibold text-white/95">Example:</p>
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-sm text-slate-200">
                      Subject: Collaboration Opportunity for {"{Company Name}"}
                    </p>
                  </div>
                  <p>
                    LeadGenor automatically replaces variables for every prospect, creating personalized emails at
                    scale.
                  </p>
                </div>
              </div>
              <div className="order-2 lg:order-1 lg:justify-self-end">
                <div className="mx-auto w-full max-w-[760px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section7-template-editor.png"
                    alt="Email template editor screenshot"
                    width={1200}
                    height={1000}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_16px_54px_rgba(0,0,0,0.44)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 8 — CAMPAIGN BUILDER */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <div className="mx-auto w-full max-w-[760px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section8-campaign-builder.png"
                    alt="Campaign flow builder interface"
                    width={1200}
                    height={1000}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_16px_54px_rgba(0,0,0,0.44)]"
                  />
                </div>
              </div>
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Build Advanced Outreach Campaign Flows
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>
                    LeadGenor includes a visual campaign builder that allows you to create automated outreach sequences.
                  </p>
                  <p>You can design flows using:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Email steps</li>
                    <li>Delay steps</li>
                    <li>Follow-up sequences</li>
                  </ul>
                  <p>Follow-ups can be triggered based on prospect behavior such as:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Email opened but not replied</li>
                    <li>Email delivered but not opened</li>
                  </ul>
                  <p>
                    Each path can have its own follow-up sequence to improve response rates.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 9 — CAMPAIGN CONTROLS */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Full Control Over Email Sending
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>LeadGenor gives you full control over your outreach campaigns.</p>
                  <p>You can configure:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Daily sending limits</li>
                    <li>Delay between emails</li>
                    <li>Campaign schedules</li>
                    <li>Avoid sending to risky or invalid emails</li>
                    <li>Prevent duplicate outreach</li>
                  </ul>
                  <p>You can pause, resume, or schedule campaigns whenever you want.</p>
                </div>
              </div>
              <div className="mx-auto w-full lg:mx-0">
                <div className="mx-auto w-full max-w-[760px] lg:mx-0 lg:max-w-none">
                  <Image
                    src="/landing/section9-campaign-settings.png"
                    alt="Campaign sending settings"
                    width={1200}
                    height={800}
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_12px_44px_rgba(0,0,0,0.42)]"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 10 — MAILBOX & ANALYTICS */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="order-1 text-center lg:order-2 lg:text-left">
                <h2 className={H2}>
                  Track Replies and Outreach Performance
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>LeadGenor allows you to monitor the performance of your outreach campaigns.</p>
                  <p>Track important metrics such as:</p>
                  <ul className="ml-5 list-disc space-y-2">
                    <li>Emails sent</li>
                    <li>Emails opened</li>
                    <li>Replies received</li>
                    <li>Pending emails</li>
                  </ul>
                  <p>
                    You can also sync your email accounts and read replies directly from the LeadGenor mailbox.
                  </p>
                </div>
              </div>
              <div className="order-2 lg:order-1 lg:justify-self-end">
                <div className="mx-auto w-full max-w-[1200px] lg:mx-0">
                  {/* Border should hug the image (no letterboxing). */}
                  <img
                    src="/landing/section10-mailbox-analytics.png"
                    alt="Mailbox and analytics dashboard"
                    className="h-auto w-full rounded-2xl border border-white/10 shadow-[0_16px_54px_rgba(0,0,0,0.44)]"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </section>

          <Divider />

          {/* SECTION 11 — DASHBOARD INSIGHTS */}
          <section className={SectionY}>
            <div className="text-center">
              <h2 className={cn(H2, "text-center")}>Monitor Your Outreach Performance in Real Time</h2>
              <p className={cn("mx-auto mt-4 max-w-3xl", Body)}>
                The LeadGenor dashboard provides real-time insights into your outreach activity.
              </p>
              <div className={cn("mx-auto mt-5 max-w-3xl text-left", Body)}>
                <p>Track statistics such as:</p>
                <ul className="ml-5 list-disc space-y-2">
                  <li>Running campaigns</li>
                  <li>Scheduled campaigns</li>
                  <li>Completed campaigns</li>
                  <li>Delivery ratio</li>
                  <li>Response rate</li>
                  <li>Revenue and profit</li>
                  <li>Vendors and clients</li>
                  <li>Orders and deals</li>
                </ul>
                <p className="mt-4">
                  Filters allow you to analyze data for different time ranges such as:
                </p>
                <ul className="ml-5 mt-2 list-disc space-y-2">
                  <li>24 hours</li>
                  <li>7 days</li>
                  <li>30 days</li>
                  <li>6 months</li>
                  <li>Lifetime</li>
                </ul>
              </div>
            </div>
            <div className="mt-10">
              <img
                src="/landing/section11-dashboard.png"
                alt="Full dashboard analytics view"
                className="mx-auto h-auto w-full max-w-[1000px] rounded-2xl border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                loading="lazy"
              />
            </div>
          </section>

          <Divider />

          {/* SECTION 12 — DATA SAFETY */}
          <section className={SectionY}>
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <img
                  src="/landing/section12-trash.png"
                  alt="Trash and restore interface"
                  className="mx-auto h-auto w-full max-w-[900px] rounded-2xl border border-white/10 shadow-[0_12px_44px_rgba(0,0,0,0.42)]"
                  loading="lazy"
                />
              </div>
              <div className="text-center lg:text-left">
                <h2 className={H2}>
                  Your Data is Always Safe
                </h2>
                <div className={cn("mt-4 space-y-4", Body)}>
                  <p>Accidentally deleted something?</p>
                  <p>LeadGenor automatically moves deleted items to the Trash.</p>
                  <p>
                    You can restore them anytime within 30 days, ensuring that no important data is permanently lost.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 13 — FAQ */}
          <section className="py-20 md:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className={cn(H2, "text-center")}>FAQ</h2>
              <p className={cn("mt-4", Body)}>Quick answers to common questions.</p>
            </div>

            <div className="mx-auto mt-10 max-w-3xl divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_14px_48px_rgba(0,0,0,0.42)] backdrop-blur-sm">
              {[
                {
                  q: "Who is LeadGenor built for?",
                  a: "LeadGenor is designed for guest posting freelancers, outreach specialists, and agencies managing large outreach databases.",
                },
                {
                  q: "Can I import data from Google Sheets?",
                  a: "Yes. LeadGenor allows you to import outreach lists using CSV files or Google Sheets links.",
                },
                {
                  q: "Does LeadGenor support email personalization?",
                  a: "Yes. You can personalize every email using dynamic variables.",
                },
                {
                  q: "Can I automate follow-up emails?",
                  a: "Yes. LeadGenor allows you to build automated follow-up sequences based on prospect behavior.",
                },
              ].map((item, i) => (
                <details key={i} className="group px-6 py-5 text-left">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                    <span>{item.q}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-slate-300 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
