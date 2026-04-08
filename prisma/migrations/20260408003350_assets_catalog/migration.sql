-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('STOCK', 'FII', 'ETF', 'FIXED_INCOME', 'FUND', 'CRYPTO', 'METAL', 'REAL_ESTATE', 'CASH');

-- CreateTable
CREATE TABLE "AssetClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "isin" TEXT,
    "cnpj" TEXT,
    "category" "AssetCategory" NOT NULL,
    "assetClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetClass_code_key" ON "AssetClass"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_ticker_key" ON "Asset"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_isin_key" ON "Asset"("isin");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_cnpj_key" ON "Asset"("cnpj");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assetClassId_fkey" FOREIGN KEY ("assetClassId") REFERENCES "AssetClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
