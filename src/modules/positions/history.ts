import type { TransactionType, AssetCategory } from '@prisma/client'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { calcPositions, summarizePositions } from './service'

export type PeriodOption = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export type PatrimonySnapshot = {
  date: Date
  totalCost: Decimal
  assetCount: number
}

type HistoryTransaction = {
  type: TransactionType
  quantity: { toString(): string } | null
  totalAmount: { toString(): string }
  date: Date
  asset: {
    id: string
    ticker: string | null
    name: string
    category: AssetCategory
    assetClass: {
      code: string | null
    }
  } | null
}

function atEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function buildDatePoints(period: PeriodOption, firstTxDate: Date | null): Date[] {
  if (period === 'ALL') {
    if (!firstTxDate) return []

    const start = new Date(firstTxDate)
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const points: Date[] = []
    const cursor = new Date(start)
    while (cursor <= today) {
      points.push(atEndOfDay(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }

    const last = points[points.length - 1]
    const todayEod = atEndOfDay(today)
    if (!last || last.toDateString() !== todayEod.toDateString()) {
      points.push(todayEod)
    }

    return points
  }

  const [windowDays, stepDays] =
    period === '1M' ? [30, 1] : period === '3M' ? [90, 7] : period === '6M' ? [180, 7] : [365, 7]

  const start = daysAgo(windowDays - 1)
  const end = new Date()
  end.setHours(0, 0, 0, 0)

  const points: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    points.push(atEndOfDay(cursor))
    cursor.setDate(cursor.getDate() + stepDays)
  }

  const last = points[points.length - 1]
  const endEod = atEndOfDay(end)
  if (!last || last.toDateString() !== endEod.toDateString()) {
    points.push(endEod)
  }

  return points
}

/**
 * Calcula snapshots de patrimonio com base nas transacoes acumuladas ate cada data.
 */
export function calcSnapshotsFromTxs(
  transactions: HistoryTransaction[],
  dates: Date[],
): PatrimonySnapshot[] {
  return dates.map((pointDate) => {
    const txsUntilPoint = transactions.filter((transaction) => transaction.date <= pointDate)
    const positions = calcPositions(txsUntilPoint)
    const summary = summarizePositions(positions)

    return {
      date: pointDate,
      totalCost: summary.totalCost,
      assetCount: summary.assetCount,
    }
  })
}

/**
 * Recalcula o patrimônio retrospectivo por periodo usando transacoes BUY/SELL em memoria.
 */
export async function calcPatrimonyHistory(
  userId: string,
  period: PeriodOption = '1Y',
): Promise<PatrimonySnapshot[]> {
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

  const firstTxDate = transactions.length > 0 ? transactions[0].date : null
  const points = buildDatePoints(period, firstTxDate)

  return calcSnapshotsFromTxs(transactions, points)
}
