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
      count: vi.fn(),
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

vi.mock('@/modules/insights/rebalance-service', () => ({
  calculateRebalance: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { getPositions } from '@/modules/positions/service'
import { calculateRebalance } from '@/modules/insights/rebalance-service'
import { generateAlerts } from '@/modules/insights/alerts-service'

describe('alerts-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ativo com 25% da carteira -> alerta CONCENTRACAO WARNING', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { ticker: 'WEGE3', currentValue: new Decimal(2500), assetClassCode: 'ACOES' },
      { ticker: 'ITUB4', currentValue: new Decimal(7500), assetClassCode: 'ACOES' },
    ])
    ;(calculateRebalance as any).mockResolvedValue({ isBalanced: true, allocations: [] })

    const alerts = await generateAlerts('user-1')

    expect(alerts.some((a) => a.type === 'CONCENTRACAO' && a.severity === 'WARNING')).toBe(true)
  })

  it('Ativo com 38% -> alerta CONCENTRACAO CRITICAL', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { ticker: 'WEGE3', currentValue: new Decimal(3800), assetClassCode: 'ACOES' },
      { ticker: 'ITUB4', currentValue: new Decimal(6200), assetClassCode: 'ACOES' },
    ])
    ;(calculateRebalance as any).mockResolvedValue({ isBalanced: true, allocations: [] })

    const alerts = await generateAlerts('user-1')

    expect(alerts.some((a) => a.type === 'CONCENTRACAO' && a.severity === 'CRITICAL')).toBe(true)
  })

  it('Ativo com 18% -> NÃO gera alerta de concentração', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { ticker: 'WEGE3', currentValue: new Decimal(1800), assetClassCode: 'ACOES' },
      { ticker: 'ITUB4', currentValue: new Decimal(1800), assetClassCode: 'ACOES' },
      { ticker: 'VALE3', currentValue: new Decimal(1800), assetClassCode: 'ACOES' },
      { ticker: 'BBDC4', currentValue: new Decimal(1800), assetClassCode: 'ACOES' },
      { ticker: 'HGLG11', currentValue: new Decimal(1800), assetClassCode: 'FIIS' },
      { ticker: 'KNRI11', currentValue: new Decimal(1000), assetClassCode: 'FIIS' },
    ])
    ;(calculateRebalance as any).mockResolvedValue({ isBalanced: true, allocations: [] })

    const alerts = await generateAlerts('user-1')

    expect(alerts.some((a) => a.type === 'CONCENTRACAO')).toBe(false)
  })

  it('Classe com 75% -> gera CONCENTRACAO_CLASSE WARNING', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { ticker: 'CDB', currentValue: new Decimal(7500), assetClassCode: 'RENDA_FIXA' },
      { ticker: 'PETR4', currentValue: new Decimal(2500), assetClassCode: 'ACOES' },
    ])
    ;(calculateRebalance as any).mockResolvedValue({ isBalanced: true, allocations: [] })

    const alerts = await generateAlerts('user-1')

    expect(alerts.some((a) => a.type === 'CONCENTRACAO_CLASSE' && a.severity === 'WARNING')).toBe(true)
  })

  it('Carteira balanceada sem concentração -> alertas vazio', async () => {
    ;(prisma.client.findFirst as any).mockResolvedValue({ id: 'client-1' })
    ;(prisma.portfolio.findMany as any).mockResolvedValue([{ id: 'portfolio-1' }])
    ;(getPositions as any).mockResolvedValue([
      { ticker: 'CDB', currentValue: new Decimal(1700), assetClassCode: 'RENDA_FIXA' },
      { ticker: 'PETR4', currentValue: new Decimal(1700), assetClassCode: 'ACOES' },
      { ticker: 'HGLG11', currentValue: new Decimal(1700), assetClassCode: 'FIIS' },
      { ticker: 'VALE3', currentValue: new Decimal(1700), assetClassCode: 'ACOES' },
      { ticker: 'ITUB4', currentValue: new Decimal(1600), assetClassCode: 'ACOES' },
      { ticker: 'BBAS3', currentValue: new Decimal(1600), assetClassCode: 'ACOES' },
    ])
    ;(calculateRebalance as any).mockResolvedValue({ isBalanced: true, allocations: [] })

    const alerts = await generateAlerts('user-1')

    expect(alerts).toHaveLength(0)
  })
})
