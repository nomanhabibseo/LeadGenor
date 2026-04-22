-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "connectionVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "connectionInvalid" BOOLEAN NOT NULL DEFAULT false;
