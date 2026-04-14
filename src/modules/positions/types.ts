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
 */
export function enrichWithQuotes(
  positions: Position[],
  quotes: Map<string, QuoteResult>,
): PositionWithQuote[] {
  return positions.map((position) => {
    const quote = quotes.get(position.ticker)
    if (!quote) {
      return {
        ...position,
        currentPrice: null,
        currentValue: null,
        gainLoss: null,
        gainLossPercent: null,
        quoteChangePct: null,
        quotedAt: null,
      }
    }

    const currentValue = position.quantity.times(quote.price)
    const gainLoss = currentValue.minus(position.totalCost)
    const gainLossPercent = position.totalCost.isZero()
      ? new Decimal(0)
      : gainLoss.div(position.totalCost).times(100)

    return {
      ...position,
      currentPrice: quote.price,
      currentValue,
      gainLoss,
      gainLossPercent,
      quoteChangePct: quote.changePercent,
      quotedAt: quote.changedAt,
    }
  })
}
