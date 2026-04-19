-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TatUnit" AS ENUM ('HOURS', 'DAYS');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('DEAL_DONE', 'PENDING');

-- CreateEnum
CREATE TYPE "PaymentTerms" AS ENUM ('ADVANCE', 'AFTER_LIVE_LINK');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('GUEST_POST', 'NICHE_EDIT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('COMPLETED', 'PENDING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "trashRetentionDays" INTEGER NOT NULL DEFAULT 28,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTermAfterLiveOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentTermAfterLiveOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "siteUrlNormalized" TEXT NOT NULL,
    "traffic" INTEGER NOT NULL DEFAULT 0,
    "dr" INTEGER NOT NULL DEFAULT 0,
    "mozDa" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" INTEGER NOT NULL DEFAULT 0,
    "referringDomains" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "trustFlow" INTEGER NOT NULL DEFAULT 0,
    "tatUnit" "TatUnit" NOT NULL,
    "tatValue" INTEGER NOT NULL,
    "currencyId" TEXT NOT NULL,
    "guestPostCost" DECIMAL(18,4) NOT NULL,
    "nicheEditCost" DECIMAL(18,4) NOT NULL,
    "guestPostPrice" DECIMAL(18,4) NOT NULL,
    "nicheEditPrice" DECIMAL(18,4) NOT NULL,
    "paymentTerms" "PaymentTerms" NOT NULL,
    "afterLiveOptionId" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPageUrl" TEXT,
    "dealStatus" "DealStatus" NOT NULL,
    "recordDate" TIMESTAMP(3),
    "notes" TEXT,
    "languageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorNiche" (
    "vendorId" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,

    CONSTRAINT "VendorNiche_pkey" PRIMARY KEY ("vendorId","nicheId")
);

-- CreateTable
CREATE TABLE "VendorCountry" (
    "vendorId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "VendorCountry_pkey" PRIMARY KEY ("vendorId","countryId")
);

-- CreateTable
CREATE TABLE "VendorPaymentMethod" (
    "vendorId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,

    CONSTRAINT "VendorPaymentMethod_pkey" PRIMARY KEY ("vendorId","paymentMethodId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "siteUrlNormalized" TEXT NOT NULL,
    "traffic" INTEGER NOT NULL DEFAULT 0,
    "dr" INTEGER NOT NULL DEFAULT 0,
    "mozDa" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" INTEGER NOT NULL DEFAULT 0,
    "referringDomains" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "languageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientNiche" (
    "clientId" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,

    CONSTRAINT "ClientNiche_pkey" PRIMARY KEY ("clientId","nicheId")
);

-- CreateTable
CREATE TABLE "ClientCountry" (
    "clientId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "ClientCountry_pkey" PRIMARY KEY ("clientId","countryId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "resellerPrice" DECIMAL(18,4) NOT NULL,
    "vendorCost" DECIMAL(18,4) NOT NULL,
    "articleWriting" BOOLEAN NOT NULL DEFAULT false,
    "articleWritingFeeUsd" DECIMAL(18,4),
    "totalPayment" DECIMAL(18,4) NOT NULL,
    "paymentTerms" "PaymentTerms" NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "paymentMethodNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "usdPerUnit" DECIMAL(18,8) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_slug_key" ON "PaymentMethod"("slug");

-- CreateIndex
CREATE INDEX "Vendor_userId_siteUrlNormalized_idx" ON "Vendor"("userId", "siteUrlNormalized");

-- CreateIndex
CREATE INDEX "Vendor_userId_dealStatus_idx" ON "Vendor"("userId", "dealStatus");

-- CreateIndex
CREATE INDEX "Vendor_userId_deletedAt_idx" ON "Vendor"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Client_userId_siteUrlNormalized_idx" ON "Client"("userId", "siteUrlNormalized");

-- CreateIndex
CREATE INDEX "Client_userId_deletedAt_idx" ON "Client"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_userId_status_orderDate_idx" ON "Order"("userId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "Order_userId_deletedAt_idx" ON "Order"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_vendorId_idx" ON "Order"("vendorId");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "ExchangeRate_date_idx" ON "ExchangeRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currencyId_date_key" ON "ExchangeRate"("currencyId", "date");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_afterLiveOptionId_fkey" FOREIGN KEY ("afterLiveOptionId") REFERENCES "PaymentTermAfterLiveOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorNiche" ADD CONSTRAINT "VendorNiche_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorNiche" ADD CONSTRAINT "VendorNiche_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCountry" ADD CONSTRAINT "VendorCountry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCountry" ADD CONSTRAINT "VendorCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentMethod" ADD CONSTRAINT "VendorPaymentMethod_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentMethod" ADD CONSTRAINT "VendorPaymentMethod_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNiche" ADD CONSTRAINT "ClientNiche_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNiche" ADD CONSTRAINT "ClientNiche_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCountry" ADD CONSTRAINT "ClientCountry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCountry" ADD CONSTRAINT "ClientCountry_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
