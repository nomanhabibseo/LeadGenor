-- AlterTable
ALTER TABLE "InboxMessage" ADD COLUMN "externalMessageId" TEXT,
ADD COLUMN "folder" TEXT NOT NULL DEFAULT 'inbox';

-- DropIndex (replaced by composite index)
DROP INDEX IF EXISTS "InboxMessage_userId_receivedAt_idx";

-- CreateIndex
CREATE INDEX "InboxMessage_userId_emailAccountId_folder_receivedAt_idx" ON "InboxMessage"("userId", "emailAccountId", "folder", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxMessage_emailAccountId_externalMessageId_key" ON "InboxMessage"("emailAccountId", "externalMessageId");
