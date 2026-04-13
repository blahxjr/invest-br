import { prisma } from '@/lib/prisma'
import { getPositionsByAccount } from '@/modules/income/service'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export interface DashboardData {
  totalCost: number
  positions: {
    ticker: string
    name: string
    quantity: number
    averageCost: number
    totalCost: number
    category: string
  }[]
  recentIncome: {
    id: string
    type: string
    ticker?: string
    grossAmount: number
    netAmount: number
    paymentDate: Date
  }[]
  totalIncomeMonth: number
  accountCount: number
}

function toNumber(d: { toString(): string } | null | undefined): number {
  if (!d) return 0
  return parseFloat(d.toString())
}

export async function getDashboardData(): Promise<DashboardData> {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  const userId = session.user.id

  // Pega o portfolio do usuário autenticado
  const portfolio = await prisma.portfolio.findFirst({
    where: { userId },
    include: { accounts: { include: { institution: true } } },
  })

  if (!portfolio) {
    return {
      totalCost: 0,
      positions: [],
      recentIncome: [],
      totalIncomeMonth: 0,
      accountCount: 0,
    }
  }

  const accounts = portfolio.accounts
  const accountIds = accounts.map((acc) => acc.id)

  // Posições de todos as contas
  const allPositionsNested = await Promise.all(
    accounts.map((acc) => getPositionsByAccount(acc.id))
  )
  const allPositions = allPositionsNested.flat()

  // Agrega por ativo (ticker) somando quantidades e recalculando custo médio ponderado
  const byTicker = new Map<
    string,
    {
      ticker: string
      name: string
      qty: number
      totalCost: number
      assetId: string
      category: string
    }
  >()

  for (const pos of allPositions) {
    const key = pos.ticker ?? pos.assetId
    const qty = toNumber(pos.quantity)
    const cost = toNumber(pos.totalCost)
    const existing = byTicker.get(key)
    if (existing) {
      existing.qty += qty
      existing.totalCost += cost
    } else {
      byTicker.set(key, {
        ticker: pos.ticker ?? key,
        name: pos.name,
        qty,
        totalCost: cost,
        assetId: pos.assetId,
        category: 'STOCK',
      })
    }
  }

  const assetIds = Array.from(new Set([...byTicker.values()].map((p) => p.assetId).filter(Boolean)))
  const assetCategories =
    assetIds.length > 0
      ? await prisma.asset.findMany({
          where: { id: { in: assetIds } },
          select: { id: true, category: true },
        })
      : []
  const categoryMap = new Map(assetCategories.map((a) => [a.id, a.category]))

  for (const position of byTicker.values()) {
    position.category = categoryMap.get(position.assetId) ?? 'STOCK'
  }

  const totalCost = Array.from(byTicker.values()).reduce((sum, p) => sum + p.totalCost, 0)

  const positions = Array.from(byTicker.values())
    .map((p) => ({
      ticker: p.ticker,
      name: p.name,
      quantity: p.qty,
      averageCost: p.qty > 0 ? p.totalCost / p.qty : 0,
      totalCost: p.totalCost,
      category: p.category,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5)

  // Rendimentos em uma única query para todas as contas
  const allIncomeRaw =
    accountIds.length > 0
      ? await prisma.incomeEvent.findMany({
          where: { accountId: { in: accountIds } },
          include: { asset: { select: { ticker: true } } },
          orderBy: { paymentDate: 'desc' },
        })
      : []

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalIncomeMonth = allIncomeRaw
    .filter((e) => new Date(e.paymentDate) >= startOfMonth)
    .reduce((s, e) => s + toNumber(e.netAmount), 0)

  const recentIncome = allIncomeRaw
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      type: e.type,
      ticker: e.asset?.ticker ?? undefined,
      grossAmount: toNumber(e.grossAmount),
      netAmount: toNumber(e.netAmount),
      paymentDate: e.paymentDate,
    }))

  return {
    totalCost,
    positions,
    recentIncome,
    totalIncomeMonth,
    accountCount: accounts.length,
  }
}
