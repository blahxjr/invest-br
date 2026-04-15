-- CreateTable
CREATE TABLE "AllocationTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "targetPct" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AllocationTarget_userId_idx" ON "AllocationTarget"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationTarget_userId_assetClass_key" ON "AllocationTarget"("userId", "assetClass");

-- AddForeignKey
ALTER TABLE "AllocationTarget" ADD CONSTRAINT "AllocationTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
