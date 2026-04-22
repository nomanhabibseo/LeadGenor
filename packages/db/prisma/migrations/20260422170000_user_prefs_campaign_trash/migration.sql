-- AlterTable
ALTER TABLE "User" ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD COLUMN "trashToggles" JSONB;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Campaign_userId_deletedAt_idx" ON "Campaign"("userId", "deletedAt");
