/** Matches backend `subscription.constants` limits — keep in sync when tiers change. */

export const PLAN_PRICE_USD = {
  PRO: "12.99",
  BUSINESS: "29.99",
} as const;

export type PricingPlanId = "FREE" | "PRO" | "BUSINESS";

export type PricingPlanCard = {
  id: PricingPlanId;
  title: string;
  subtitle: string;
  priceLabel: string;
  priceNote?: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  emphasized?: boolean;
};

export const PRICING_PLANS: PricingPlanCard[] = [
  {
    id: "FREE",
    title: "Free",
    subtitle: "Start with core CRM and capped outreach tools.",
    priceLabel: "$0",
    priceNote: "Always free",
    bullets: [
      "Vendors, clients & orders — unlimited",
      "My lists: 1 new list/month, up to 100 new prospects added/month (UTC)",
      "Templates: 1 folder, up to 4 templates",
      "Email accounts: up to 2 lifetime",
      "Campaigns: 1 new draft/month; list up to 100 prospects per campaign",
      "Sequence: up to 2 main email steps + 1 follow-up; up to 2 sender accounts per campaign",
      "Sending: up to 100 campaign emails sent/month (UTC)",
      "Email finder: up to 30 unique sites/month",
      "Mailbox sync: up to 2 sync operations/month",
      "Campaign opened/replied stats hidden (upgrade to unlock)",
    ],
    ctaLabel: "Create free account",
    ctaHref: "/register",
  },
  {
    id: "PRO",
    title: "Pro",
    subtitle: "Higher limits for serious outbound.",
    priceLabel: `$${PLAN_PRICE_USD.PRO}`,
    priceNote: "per month",
    emphasized: true,
    bullets: [
      "Everything in Free for vendors, clients & orders",
      "My lists & prospects: unlimited additions",
      "Templates & folders: unlimited",
      "Email accounts: unlimited",
      "Campaigns: unlimited drafts & larger lists",
      "Sending: up to 15,000 emails/month (UTC)",
      "Email finder: up to 3,000 unique sites/month",
      "Mailbox sync: unlimited",
      "Full engagement stats (opens, replies, reporting)",
    ],
    ctaLabel: "Choose Pro (manual payment)",
    ctaHref: "/onboarding/plan",
  },
  {
    id: "BUSINESS",
    title: "Business",
    subtitle: "No monthly caps on outreach quotas.",
    priceLabel: `$${PLAN_PRICE_USD.BUSINESS}`,
    priceNote: "per month",
    bullets: [
      "Everything in Pro",
      "Unlimited lists, prospects, templates, folders & accounts",
      "Unlimited campaign sends & email finder (within fair use of the product)",
      "Full reporting & engagement analytics",
      "Manual activation after payment — same login, no new account",
    ],
    ctaLabel: "Choose Business (manual payment)",
    ctaHref: "/onboarding/plan",
  },
];
