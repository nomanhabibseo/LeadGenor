-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planChosenAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "SubscriptionUsageMonth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ym" TEXT NOT NULL,
    "listsCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "prospectsAddedCount" INTEGER NOT NULL DEFAULT 0,
    "campaignsCreatedCount" INTEGER NOT NULL DEFAULT 0,
    "mailboxSyncCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubscriptionUsageMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailFinderUsageUrl" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ym" TEXT NOT NULL,
    "urlNorm" TEXT NOT NULL,

    CONSTRAINT "EmailFinderUsageUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxSyncUsage" (
    "userId" TEXT NOT NULL,
    "ym" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MailboxSyncUsage_pkey" PRIMARY KEY ("userId","ym")
);

-- CreateIndex
CREATE INDEX "SubscriptionUsageMonth_userId_ym_idx" ON "SubscriptionUsageMonth"("userId", "ym");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionUsageMonth_userId_ym_key" ON "SubscriptionUsageMonth"("userId", "ym");

-- CreateIndex
CREATE INDEX "EmailFinderUsageUrl_userId_ym_idx" ON "EmailFinderUsageUrl"("userId", "ym");

-- CreateIndex
CREATE UNIQUE INDEX "EmailFinderUsageUrl_userId_ym_urlNorm_key" ON "EmailFinderUsageUrl"("userId", "ym", "urlNorm");

-- AddForeignKey
ALTER TABLE "SubscriptionUsageMonth" ADD CONSTRAINT "SubscriptionUsageMonth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailFinderUsageUrl" ADD CONSTRAINT "EmailFinderUsageUrl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxSyncUsage" ADD CONSTRAINT "MailboxSyncUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing users skip plan onboarding
UPDATE "User" SET "planChosenAt" = "createdAt" WHERE "planChosenAt" IS NULL;
