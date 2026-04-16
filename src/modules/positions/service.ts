import type { AssetCategory, TransactionType } from '@prisma/client'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getQuotes } from '@/lib/quotes'
import type { Position, PositionSummary, PortfolioSummary, SerializedPositionWithQuote } from './types'
import { enrichWithQuotes } from './types'

type PositionAsset = {
  id: string
  ticker: string | null
  name: string
  category: AssetCategory
  assetClass: {
    code: string | null
  }
}

type PositionAccount = {
  id: string
  name: string
  institution: {
    id: string
    name: string
  } | null
}

type PositionTransaction = {
  type: TransactionType
  quantity: { toString(): string } | null
  totalAmount: { toString(): string }
  date: Date
  asset: PositionAsset | null
  account: PositionAccount
}

type PositionMap = Map<string, Position>

/**
 * Calcula as posicoes abertas em memoria a partir das transacoes BUY/SELL.
 */
export function calcPositions(transactions: PositionTransaction[]): Position[] {
  const map: PositionMap = new Map()

  for (const tx of transactions) {
    if (!tx.asset || !tx.quantity) continue

    const key = tx.asset.id
    const pos = map.get(key) ?? {
      assetId: tx.asset.id,
      ticker: tx.asset.ticker ?? '',
      name: tx.asset.name,
      category: tx.asset.category,
      assetClassCode: tx.asset.assetClass.code ?? '',
      quantity: new Decimal(0),
      avgCost: new Decimal(0),
      totalCost: new Decimal(0),
      accountId: tx.account.id,
      accountName: tx.account.name,
      institutionId: tx.account.institution?.id ?? null,
      institutionName: tx.account.institution?.name ?? null,
      allocationPct: new Decimal(0), // será recalculado no enrichWithQuotes
    }

    const quantity = new Decimal(tx.quantity.toString())
    const totalAmount = new Decimal(tx.totalAmount.toString())

    if (tx.type === 'BUY') {
      const newQty = pos.quantity.plus(quantity)
      const newCost = pos.totalCost.plus(totalAmount)
      pos.avgCost = newQty.isZero() ? new Decimal(0) : newCost.div(newQty)
      pos.quantity = newQty
      pos.totalCost = newCost
    } else if (tx.type === 'SELL') {
      pos.quantity = pos.quantity.minus(quantity)
      if (pos.quantity.lte(0)) {
        map.delete(key)
        continue
      }
      pos.totalCost = pos.avgCost.times(pos.quantity)
    }

    map.set(key, pos)
  }

  return Array.from(map.values())
    .filter((position) => position.quantity.gt(0))
    .sort((a, b) => b.totalCost.comparedTo(a.totalCost))
}

/**
 * Resume os totais da carteira a partir das posicoes calculadas.
 */
export function summarizePositions(positions: Position[]): PositionSummary {
  return positions.reduce(
    (summary, position) => ({
      totalCost: summary.totalCost.plus(position.totalCost),
      assetCount: summary.assetCount + 1,
      totalQuantity: summary.totalQuantity.plus(position.quantity),
    }),
    {
      totalCost: new Decimal(0),
      assetCount: 0,
      totalQuantity: new Decimal(0),
    },
  )
}

/**
 * Busca todas as transacoes BUY/SELL do usuario em uma unica query e calcula posicoes.
 */
