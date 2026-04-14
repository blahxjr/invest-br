import { describe, it, expect, vi } from 'vitest'

// Mock necessário porque data.ts importa @/lib/auth (next-auth) que não resolve em node
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import Decimal from 'decimal.js'
import { calcAllocation } from '@/app/(app)/dashboard/data'
import type { Position } from '@/modules/positions/types'

const mockPositions: Position[] = [
  {
    assetId: 'a1',
    ticker: 'PETR4',
    name: 'Petrobras',
    category: 'STOCK',
    assetClassCode: 'ACOES',
    quantity: new Decimal(10),
    avgCost: new Decimal(30),
    totalCost: new Decimal(300),
  },
  {
    assetId: 'a2',
    ticker: 'HGLG11',
    name: 'CSHG Logística',
    category: 'FII',
    assetClassCode: 'FII',
    quantity: new Decimal(5),
    avgCost: new Decimal(140),
    totalCost: new Decimal(700),
  },
]

describe('calcAllocation', () => {
  it('calcula percentual correto por categoria', () => {
    // total = 1000; STOCK = 30% (300), FII = 70% (700)
    const result = calcAllocation(mockPositions)
    const stock = result.find((r) => r.category === 'STOCK')
    const fii = result.find((r) => r.category === 'FII')
    expect(stock?.percentage.toFixed(1)).toBe('30.0')
    expect(fii?.percentage.toFixed(1)).toBe('70.0')
  })

  it('ordena por value decrescente', () => {
    const result = calcAllocation(mockPositions)
    expect(result[0].category).toBe('FII')    // 700 > 300
    expect(result[1].category).toBe('STOCK')
  })

  it('retorna array vazio para carteira sem posições', () => {
    expect(calcAllocation([])).toHaveLength(0)
  })

  it('agrupa múltiplos ativos da mesma categoria', () => {
    const positions: Position[] = [
      ...mockPositions,
      {
        assetId: 'a3',
        ticker: 'VALE3',
        name: 'Vale',
        category: 'STOCK',
        assetClassCode: 'ACOES',
        quantity: new Decimal(5),
        avgCost: new Decimal(100),
        totalCost: new Decimal(500),
      },
    ]
    const result = calcAllocation(positions)
    const stock = result.find((r) => r.category === 'STOCK')
    expect(stock?.value.toString()).toBe('800') // 300 + 500
  })
})
