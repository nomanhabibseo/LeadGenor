-- CreateEnum
CREATE TYPE "SendConflictPriority" AS ENUM ('MAIN_FIRST', 'FOLLOWUP_FIRST');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "sendConflictPriority" "SendConflictPriority" NOT NULL DEFAULT 'MAIN_FIRST';

-- AlterTable
ALTER TABLE "CampaignRecipient" ADD COLUMN "mainStepIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignRecipient" ADD COLUMN "nextMainSendAt" TIMESTAMP(3);
ALTER TABLE "CampaignRecipient" ADD COLUMN "followupPhase" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "CampaignRecipient" ADD COLUMN "followupStepIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignRecipient" ADD COLUMN "nextFollowupSendAt" TIMESTAMP(3);

-- Backfill parallel scheduling from legacy single-track fields
UPDATE "CampaignRecipient" SET
  "mainStepIndex" = "stepIndex",
  "nextMainSendAt" = CASE WHEN phase = 'main' THEN "nextSendAt" ELSE NULL END,
  "followupPhase" = CASE
    WHEN phase = 'followup_wait' THEN 'wait'
    WHEN phase = 'followup' THEN 'active'
    ELSE 'idle'
  END,
  "followupStepIndex" = CASE WHEN phase = 'followup' THEN "stepIndex" ELSE 0 END,
  "nextFollowupSendAt" = CASE
    WHEN phase IN ('followup_wait', 'followup') THEN "nextSendAt"
    ELSE NULL
  END
WHERE true;

-- Indexes for send tick queries
CREATE INDEX "CampaignRecipient_campaignId_nextMainSendAt_status_idx" ON "CampaignRecipient"("campaignId", "nextMainSendAt", "status");
CREATE INDEX "CampaignRecipient_campaignId_nextFollowupSendAt_status_idx" ON "CampaignRecipient"("campaignId", "nextFollowupSendAt", "status");