export async function getPositions(userId: string): Promise<Position[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      type: { in: ['BUY', 'SELL'] },
      account: { client: { userId } },
      assetId: { not: null },
      deletedAt: null,
    },
    select: {
      type: true,
      quantity: true,
      totalAmount: true,
      date: true,
      asset: {
        select: {
          id: true,
          ticker: true,
          name: true,
          category: true,
          assetClass: { select: { code: true } },
        },
      },
      account: {
        select: {
          id: true,
          name: true,
          institution: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  return calcPositions(transactions)
}

/**
 * Recalcula as posições de uma conta específica a partir das transações BUY/SELL não deletadas.
 * Como o projeto calcula posições on-the-fly, este recálculo retorna o estado consolidado atual.
 */
export async function recalcPositions(accountId: string): Promise<Position[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      type: { in: ['BUY', 'SELL'] },
      accountId,
      assetId: { not: null },
      deletedAt: null,
    },
    select: {
      type: true,
      quantity: true,
      totalAmount: true,
      date: true,
      asset: {
        select: {
          id: true,
          ticker: true,
          name: true,
          category: true,
          assetClass: { select: { code: true } },
        },
      },
      account: {
        select: {
          id: true,
          name: true,
          institution: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  return calcPositions(transactions)
}

/**
 * Calcula resumo consolidado da carteira para o dashboard.
 * Retorna totalCost, totalValue (com cotações), gain/loss, top 5 posições,
 * alocação por classe e rendimento do mês atual.
 * 
 * Reutiliza getPositions() — uma única query de transações.
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
  // Busca todas as posições abertas
  const positions = await getPositions(userId)

  // Se não há posições, retorna summary zerado
  if (positions.length === 0) {
    return {
      totalCost: new Decimal(0),
      totalValue: new Decimal(0),
      totalGainLoss: new Decimal(0),
      totalGainLossPct: 0,
      assetCount: 0,
      monthlyIncome: new Decimal(0),
      topPositions: [],
      allocationByClass: [],
    }
  }

  // Enriquece com cotações
  const quotes = await getQuotes(positions.map((p) => p.ticker))
  const enriched = enrichWithQuotes(positions, quotes)

  // Calcula valores agregados
  const totalCost = enriched.reduce((sum, p) => sum.plus(p.totalCost), new Decimal(0))
  const totalValue = enriched.reduce((sum, p) => {
    const value = p.currentValue ?? p.totalCost
    return sum.plus(value)
  }, new Decimal(0))
  const totalGainLoss = totalValue.minus(totalCost)
  const totalGainLossPct = totalCost.isZero() ? 0 : parseFloat(totalGainLoss.div(totalCost).times(100).toString())

  // Top 5 por valor de mercado (com fallback para totalCost)
  const topPositions = enriched
    .sort((a, b) => {
      const valueA = a.currentValue ?? a.totalCost
      const valueB = b.currentValue ?? b.totalCost
      return valueB.comparedTo(valueA)
    })
    .slice(0, 5)
    .map((p) => ({
      assetId: p.assetId,
      ticker: p.ticker,
      name: p.name,
      category: p.category,
      assetClassCode: p.assetClassCode,
      quantity: p.quantity.toString(),
      avgCost: p.avgCost.toString(),
      totalCost: p.totalCost.toString(),
      accountId: p.accountId,
      accountName: p.accountName,
      institutionId: p.institutionId,
      institutionName: p.institutionName,
      allocationPct: p.allocationPct.toString(),
      currentPrice: p.currentPrice,
      currentValue: p.currentValue?.toString() ?? null,
      gainLoss: p.gainLoss?.toString() ?? null,
      gainLossPercent: p.gainLossPercent?.toString() ?? null,
      quoteChangePct: p.quoteChangePct,
      quotedAt: p.quotedAt?.toISOString() ?? null,
    }))

  // Alocação por AssetClass (agrupado por assetClassCode)
  const allocationMap = new Map<string, Decimal>()
  for (const p of enriched) {
    const code = p.assetClassCode || 'Sem classificação'
    const value = p.currentValue ?? p.totalCost
    allocationMap.set(code, (allocationMap.get(code) ?? new Decimal(0)).plus(value))
  }

  const allocationByClass = Array.from(allocationMap.entries())
    .map(([className, value]) => ({
      className,
      value,
      pct: totalValue.isZero() ? 0 : parseFloat(value.div(totalValue).times(100).toString()),
    }))
    .sort((a, b) => b.value.comparedTo(a.value))

  // Rendimento do mês atual
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const incomeMonth = await prisma.incomeEvent.aggregate({
    where: {
      account: { client: { userId } },
      paymentDate: { gte: startOfMonth },
    },
    _sum: { netAmount: true },
  })

  const monthlyIncome = incomeMonth._sum.netAmount
    ? new Decimal(incomeMonth._sum.netAmount.toString())
    : new Decimal(0)

  return {
    totalCost,
    totalValue,
    totalGainLoss,
    totalGainLossPct,
    assetCount: positions.length,
    monthlyIncome,
    topPositions,
    allocationByClass,
  }
}
