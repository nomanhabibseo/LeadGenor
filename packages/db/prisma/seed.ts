import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_COUNTRIES } from "./seed-countries";
import { SEED_LANGUAGES } from "./seed-languages";
import { SEED_NICHES } from "./seed-niches";

const prisma = new PrismaClient();

async function main() {
  const currencies = [
    { code: "USD", symbol: "$", name: "US Dollar", sortOrder: 1 },
    { code: "PKR", symbol: "Rs", name: "Pakistani Rupee", sortOrder: 2 },
    { code: "EUR", symbol: "€", name: "Euro", sortOrder: 3 },
    { code: "GBP", symbol: "£", name: "British Pound", sortOrder: 4 },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  for (const n of SEED_NICHES) {
    await prisma.niche.upsert({
      where: { slug: n.slug },
      update: { label: n.label, sortOrder: n.sortOrder },
      create: n,
    });
  }

  for (const c of SEED_COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { code: c.code, name: c.name, sortOrder: c.sortOrder },
    });
  }

  for (const l of SEED_LANGUAGES) {
    await prisma.language.upsert({
      where: { code: l.code },
      update: { name: l.name, sortOrder: l.sortOrder },
      create: { code: l.code, name: l.name, sortOrder: l.sortOrder },
    });
  }

  const methods = [
    { slug: "payoneer", label: "Payoneer", sortOrder: 1 },
    { slug: "paypal", label: "PayPal", sortOrder: 2 },
    { slug: "wise", label: "Wise", sortOrder: 3 },
    { slug: "stripe", label: "Stripe", sortOrder: 4 },
    { slug: "skrill", label: "Skrill", sortOrder: 5 },
    { slug: "revolut", label: "Revolut", sortOrder: 6 },
    { slug: "bank-transfer", label: "Bank transfer", sortOrder: 7 },
    { slug: "crypto", label: "Crypto (USDT)", sortOrder: 8 },
  ];
  for (const m of methods) {
    await prisma.paymentMethod.upsert({
      where: { slug: m.slug },
      update: {},
      create: m,
    });
  }

  const afterLive = [
    "In 12 Hours",
    "In 24 Hours",
    "In 36 Hours",
    "In 48 Hours",
    "In 3 Days",
    "In 4 Days",
    "In 5 Days",
    "In 6 Days",
    "In 7 Days",
    "In 14 Days",
    "In 30 Days",
  ];
  for (let i = 0; i < afterLive.length; i++) {
    const label = afterLive[i];
    const existing = await prisma.paymentTermAfterLiveOption.findFirst({
      where: { label },
    });
    if (!existing) {
      await prisma.paymentTermAfterLiveOption.create({
        data: { label, sortOrder: i },
      });
    }
  }

  const demoEmail = "demo@leadgenor.local";
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      passwordHash,
      name: "Demo User",
      trashRetentionDays: 28,
    },
  });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const allCurrencies = await prisma.currency.findMany();
  const approx: Record<string, number> = {
    USD: 1,
    EUR: 1.08,
    GBP: 1.27,
    PKR: 0.0036,
  };
  for (const c of allCurrencies) {
    const usdPer = approx[c.code] ?? 1;
    await prisma.exchangeRate.upsert({
      where: { currencyId_date: { currencyId: c.id, date: today } },
      update: { usdPerUnit: usdPer },
      create: { currencyId: c.id, date: today, usdPerUnit: usdPer },
    });
  }
}

main()
  .then(async () => {
    console.log("Seed finished OK (currencies, niches, countries, languages, reference data, demo user).");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
