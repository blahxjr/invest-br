import type { AssetCategory } from '@prisma/client'

export type AssetClassCreateInput = {
  name: string
  code?: string
  description?: string
}

export type AssetCreateInput = {
  name: string
  ticker?: string
  isin?: string
  cnpj?: string
  category: AssetCategory
  assetClassId: string
}
