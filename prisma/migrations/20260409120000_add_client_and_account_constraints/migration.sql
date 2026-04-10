-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add clientId column as nullable first for backfill
ALTER TABLE "Account" ADD COLUMN "clientId" TEXT;

-- Create one client per user that already owns portfolios/accounts
INSERT INTO "Client" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT
  'cli_' || substr(md5(u."id" || clock_timestamp()::text), 1, 24),
  u."id",
  COALESCE(NULLIF(u."name", ''), split_part(u."email", '@', 1), 'Cliente principal'),
  NOW(),
  NOW()
FROM "User" u
WHERE EXISTS (
  SELECT 1
  FROM "Portfolio" p
  INNER JOIN "Account" a ON a."portfolioId" = p."id"
  WHERE p."userId" = u."id"
);

-- Link accounts to a client via portfolio.owner user
UPDATE "Account" a
SET "clientId" = c."id"
FROM "Portfolio" p
INNER JOIN "Client" c ON c."userId" = p."userId"
WHERE a."portfolioId" = p."id"
  AND a."clientId" IS NULL;

-- Ensure there is a fallback institution for accounts without institution
INSERT INTO "Institution" ("id", "name", "type", "createdAt")
SELECT
  'inst_' || substr(md5(clock_timestamp()::text), 1, 24),
  'Instituição não informada (migração)',
  'OTHER',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Institution" WHERE "name" = 'Instituição não informada (migração)'
);

-- Backfill institutionId on existing accounts
UPDATE "Account"
SET "institutionId" = (
  SELECT "id"
  FROM "Institution"
  WHERE "name" = 'Instituição não informada (migração)'
  LIMIT 1
)
WHERE "institutionId" IS NULL;

-- Required/optional semantics requested by subtask
ALTER TABLE "Account" ALTER COLUMN "portfolioId" DROP NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "Account" ALTER COLUMN "clientId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
