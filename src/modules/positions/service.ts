import type { AssetCategory, TransactionType } from '@prisma/client'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import type { Position, PositionSummary } from './types'

type PositionAsset = {
  id: string
  ticker: string | null
  name: string
  category: AssetCategory
  assetClass: {
    code: string | null
  }
}

type PositionTransaction = {
  type: TransactionType
  quantity: { toString(): string } | null
  totalAmount: { toString(): string }
  date: Date
  asset: PositionAsset | null
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
    },
    orderBy: { date: 'asc' },
  })

  return calcPositions(transactions)
}
