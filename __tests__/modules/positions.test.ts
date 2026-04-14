import Decimal from 'decimal.js'
import { calcPositions } from '@/modules/positions/service'

describe('calcPositions', () => {
  const assetA = {
    id: 'a1',
    ticker: 'HGLG11',
    name: 'CSHG Logistica',
    category: 'FII' as const,
    assetClass: { code: 'FII' },
  }

  const assetB = {
    id: 'a2',
    ticker: 'GGRC11',
    name: 'GGR Covepi',
    category: 'FII' as const,
    assetClass: { code: 'FII' },
  }

  it('calcula custo medio ponderado para 2 compras do mesmo ativo', () => {
    const txs = [
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(2), totalAmount: new Decimal('312.08'), date: new Date('2026-03-27') },
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(2), totalAmount: new Decimal('311.68'), date: new Date('2026-03-31') },
    ]

    const result = calcPositions(txs)

    expect(result[0].quantity.toString()).toBe('4')
    expect(result[0].avgCost.toFixed(2)).toBe('155.94')
    expect(result[0].totalCost.toFixed(2)).toBe('623.76')
  })

  it('remove ativo quando todas as cotas sao vendidas', () => {
    const txs = [
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(5), totalAmount: new Decimal('500'), date: new Date('2026-01-01') },
      { type: 'SELL' as const, asset: assetA, quantity: new Decimal(5), totalAmount: new Decimal('550'), date: new Date('2026-01-02') },
    ]

    const result = calcPositions(txs)

    expect(result).toHaveLength(0)
  })

  it('mantem custo medio apos venda parcial', () => {
    const txs = [
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(10), totalAmount: new Decimal('100'), date: new Date('2026-01-01') },
      { type: 'SELL' as const, asset: assetA, quantity: new Decimal(3), totalAmount: new Decimal('33'), date: new Date('2026-01-02') },
    ]

    const result = calcPositions(txs)

    expect(result[0].quantity.toString()).toBe('7')
    expect(result[0].avgCost.toFixed(2)).toBe('10.00')
    expect(result[0].totalCost.toFixed(2)).toBe('70.00')
  })

  it('calcula multiplos ativos independentemente', () => {
    const txs = [
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(2), totalAmount: new Decimal('312.08'), date: new Date('2026-01-01') },
      { type: 'BUY' as const, asset: assetB, quantity: new Decimal(33), totalAmount: new Decimal('324.39'), date: new Date('2026-01-02') },
    ]

    const result = calcPositions(txs)

    expect(result).toHaveLength(2)
  })

  it('ordena por totalCost decrescente', () => {
    const txs = [
      { type: 'BUY' as const, asset: assetA, quantity: new Decimal(1), totalAmount: new Decimal('100'), date: new Date('2026-01-01') },
      { type: 'BUY' as const, asset: assetB, quantity: new Decimal(1), totalAmount: new Decimal('500'), date: new Date('2026-01-02') },
    ]

    const result = calcPositions(txs)

    expect(result[0].totalCost.gt(result[1].totalCost)).toBe(true)
  })
})
