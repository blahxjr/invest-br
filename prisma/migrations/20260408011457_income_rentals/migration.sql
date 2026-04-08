-- CreateEnum
CREATE TYPE "IncomeType" AS ENUM ('DIVIDEND', 'JCP', 'FII_RENT', 'COUPON', 'RENTAL');

-- CreateTable
CREATE TABLE "IncomeEvent" (
    "id" TEXT NOT NULL,
    "type" "IncomeType" NOT NULL,
    "transactionId" TEXT,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncomeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalReceipt" (
    "id" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "grossRent" DECIMAL(18,2) NOT NULL,
    "expenses" DECIMAL(18,2),
    "netRent" DECIMAL(18,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalReceipt_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IncomeEvent" ADD CONSTRAINT "IncomeEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEvent" ADD CONSTRAINT "IncomeEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeEvent" ADD CONSTRAINT "IncomeEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReceipt" ADD CONSTRAINT "RentalReceipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
