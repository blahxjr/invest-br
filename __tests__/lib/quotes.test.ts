import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import type { Position } from '@/modules/positions/types'
import { enrichWithQuotes } from '@/modules/positions/types'

describe('enrichWithQuotes', () => {
  const base: Position = {
    assetId: 'a1',
    ticker: 'PETR4',
    name: 'Petrobras',
    category: 'STOCK',
    assetClassCode: 'ACOES',
    quantity: new Decimal(10),
    avgCost: new Decimal(30),
    totalCost: new Decimal(300),
  }

  it('calcula currentValue, gainLoss e gainLossPercent corretamente', () => {
    const quotes = new Map([
      ['PETR4', { ticker: 'PETR4', price: 38.45, changePercent: 1.23, changedAt: new Date() }],
    ])

    const [result] = enrichWithQuotes([base], quotes)

    expect(result.currentValue?.toFixed(2)).toBe('384.50')
    expect(result.gainLoss?.toFixed(2)).toBe('84.50')
    expect(result.gainLossPercent?.toFixed(1)).toBe('28.2')
  })

  it('retorna campos null quando ticker nao e encontrado no mapa', () => {
    const [result] = enrichWithQuotes([base], new Map())

    expect(result.currentPrice).toBeNull()
    expect(result.currentValue).toBeNull()
    expect(result.gainLoss).toBeNull()
  })

  it('calcula P&L negativo quando currentValue e menor que totalCost', () => {
    const quotes = new Map([
      ['PETR4', { ticker: 'PETR4', price: 25.0, changePercent: -2.5, changedAt: new Date() }],
    ])

    const [result] = enrichWithQuotes([base], quotes)

    expect(result.gainLoss?.isNegative()).toBe(true)
    expect(result.gainLossPercent?.isNegative()).toBe(true)
  })

  it('define gainLossPercent como zero quando totalCost e zero', () => {
    const zeroPos: Position = {
      ...base,
      totalCost: new Decimal(0),
      avgCost: new Decimal(0),
    }

    const quotes = new Map([
      ['PETR4', { ticker: 'PETR4', price: 38.45, changePercent: 1.0, changedAt: new Date() }],
    ])

    const [result] = enrichWithQuotes([zeroPos], quotes)

    expect(result.gainLossPercent?.toString()).toBe('0')
  })
})
