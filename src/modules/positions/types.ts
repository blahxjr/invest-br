import type { AssetCategory } from '@prisma/client'
import Decimal from 'decimal.js'
import type { QuoteResult } from '@/lib/quotes'

export type Position = {
  assetId: string
  ticker: string
  name: string
  category: AssetCategory
  assetClassCode: string
  quantity: Decimal
  avgCost: Decimal
  totalCost: Decimal
  accountId: string
  accountName: string
  institutionId: string | null
  institutionName: string | null
  allocationPct: Decimal  // porcentagem da carteira (0-100)
}

export type PositionSummary = {
  totalCost: Decimal
  assetCount: number
  totalQuantity: Decimal
}

export type SerializedPosition = {
  assetId: string
  ticker: string
  name: string
  category: AssetCategory
  assetClassCode: string
  quantity: string
  avgCost: string
  totalCost: string
  accountId: string
  accountName: string
  institutionId: string | null
  institutionName: string | null
  allocationPct: string  // porcentagem formatada
}

export type AllocationItem = {
  category: string   // AssetCategory
  value: Decimal     // totalCost nessa categoria
  percentage: Decimal // % do portfólio total
}

export type PositionWithQuote = Position & {
  currentPrice: number | null
  currentValue: Decimal | null
  gainLoss: Decimal | null
  gainLossPercent: Decimal | null
  quoteChangePct: number | null
  quotedAt: Date | null
}

export type SerializedPositionWithQuote = SerializedPosition & {
  currentPrice: number | null
  currentValue: string | null
  gainLoss: string | null
  gainLossPercent: string | null
  quoteChangePct: number | null
  quotedAt: string | null
}

/**
 * Enriquece posições com cotações e métricas de P&L.
 * Calcula também allocationPct com base no totalValue de todas as posições.
 */
export function enrichWithQuotes(
  positions: Position[],
  quotes: Map<string, QuoteResult>,
): PositionWithQuote[] {
  // Calcula o total da carteira para allocationPct
  const totalValue = positions.reduce((sum, pos) => sum.plus(pos.totalCost), new Decimal(0))

  return positions.map((position) => {
    const quote = quotes.get(position.ticker)
    const currentValue = quote
      ? position.quantity.times(quote.price)
      : null

    const gainLoss = currentValue
      ? currentValue.minus(position.totalCost)
      : null

    const gainLossPercent = position.totalCost.isZero()
      ? new Decimal(0)
      : gainLoss
      ? gainLoss.div(position.totalCost).times(100)
      : null

    // Atualizar allocationPct com base em currentValue se disponível
    const allocationValue = currentValue ?? position.totalCost
    const newAllocationPct = !totalValue.isZero()
      ? allocationValue.div(totalValue).times(100)
      : position.allocationPct

    return {
      ...position,
      allocationPct: newAllocationPct,
      currentPrice: quote?.price ?? null,
      currentValue,
      gainLoss,
      gainLossPercent,
      quoteChangePct: quote?.changePercent ?? null,
      quotedAt: quote?.changedAt ?? null,
    }
  })
}
