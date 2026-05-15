/** Guest-post / blogging niches for vendor & client tagging (slug must stay stable after first seed). */

const NICHE_LABELS = `
Business
Marketing
Digital Marketing
SEO
Affiliate Marketing
E-commerce
Dropshipping
Amazon
Shopify
Retail
Startups
Entrepreneurship
SaaS
Technology
Information Technology
Software
Software Development
App Development
Web Development
Web Design
Web Hosting
Artificial Intelligence
Machine Learning
Cyber Security
Blockchain
Cloud Computing
Mobile Apps
Finance
Investment
Stock Market
Cryptocurrency
Forex Trading
Banking
Insurance
Accounting
Taxation
Fintech
Health
Fitness
Wellness
Medical
Mental Health
Skincare
Beauty
Dental Care
Nutrition
Education
Online Education
Higher Education
Career
Skills Development
Study Abroad
Training
Language Learning
Lifestyle
Self Improvement
Productivity
Motivation
Relationships
Parenting
Family
Spirituality
Men's Lifestyle
Women's Lifestyle
Travel
Tourism
Hotels
Aviation
Visa Services
Immigration
Food & Beverage
Cooking & Recipes
Restaurants
Hospitality
Catering
Real Estate
Construction
Architecture
Interior Design
Property
Automotive
Electric Vehicles
Transportation
Logistics
Supply Chain
Manufacturing
Fashion
Jewelry
Luxury Goods
Cosmetics
Entertainment
Gaming
Media
Sports
Music
Movies
Photography
Art
Design
Environment
Renewable Energy
Agriculture
Wildlife
Pets
Law
Government
NGOs
Non Profit
`
  .trim()
  .split(/\n/)
  .map((l) => l.trim())
  .filter(Boolean);

function allocSlug(label: string, used: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "niche";
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n++}`;
  }
  used.add(slug);
  return slug;
}

const usedSlugs = new Set<string>();

export const SEED_NICHES: { slug: string; label: string; sortOrder: number }[] = NICHE_LABELS.map(
  (label, i) => ({
    slug: allocSlug(label, usedSlugs),
    label,
    sortOrder: i,
  }),
);
