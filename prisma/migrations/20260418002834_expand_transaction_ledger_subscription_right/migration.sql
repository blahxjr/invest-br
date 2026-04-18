-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'EXERCISED', 'EXPIRED', 'TRANSFERRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'CUSTODY_TRANSFER';
ALTER TYPE "TransactionType" ADD VALUE 'SUBSCRIPTION_RIGHT';
ALTER TYPE "TransactionType" ADD VALUE 'SUBSCRIPTION_EXPIRED';
ALTER TYPE "TransactionType" ADD VALUE 'RIGHTS_TRANSFER';
ALTER TYPE "TransactionType" ADD VALUE 'RIGHTS_TRANSFER_PENDING';
ALTER TYPE "TransactionType" ADD VALUE 'CORPORATE_UPDATE';
ALTER TYPE "TransactionType" ADD VALUE 'MATURITY';
ALTER TYPE "TransactionType" ADD VALUE 'SPLIT';
ALTER TYPE "TransactionType" ADD VALUE 'BONUS_SHARES';
ALTER TYPE "TransactionType" ADD VALUE 'FRACTIONAL_DEBIT';
ALTER TYPE "TransactionType" ADD VALUE 'FRACTIONAL_AUCTION';

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isIncoming" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "movementType" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isTaxExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originAccountId" TEXT,
ADD COLUMN     "sourceMovementType" TEXT,
ADD COLUMN     "subscriptionDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionRight" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "subscriptionPrice" DECIMAL(18,8),
    "deadline" TIMESTAMP(3),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "exercisedQty" DECIMAL(18,8),
    "expirationTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionRight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionRight_transactionId_idx" ON "SubscriptionRight"("transactionId");

-- CreateIndex
CREATE INDEX "SubscriptionRight_assetId_idx" ON "SubscriptionRight"("assetId");

-- CreateIndex
CREATE INDEX "SubscriptionRight_status_idx" ON "SubscriptionRight"("status");

-- CreateIndex
CREATE INDEX "Transaction_originAccountId_idx" ON "Transaction"("originAccountId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_originAccountId_fkey" FOREIGN KEY ("originAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionRight" ADD CONSTRAINT "SubscriptionRight_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionRight" ADD CONSTRAINT "SubscriptionRight_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
