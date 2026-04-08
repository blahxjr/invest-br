import { prisma } from '@/lib/prisma'
import { getPositionsByAccount } from '@/modules/income/service'
import { getIncomeEventsByAccount } from '@/modules/income/service'

export interface DashboardData {
  totalPatrimony: number
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
  // Pega o primeiro portfolio disponível
  const portfolio = await prisma.portfolio.findFirst({
    include: { accounts: { include: { institution: true } } },
  })

  if (!portfolio) {
    return {
      totalPatrimony: 0,
      positions: [],
      recentIncome: [],
      totalIncomeMonth: 0,
      accountCount: 0,
    }
  }

  const accounts = portfolio.accounts

  // Posições de todos as contas
  const allPositionsNested = await Promise.all(
    accounts.map((acc) => getPositionsByAccount(acc.id))
  )
  const allPositions = allPositionsNested.flat()

  // Agrega por ativo (ticker) somando quantidades e recalculando custo médio ponderado
  const byTicker = new Map<
    string,
    { ticker: string; name: string; qty: number; totalCost: number; category: string }
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
      // Get asset category
      const asset = await prisma.asset.findUnique({
        where: { id: pos.assetId },
        select: { category: true },
      })
      byTicker.set(key, {
        ticker: pos.ticker ?? key,
        name: pos.name,
        qty,
        totalCost: cost,
        category: asset?.category ?? 'STOCK',
      })
    }
  }

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

  // Saldo das contas (ledger)
  const balances = await Promise.all(
    accounts.map(async (acc) => {
      const last = await prisma.ledgerEntry.findFirst({
        where: { accountId: acc.id },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      })
      return toNumber(last?.balanceAfter)
    })
  )
  const totalBalance = balances.reduce((s, b) => s + b, 0)
  const totalPositionsCost = positions.reduce((s, p) => s + p.totalCost, 0)
  const totalPatrimony = totalBalance + totalPositionsCost

  // Rendimentos do mês atual
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const incomeThisMonth = await Promise.all(
    accounts.map(async (acc) => {
      const events = await getIncomeEventsByAccount(acc.id)
      return events.filter((e) => new Date(e.paymentDate) >= startOfMonth)
    })
  )
  const allIncomeEvents = incomeThisMonth.flat()
  const totalIncomeMonth = allIncomeEvents.reduce((s, e) => s + toNumber(e.netAmount), 0)

  // Rendimentos recentes (top 5)
  const allIncomeForRecent = await Promise.all(
    accounts.map((acc) => getIncomeEventsByAccount(acc.id))
  )
  const recentIncome = allIncomeForRecent
    .flat()
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
    totalPatrimony,
    positions,
    recentIncome,
    totalIncomeMonth,
    accountCount: accounts.length,
  }
}
