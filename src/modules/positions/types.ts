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
 * 
 * Primeiro passe: calcula currentValue para cada posição
 * Segundo passe: calcula totalValue usando currentValue (com fallback para totalCost)
 * Terceiro passe: calcula allocationPct baseado no totalValue
 */
export function enrichWithQuotes(
  positions: Position[],
  quotes: Map<string, QuoteResult>,
): PositionWithQuote[] {
  // Primeiro passe: enriquecer com currentValue
  const enrichedPositions = positions.map((position) => {
    const quote = quotes.get(position.ticker)
    const currentValue = quote
      ? position.quantity.times(quote.price)
      : null
    return { position, quote, currentValue }
  })

  // Segundo passe: calcular totalValue usando currentValue quando disponível
  const totalValue = enrichedPositions.reduce((sum, { currentValue, position }) => {
    const valueForTotal = currentValue ?? position.totalCost
    return sum.plus(valueForTotal)
  }, new Decimal(0))

  // Terceiro passe: montar resultado final com allocationPct correto
  return enrichedPositions.map(({ position, quote, currentValue }) => {
    const gainLoss = currentValue
      ? currentValue.minus(position.totalCost)
      : null

    const gainLossPercent = position.totalCost.isZero()
      ? new Decimal(0)
      : gainLoss
      ? gainLoss.div(position.totalCost).times(100)
      : null

    // allocationPct baseado em currentValue ou totalCost, dividido pelo totalValue
    const allocationValue = currentValue ?? position.totalCost
    const newAllocationPct = !totalValue.isZero()
      ? allocationValue.div(totalValue).times(100)
      : new Decimal(0)

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
