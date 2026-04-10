-- CreateEnum
CREATE TYPE "InvestmentHorizon" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_portfolioId_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "recommendedHorizon" "InvestmentHorizon";

-- AlterTable
ALTER TABLE "AssetClass" ADD COLUMN     "recommendedHorizonBase" "InvestmentHorizon";

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
