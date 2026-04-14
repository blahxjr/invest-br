import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getPositions, summarizePositions } from '@/modules/positions/service'
import { getQuotes } from '@/lib/quotes'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Position, PositionWithQuote } from '@/modules/positions/types'
import { enrichWithQuotes } from '@/modules/positions/types'
import type { AllocationItem } from '@/modules/positions/types'

export interface DashboardRecentIncome {
  id: string
  type: string
  ticker?: string
  grossAmount: number
  netAmount: number
  paymentDate: Date
}

export interface DashboardData {
  totalPortfolioCost: Decimal
  totalCurrentValue: Decimal
  assetCount: number
  totalQuantity: Decimal
  totalIncomeMonth: Decimal
  top5Positions: PositionWithQuote[]
  allocationByCategory: AllocationItem[]
  recentIncome: DashboardRecentIncome[]
}

function toNumber(d: { toString(): string } | null | undefined): number {
  if (!d) return 0
  return parseFloat(d.toString())
}

/**
 * Calcula a alocação percentual por categoria de ativo.
 * Função pura exportada para facilitar testes unitários sem banco.
 */
export function calcAllocation(positions: Position[]): AllocationItem[] {
  const map = new Map<string, Decimal>()
  const total = positions.reduce((acc, p) => acc.plus(p.totalCost), new Decimal(0))

  for (const p of positions) {
    const key = p.category as string
    map.set(key, (map.get(key) ?? new Decimal(0)).plus(p.totalCost))
  }

  return Array.from(map.entries())
    .map(([category, value]) => ({
      category,
      value,
      percentage: total.isZero() ? new Decimal(0) : value.div(total).times(100),
    }))
    .sort((a, b) => b.value.comparedTo(a.value))
}

/**
 * Busca e calcula todos os dados do dashboard para o usuário autenticado.
 * Usa getPositions() em uma única query — sem N+1.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  const userId = session.user.id

  // 1 query para todas as posições (sem N+1)
  const positions = await getPositions(userId)
  const summary = summarizePositions(positions)

  // Cotações com cache de 5 min para enriquecer valor de mercado e P&L.
  const quotes = await getQuotes(positions.map((position) => position.ticker))
  const enriched = enrichWithQuotes(positions, quotes)

  // Top 5 por totalCost (getPositions já ordena por totalCost desc)
  const top5 = enriched.slice(0, 5)

  // Alocação por categoria
  const allocationByCategory = calcAllocation(positions)

  // Proventos recentes — query separada (não é N+1)
  const incomeRaw = await prisma.incomeEvent.findMany({
    where: { account: { client: { userId } } },
    orderBy: { paymentDate: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      grossAmount: true,
      netAmount: true,
      paymentDate: true,
      asset: { select: { ticker: true } },
    },
  })

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

  const recentIncome: DashboardRecentIncome[] = incomeRaw.map((e) => ({
    id: e.id,
    type: e.type,
    ticker: e.asset?.ticker ?? undefined,
    grossAmount: toNumber(e.grossAmount),
    netAmount: toNumber(e.netAmount),
    paymentDate: e.paymentDate,
  }))

  return {
    totalPortfolioCost: summary.totalCost,
    totalCurrentValue: enriched.reduce(
      (acc, position) => (position.currentValue ? acc.plus(position.currentValue) : acc),
      new Decimal(0),
    ),
    assetCount: summary.assetCount,
    totalQuantity: summary.totalQuantity,
    totalIncomeMonth:
      incomeMonth._sum.netAmount != null
        ? new Decimal(incomeMonth._sum.netAmount.toString())
        : new Decimal(0),
    top5Positions: top5,
    allocationByCategory,
    recentIncome,
  }
}
