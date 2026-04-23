/*
  Warnings:

  - A unique constraint covering the columns `[clientId,institutionId,name]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clientId,institutionId,brokerAccountNumber]` on the table `Account` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Portfolio" DROP CONSTRAINT "Portfolio_userId_fkey";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "brokerAccountNumber" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "emissionDate" DATE,
ADD COLUMN     "fixedRate" DECIMAL(10,6),
ADD COLUMN     "indexer" TEXT,
ADD COLUMN     "maturityDate" DATE,
ADD COLUMN     "subtype" TEXT;

-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "clientId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "avgCost" DECIMAL(18,8) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPrice" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "AssetPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_accountId_assetId_key" ON "Position"("accountId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPrice_assetId_date_key" ON "AssetPrice"("assetId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clientId_institutionId_name_key" ON "Account"("clientId", "institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clientId_institutionId_brokerAccountNumber_key" ON "Account"("clientId", "institutionId", "brokerAccountNumber");

-- CreateIndex
CREATE INDEX "Portfolio_clientId_idx" ON "Portfolio"("clientId");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPrice" ADD CONSTRAINT "AssetPrice_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
