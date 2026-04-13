import type { IncomeType, Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

export type IncomeEventCreateInput = {
  type: IncomeType
  accountId: string
  assetId?: string
  transactionId?: string
  grossAmount: number | string
  taxAmount?: number | string
  netAmount: number | string
  paymentDate: Date
  notes?: string
}

export type RentalReceiptCreateInput = {
  propertyName: string
  accountId: string
  grossRent: number | string
  expenses?: number | string
  netRent: number | string
  paymentDate: Date
}

export type AssetPosition = {
  assetId: string
  ticker: string | null
  name: string
  quantity: Decimal
  averageCost: Decimal      // custo médio unitário
  totalCost: Decimal        // quantidade × custo médio
  buyCount: number
  sellCount: number
}
