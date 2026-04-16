import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getPositions, summarizePositions } from '@/modules/positions/service'
import { getQuotes } from '@/lib/quotes'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { generateAlerts } from '@/modules/insights/alerts-service'
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
  alertsSummary: {
    total: number
    critical: number
    warning: number
    info: number
  }
}

function toNumber(d: { toString(): string } | null | undefined): number {
  if (!d) return 0
  return parseFloat(d.toString())
}

/**
 * Calcula a alocação percentual por categoria de ativo usando totalCost.
 * Função pura exportada para facilitar testes unitários sem banco.
 * 
 * @deprecated Use calcAllocationWithQuotes para alocação baseada em valor de mercado
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
 * Calcula a alocação percentual por categoria de ativo usando valor de mercado (currentValue).
 * Se não houver cotação, usa totalCost como fallback.
 * 
 * Esta é a função recomendada para dashboard e análises.
 */
export function calcAllocationWithQuotes(positions: PositionWithQuote[]): AllocationItem[] {
  const map = new Map<string, Decimal>()
  const total = positions.reduce((acc, p) => {
    const value = p.currentValue ?? p.totalCost
    return acc.plus(value)
  }, new Decimal(0))

  for (const p of positions) {
    const key = p.category as string
    const value = p.currentValue ?? p.totalCost
    map.set(key, (map.get(key) ?? new Decimal(0)).plus(value))
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

  // Alocação por categoria (usando valor de mercado)
  const allocationByCategory = calcAllocationWithQuotes(enriched)

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

  const alerts = await generateAlerts(userId)
  const alertsSummary = {
    total: alerts.length,
    critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
    warning: alerts.filter((alert) => alert.severity === 'WARNING').length,
    info: alerts.filter((alert) => alert.severity === 'INFO').length,
  }

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
    alertsSummary,
  }
}
