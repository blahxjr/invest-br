#!/usr/bin/env tsx

import { config } from 'dotenv'

config({ path: '.env.local', override: true })
config({ path: '.env' })

import { prisma } from '../src/lib/prisma'
import { getCanonicalAssetClassMeta, getCanonicalAssetClassKey, normalizeInstitutionName } from '../src/modules/b3/normalization'

type InstitutionRecord = {
  id: string
  name: string
  createdAt: Date
  accounts: Array<{ id: string }>
}

type AssetClassRecord = {
  id: string
  code: string | null
  name: string
  description: string | null
  createdAt: Date
  _count: { assets: number }
}

function chooseCanonicalInstitution(group: InstitutionRecord[]) {
  return [...group].sort((left, right) => {
    const leftExact = left.name === normalizeInstitutionName(left.name) ? 1 : 0
    const rightExact = right.name === normalizeInstitutionName(right.name) ? 1 : 0
    if (leftExact !== rightExact) return rightExact - leftExact
    if (left.accounts.length !== right.accounts.length) return right.accounts.length - left.accounts.length
    return left.createdAt.getTime() - right.createdAt.getTime()
  })[0]
}

function chooseCanonicalAssetClass(group: AssetClassRecord[]) {
  return [...group].sort((left, right) => {
    const leftHasCode = left.code ? 1 : 0
    const rightHasCode = right.code ? 1 : 0
    if (leftHasCode !== rightHasCode) return rightHasCode - leftHasCode
    if (left._count.assets !== right._count.assets) return right._count.assets - left._count.assets
    return left.createdAt.getTime() - right.createdAt.getTime()
  })[0]
}

async function mergeAccountIntoTarget(sourceAccountId: string, targetAccountId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where: { accountId: sourceAccountId }, data: { accountId: targetAccountId } })
    await tx.transaction.updateMany({ where: { originAccountId: sourceAccountId }, data: { originAccountId: targetAccountId } })
    await tx.ledgerEntry.updateMany({ where: { accountId: sourceAccountId }, data: { accountId: targetAccountId } })
    await tx.incomeEvent.updateMany({ where: { accountId: sourceAccountId }, data: { accountId: targetAccountId } })
    await tx.rentalReceipt.updateMany({ where: { accountId: sourceAccountId }, data: { accountId: targetAccountId } })
    await tx.account.delete({ where: { id: sourceAccountId } })
  })
}

async function reconcileInstitutions() {
  const institutions = await prisma.institution.findMany({
    include: { accounts: { select: { id: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const grouped = new Map<string, InstitutionRecord[]>()
  for (const institution of institutions) {
    const key = normalizeInstitutionName(institution.name)
    const current = grouped.get(key) ?? []
    current.push(institution)
    grouped.set(key, current)
  }

  const summary = {
    institutionGroupsMerged: 0,
    institutionsDeleted: 0,
    accountsMerged: 0,
    accountsRepointed: 0,
  }

  for (const group of grouped.values()) {
    if (group.length <= 1) continue

    const canonical = chooseCanonicalInstitution(group)
    summary.institutionGroupsMerged += 1

    for (const duplicate of group) {
      if (duplicate.id === canonical.id) continue

      const duplicateAccounts = await prisma.account.findMany({
        where: { institutionId: duplicate.id },
        select: { id: true, clientId: true, name: true, portfolioId: true },
      })

      for (const account of duplicateAccounts) {
        const existing = await prisma.account.findFirst({
          where: {
            institutionId: canonical.id,
            clientId: account.clientId,
            name: account.name,
          },
          select: { id: true, portfolioId: true },
        })

        if (existing) {
          if (!existing.portfolioId && account.portfolioId) {
            await prisma.account.update({
              where: { id: existing.id },
              data: { portfolioId: account.portfolioId },
            })
          }
          await mergeAccountIntoTarget(account.id, existing.id)
          summary.accountsMerged += 1
          continue
        }

        await prisma.account.update({
          where: { id: account.id },
          data: { institutionId: canonical.id },
        })
        summary.accountsRepointed += 1
      }

      const remainingAccounts = await prisma.account.count({ where: { institutionId: duplicate.id } })
      if (remainingAccounts === 0) {
        await prisma.institution.delete({ where: { id: duplicate.id } })
        summary.institutionsDeleted += 1
      }
    }
  }

  return summary
}

async function reconcileAssetClasses() {
  const assetClasses = await prisma.assetClass.findMany({
    include: { _count: { select: { assets: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const grouped = new Map<string, AssetClassRecord[]>()
  for (const assetClass of assetClasses) {
    const key = getCanonicalAssetClassKey(assetClass) ?? assetClass.id
    const current = grouped.get(key) ?? []
    current.push(assetClass)
    grouped.set(key, current)
  }

  const summary = {
    classGroupsMerged: 0,
    classesDeleted: 0,
    assetsReassigned: 0,
  }

  for (const group of grouped.values()) {
    if (group.length <= 1) continue

    const canonical = chooseCanonicalAssetClass(group)
    const canonicalMeta = getCanonicalAssetClassMeta(canonical)
    summary.classGroupsMerged += 1

    if (canonicalMeta) {
      await prisma.assetClass.update({
        where: { id: canonical.id },
        data: {
          code: canonicalMeta.code,
          name: canonicalMeta.name,
          description: canonicalMeta.description,
        },
      })
    }

    for (const duplicate of group) {
      if (duplicate.id === canonical.id) continue

      const moved = await prisma.asset.updateMany({
        where: { assetClassId: duplicate.id },
        data: { assetClassId: canonical.id },
      })
      summary.assetsReassigned += moved.count

      await prisma.assetClass.delete({ where: { id: duplicate.id } })
      summary.classesDeleted += 1
    }
  }

  return summary
}

async function main() {
  const institutionSummary = await reconcileInstitutions()
  const assetClassSummary = await reconcileAssetClasses()

  console.log(JSON.stringify({ institutionSummary, assetClassSummary }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })