-- CreateEnum
CREATE TYPE "SeoLinkAttribute" AS ENUM ('DO_FOLLOW', 'NO_FOLLOW', 'SPONSORED');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "seoLinkAttribute" "SeoLinkAttribute" NOT NULL DEFAULT 'DO_FOLLOW',
ADD COLUMN     "seoLinkQuantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "seoLinkAttribute" "SeoLinkAttribute" NOT NULL DEFAULT 'DO_FOLLOW',
ADD COLUMN     "seoLinkQuantity" INTEGER NOT NULL DEFAULT 1;
