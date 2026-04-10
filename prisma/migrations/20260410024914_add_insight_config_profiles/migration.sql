-- CreateEnum
CREATE TYPE "InsightProfileScope" AS ENUM ('GLOBAL', 'USER', 'CLIENT', 'PORTFOLIO');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "insightConfigProfileId" TEXT;

-- AlterTable
ALTER TABLE "Portfolio" ADD COLUMN     "insightConfigProfileId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "insightConfigProfileId" TEXT;

-- CreateTable
CREATE TABLE "InsightType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultThreshold" DECIMAL(6,4) NOT NULL,
    "defaultSeverity" "InsightSeverity" NOT NULL DEFAULT 'WARNING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightConfigProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "InsightProfileScope" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightConfigProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightConfigRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "insightTypeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdOverride" DECIMAL(6,4),
    "severityOverride" "InsightSeverity",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsightConfigRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsightType_code_key" ON "InsightType"("code");

-- CreateIndex
CREATE INDEX "InsightConfigProfile_scope_ownerUserId_idx" ON "InsightConfigProfile"("scope", "ownerUserId");

-- CreateIndex
CREATE INDEX "InsightConfigRule_insightTypeId_idx" ON "InsightConfigRule"("insightTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "InsightConfigRule_profileId_insightTypeId_key" ON "InsightConfigRule"("profileId", "insightTypeId");

-- CreateIndex
CREATE INDEX "Client_insightConfigProfileId_idx" ON "Client"("insightConfigProfileId");

-- CreateIndex
CREATE INDEX "Portfolio_insightConfigProfileId_idx" ON "Portfolio"("insightConfigProfileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_insightConfigProfileId_fkey" FOREIGN KEY ("insightConfigProfileId") REFERENCES "InsightConfigProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_insightConfigProfileId_fkey" FOREIGN KEY ("insightConfigProfileId") REFERENCES "InsightConfigProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_insightConfigProfileId_fkey" FOREIGN KEY ("insightConfigProfileId") REFERENCES "InsightConfigProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightConfigProfile" ADD CONSTRAINT "InsightConfigProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightConfigRule" ADD CONSTRAINT "InsightConfigRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "InsightConfigProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightConfigRule" ADD CONSTRAINT "InsightConfigRule_insightTypeId_fkey" FOREIGN KEY ("insightTypeId") REFERENCES "InsightType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
