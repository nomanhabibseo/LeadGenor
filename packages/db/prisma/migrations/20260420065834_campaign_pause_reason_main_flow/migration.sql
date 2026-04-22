-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "mainFlowGraph" JSONB,
ADD COLUMN     "pauseReason" TEXT;
