-- CreateTable
CREATE TABLE "CampaignSendLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignSendLog_userId_campaignId_sentAt_idx" ON "CampaignSendLog"("userId", "campaignId", "sentAt");

-- CreateIndex
CREATE INDEX "CampaignSendLog_campaignId_emailAccountId_idx" ON "CampaignSendLog"("campaignId", "emailAccountId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CampaignSendLog" ADD CONSTRAINT "CampaignSendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSendLog" ADD CONSTRAINT "CampaignSendLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSendLog" ADD CONSTRAINT "CampaignSendLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSendLog" ADD CONSTRAINT "CampaignSendLog_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
