-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "imapEncryption" "SmtpEncryption" NOT NULL DEFAULT 'TLS',
ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPasswordEnc" TEXT,
ADD COLUMN     "imapPort" INTEGER,
ADD COLUMN     "imapUser" TEXT;

-- CreateTable
CREATE TABLE "EmailOAuthPending" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessExpiresAt" TIMESTAMP(3),
    "candidates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOAuthPending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOAuthPending_userId_idx" ON "EmailOAuthPending"("userId");

-- CreateIndex
CREATE INDEX "EmailOAuthPending_expiresAt_idx" ON "EmailOAuthPending"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailOAuthPending" ADD CONSTRAINT "EmailOAuthPending_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
