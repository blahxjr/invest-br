import Decimal from 'decimal.js'
import { calcSnapshotsFromTxs } from '@/modules/positions/history'

const assetA = {
  id: 'a1',
  ticker: 'PETR4',
  name: 'Petrobras',
  category: 'STOCK' as const,
  assetClass: { code: 'ACOES' },
}

const assetB = {
  id: 'a2',
  ticker: 'HGLG11',
  name: 'CSHG Logistica',
  category: 'FII' as const,
  assetClass: { code: 'FII' },
}

const mockAccount = {
  id: 'account-1',
  name: 'Nu Invest',
  institution: {
    id: 'inst-1',
    name: 'Nu Pagamentos',
  },
}

describe('calcSnapshotsFromTxs', () => {
  it('retorna snapshot zero para datas antes da primeira transacao', () => {
    const txs = [
      {
        type: 'BUY' as const,
        quantity: new Decimal(10),
        totalAmount: new Decimal(300),
        date: new Date('2026-01-10T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
    ]

    const snapshots = calcSnapshotsFromTxs(txs, [new Date('2026-01-01T23:59:59Z')])

    expect(snapshots[0].totalCost.toString()).toBe('0')
    expect(snapshots[0].assetCount).toBe(0)
  })

  it('acumula corretamente apos 2 BUYs', () => {
    const txs = [
      {
        type: 'BUY' as const,
        quantity: new Decimal(10),
        totalAmount: new Decimal(300),
        date: new Date('2026-01-10T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
      {
        type: 'BUY' as const,
        quantity: new Decimal(5),
        totalAmount: new Decimal(700),
        date: new Date('2026-01-15T10:00:00Z'),
        asset: assetB,
        account: mockAccount,
      },
    ]

    const snapshots = calcSnapshotsFromTxs(txs, [new Date('2026-01-15T23:59:59Z')])

    expect(snapshots[0].totalCost.toString()).toBe('1000')
    expect(snapshots[0].assetCount).toBe(2)
  })

  it('reduz totalCost apos SELL parcial', () => {
    const txs = [
      {
        type: 'BUY' as const,
        quantity: new Decimal(10),
        totalAmount: new Decimal(300),
        date: new Date('2026-01-10T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
      {
        type: 'SELL' as const,
        quantity: new Decimal(3),
        totalAmount: new Decimal(90),
        date: new Date('2026-01-20T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
    ]

    const snapshots = calcSnapshotsFromTxs(txs, [new Date('2026-01-20T23:59:59Z')])

    expect(snapshots[0].totalCost.toString()).toBe('210')
    expect(snapshots[0].assetCount).toBe(1)
  })

  it('remove ativo zerado do snapshot', () => {
    const txs = [
      {
        type: 'BUY' as const,
        quantity: new Decimal(5),
        totalAmount: new Decimal(500),
        date: new Date('2026-01-10T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
      {
        type: 'SELL' as const,
        quantity: new Decimal(5),
        totalAmount: new Decimal(550),
        date: new Date('2026-01-20T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
    ]

    const snapshots = calcSnapshotsFromTxs(txs, [new Date('2026-01-20T23:59:59Z')])

    expect(snapshots[0].totalCost.toString()).toBe('0')
    expect(snapshots[0].assetCount).toBe(0)
  })

  it('calcula multiplos ativos independentemente em cada snapshot', () => {
    const txs = [
      {
        type: 'BUY' as const,
        quantity: new Decimal(2),
        totalAmount: new Decimal(100),
        date: new Date('2026-01-10T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
      {
        type: 'BUY' as const,
        quantity: new Decimal(4),
        totalAmount: new Decimal(400),
        date: new Date('2026-01-11T10:00:00Z'),
        asset: assetB,
        account: mockAccount,
      },
      {
        type: 'SELL' as const,
        quantity: new Decimal(1),
        totalAmount: new Decimal(60),
        date: new Date('2026-01-12T10:00:00Z'),
        asset: assetA,
        account: mockAccount,
      },
    ]

    const snapshots = calcSnapshotsFromTxs(txs, [new Date('2026-01-12T23:59:59Z')])

    expect(snapshots[0].totalCost.toString()).toBe('450')
    expect(snapshots[0].assetCount).toBe(2)
  })
})
