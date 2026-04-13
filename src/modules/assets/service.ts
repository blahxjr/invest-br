import { prisma } from '../../lib/prisma'
import type { AssetClassCreateInput, AssetCreateInput } from './types'

export async function createAssetClass(input: AssetClassCreateInput) {
  return prisma.assetClass.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
    },
  })
}

export async function createAsset(input: AssetCreateInput) {
  return prisma.asset.create({
    data: {
      name: input.name,
      ticker: input.ticker ?? null,
      isin: input.isin ?? null,
      cnpj: input.cnpj ?? null,
      category: input.category,
      assetClassId: input.assetClassId,
    },
    include: { assetClass: true },
  })
}

export async function getAssetByTicker(ticker: string) {
  return prisma.asset.findUnique({
    where: { ticker },
    include: { assetClass: true },
  })
}

export async function getAssetsByClass(assetClassId: string) {
  return prisma.asset.findMany({
    where: { assetClassId },
    include: { assetClass: true },
  })
}

export async function getAllAssetClasses() {
  return prisma.assetClass.findMany({ orderBy: { name: 'asc' } })
}
