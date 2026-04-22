-- CreateEnum
CREATE TYPE "EmailListAutoUpdate" AS ENUM ('OFF', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ListContactKind" AS ENUM ('VENDOR', 'CLIENT', 'IMPORT');

-- CreateEnum
CREATE TYPE "EmailRiskLevel" AS ENUM ('UNKNOWN', 'UNVERIFIED', 'RISKY', 'INVALID', 'OK');

-- CreateEnum
CREATE TYPE "EmailAccountProvider" AS ENUM ('SMTP', 'GMAIL_API', 'GMAIL_SMTP', 'OUTLOOK', 'OTHER');

-- CreateEnum
CREATE TYPE "SmtpEncryption" AS ENUM ('SSL', 'TLS', 'NONE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'UNSUBSCRIBED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MultiEmailPolicy" AS ENUM ('ALL', 'FIRST');

-- CreateEnum
CREATE TYPE "MissingVariablePolicy" AS ENUM ('TO_CHECK_LIST', 'SEND_ANYWAY');

-- CreateTable
CREATE TABLE "EmailList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "autoUpdate" "EmailListAutoUpdate" NOT NULL DEFAULT 'OFF',
    "lastAutoUpdateAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "siteUrlNormalized" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactKind" "ListContactKind" NOT NULL DEFAULT 'IMPORT',
    "niche" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "traffic" INTEGER NOT NULL DEFAULT 0,
    "dr" INTEGER NOT NULL DEFAULT 0,
    "da" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "referringDomains" INTEGER NOT NULL DEFAULT 0,
    "emails" JSONB NOT NULL DEFAULT '[]',
    "emailRisk" "EmailRiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TemplateFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "includeUnsubscribeBlock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailAccountProvider" NOT NULL DEFAULT 'SMTP',
    "displayName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPasswordEnc" TEXT,
    "smtpEncryption" "SmtpEncryption" NOT NULL DEFAULT 'TLS',
    "oauthRefreshEnc" TEXT,
    "oauthAccessEnc" TEXT,
    "oauthExpiresAt" TIMESTAMP(3),
    "externalProviderId" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 10,
    "delayMinSec" INTEGER NOT NULL DEFAULT 200,
    "delayMaxSec" INTEGER NOT NULL DEFAULT 200,
    "signature" TEXT NOT NULL DEFAULT '',
    "bcc" TEXT NOT NULL DEFAULT '',
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "sentTodayDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailListId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "wizardStep" INTEGER NOT NULL DEFAULT 1,
    "senderAccountIds" JSONB NOT NULL DEFAULT '[]',
    "doNotSendUnverified" BOOLEAN NOT NULL DEFAULT false,
    "doNotSendRisky" BOOLEAN NOT NULL DEFAULT false,
    "doNotSendInvalid" BOOLEAN NOT NULL DEFAULT false,
    "multiEmailPolicy" "MultiEmailPolicy" NOT NULL DEFAULT 'FIRST',
    "skipIfInOtherCampaign" BOOLEAN NOT NULL DEFAULT false,
    "missingVariablePolicy" "MissingVariablePolicy" NOT NULL DEFAULT 'TO_CHECK_LIST',
    "mainSequence" JSONB NOT NULL DEFAULT '[]',
    "followUpSequence" JSONB NOT NULL DEFAULT '[]',
    "followUpStartRule" JSONB,
    "stopFollowUpsOnReply" BOOLEAN NOT NULL DEFAULT true,
    "stopCampaignOnCompanyReply" BOOLEAN NOT NULL DEFAULT true,
    "dailyCampaignLimit" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "checkListEntries" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "emailListItemId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'main',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "failReason" TEXT,
    "targetEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOpenEvent" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOpenEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNorm" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'unsubscribe',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsubscribeToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNorm" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAccountId" TEXT,
    "externalThreadId" TEXT,
    "snippet" TEXT NOT NULL DEFAULT '',
    "fromAddr" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT,
    "bodyPreview" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailList_userId_deletedAt_idx" ON "EmailList"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailList_userId_name_key" ON "EmailList"("userId", "name");

-- CreateIndex
CREATE INDEX "EmailListItem_listId_siteUrlNormalized_idx" ON "EmailListItem"("listId", "siteUrlNormalized");

-- CreateIndex
CREATE INDEX "TemplateFolder_userId_deletedAt_idx" ON "TemplateFolder"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "EmailTemplate_folderId_deletedAt_idx" ON "EmailTemplate"("folderId", "deletedAt");

-- CreateIndex
CREATE INDEX "EmailTemplate_userId_deletedAt_idx" ON "EmailTemplate"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "EmailAccount_userId_deletedAt_idx" ON "EmailAccount"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_userId_tag_key" ON "EmailAccount"("userId", "tag");

-- CreateIndex
CREATE INDEX "Campaign_userId_status_idx" ON "Campaign"("userId", "status");

-- CreateIndex
CREATE INDEX "Campaign_emailListId_idx" ON "Campaign"("emailListId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_emailListItemId_idx" ON "CampaignRecipient"("campaignId", "emailListItemId");

-- CreateIndex
CREATE INDEX "CampaignRecipient_campaignId_nextSendAt_status_idx" ON "CampaignRecipient"("campaignId", "nextSendAt", "status");

-- CreateIndex
CREATE INDEX "EmailOpenEvent_recipientId_idx" ON "EmailOpenEvent"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_userId_emailNorm_key" ON "EmailSuppression"("userId", "emailNorm");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribeToken_token_key" ON "UnsubscribeToken"("token");

-- CreateIndex
CREATE INDEX "UnsubscribeToken_userId_idx" ON "UnsubscribeToken"("userId");

-- CreateIndex
CREATE INDEX "InboxMessage_userId_receivedAt_idx" ON "InboxMessage"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- AddForeignKey
ALTER TABLE "EmailList" ADD CONSTRAINT "EmailList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailListItem" ADD CONSTRAINT "EmailListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "EmailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFolder" ADD CONSTRAINT "TemplateFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "TemplateFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_emailListId_fkey" FOREIGN KEY ("emailListId") REFERENCES "EmailList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecipient" ADD CONSTRAINT "CampaignRecipient_emailListItemId_fkey" FOREIGN KEY ("emailListItemId") REFERENCES "EmailListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailOpenEvent" ADD CONSTRAINT "EmailOpenEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
