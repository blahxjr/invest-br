import { describe, it, expect, vi, beforeEach } from 'vitest'
import Decimal from 'decimal.js'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
    },
    portfolio: {
      findMany: vi.fn(),
    },
    allocationTarget: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/modules/positions/service', () => ({
  getPositions: vi.fn(),
}))

vi.mock('@/lib/quotes', () => ({
  getQuotes: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('@/modules/positions/types', () => ({
  enrichWithQuotes: vi.fn((positions: unknown[]) => positions),
}))

import { prisma } from '@/lib/prisma'
import { getPositions } from '@/modules/positions/service'
import { calculateRebalance } from '@/modules/insights/rebalance-service'

describe('rebalance-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Carteira balanceada -> isBalanced true e todos status OK', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'FIXED_INCOME', currentValue: new Decimal(4000) },
      { category: 'STOCK', currentValue: new Decimal(3000) },
      { category: 'FII', currentValue: new Decimal(2000) },
      { category: 'CRYPTO', currentValue: new Decimal(1000) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'RENDA_FIXA', targetPct: new Decimal(40) },
      { assetClass: 'ACOES', targetPct: new Decimal(30) },
      { assetClass: 'FIIS', targetPct: new Decimal(20) },
      { assetClass: 'CRYPTO', targetPct: new Decimal(10) },
    ])

    const result = await calculateRebalance('user-1')

    expect(result.isBalanced).toBe(true)
    expect(result.allocations.every((a) => a.status === 'OK')).toBe(true)
  })

  it('Ação abaixo do alvo por 12pp -> status ABAIXO', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'STOCK', currentValue: new Decimal(1800) },
      { category: 'FIXED_INCOME', currentValue: new Decimal(8200) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'ACOES', targetPct: new Decimal(30) },
      { assetClass: 'RENDA_FIXA', targetPct: new Decimal(70) },
    ])

    const result = await calculateRebalance('user-1')
    const acoes = result.allocations.find((a) => a.assetClass === 'ACOES')

    expect(acoes?.status).toBe('ABAIXO')
    expect(acoes?.suggestionLabel).toContain('Aportar')
  })

  it('RF acima do alvo por 20pp -> status ACIMA', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'FIXED_INCOME', currentValue: new Decimal(9000) },
      { category: 'STOCK', currentValue: new Decimal(1000) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'RENDA_FIXA', targetPct: new Decimal(70) },
      { assetClass: 'ACOES', targetPct: new Decimal(30) },
    ])

    const result = await calculateRebalance('user-1')
    const rf = result.allocations.find((a) => a.assetClass === 'RENDA_FIXA')

    expect(rf?.status).toBe('ACIMA')
    expect(rf?.suggestionLabel).toContain('Reduzir')
  })

  it('Sem AllocationTarget -> sem sugestões', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'FIXED_INCOME', currentValue: new Decimal(5000) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([])

    const result = await calculateRebalance('user-1')

    expect(result.allocations[0].targetPct).toBeNull()
    expect(result.allocations[0].suggestionValue).toBeNull()
  })

  it('Carteira vazia -> total zero e alocações vazias', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([])

    const result = await calculateRebalance('user-1')

    expect(result.totalPortfolioValue.toNumber()).toBe(0)
    expect(result.allocations).toHaveLength(0)
  })

  it('Cálculo correto com Decimal (sem imprecisão float)', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'STOCK', currentValue: new Decimal('0.1') },
      { category: 'STOCK', currentValue: new Decimal('0.2') },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'ACOES', targetPct: new Decimal(100) },
    ])

    const result = await calculateRebalance('user-1')
    const acoes = result.allocations.find((a) => a.assetClass === 'ACOES')

    expect(acoes?.currentValue.toString()).toBe('0.3')
  })

  it('Desvio exatamente 5pp -> status OK', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'STOCK', currentValue: new Decimal(5500) },
      { category: 'FIXED_INCOME', currentValue: new Decimal(4500) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'ACOES', targetPct: new Decimal(50) },
      { assetClass: 'RENDA_FIXA', targetPct: new Decimal(50) },
    ])

    const result = await calculateRebalance('user-1')
    const acoes = result.allocations.find((a) => a.assetClass === 'ACOES')

    expect(acoes?.status).toBe('OK')
  })

  it('Desvio 5.01pp -> status ACIMA', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { category: 'STOCK', currentValue: new Decimal(5501) },
      { category: 'FIXED_INCOME', currentValue: new Decimal(4499) },
    ])
    ;(prisma.allocationTarget.findMany as any).mockResolvedValue([
      { assetClass: 'ACOES', targetPct: new Decimal(50) },
      { assetClass: 'RENDA_FIXA', targetPct: new Decimal(50) },
    ])

    const result = await calculateRebalance('user-1')
    const acoes = result.allocations.find((a) => a.assetClass === 'ACOES')

    expect(acoes?.status).toBe('ACIMA')
  })
})
