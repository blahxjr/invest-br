import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const tx = {
    assetClass: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    ledgerEntry: {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  }

  return {
    tx,
    prisma: {
      account: { findFirst: vi.fn() },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
    recalcPositions: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/modules/positions/service', () => ({
  recalcPositions: mocks.recalcPositions,
}))

import { confirmAndImportNegociacaoForUser } from '@/modules/b3/service'

function buildPayload(assetCount: number) {
  const resolutions = Array.from({ length: assetCount }).map((_, index) => {
    const ticker = `ATV${index}11`
    return {
      ticker,
      suggestedName: `${ticker} - FII`,
      inferredClass: 'FII' as const,
      inferredCategory: 'FII' as const,
      rows: [
        {
          date: new Date('2026-04-15T00:00:00.000Z'),
          type: 'BUY' as const,
          ticker,
          mercado: 'Mercado a Vista',
          instituicao: 'BTG',
          quantity: 1,
          price: 10,
          total: 10,
          referenceId: `ref-${ticker}`,
        },
      ],
      resolution: {
        action: 'create' as const,
        assetClassId: 'FII',
        name: ticker,
        category: 'FII' as const,
      },
    }
  })

  return {
    readyRows: [],
    classesToCreate: [],
    resolutions,
  }
}

describe('confirmAndImportNegociacaoForUser batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.prisma.account.findFirst.mockResolvedValue({ id: 'account-1' })

    mocks.prisma.$transaction.mockImplementation(async (callback, options) => {
      return callback(mocks.tx, options)
    })

    mocks.tx.assetClass.findMany.mockResolvedValue([{ id: 'class-fii', code: 'FII', name: 'Fundos Imobiliarios' }])

    mocks.tx.asset.findMany
      .mockResolvedValueOnce([])
      .mockImplementation(async ({ where }) => {
        const tickers = where.ticker.in as string[]
        return tickers.map((ticker, index) => ({ id: `asset-${index}`, ticker }))
      })

    mocks.tx.asset.createMany.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => resolve({ count: 120 }), 100)),
    )

    mocks.tx.transaction.findMany
      .mockResolvedValueOnce([])
      .mockImplementation(async ({ where }) => {
        const refs = where.referenceId.in as string[]
        return refs.map((referenceId, index) => ({ id: `tx-${index}`, referenceId }))
      })

    mocks.tx.transaction.createMany.mockImplementation(
      async () => new Promise((resolve) => setTimeout(() => resolve({ count: 120 }), 100)),
    )

    mocks.tx.ledgerEntry.findFirst.mockResolvedValue(null)
    mocks.tx.ledgerEntry.createMany.mockResolvedValue({ count: 120 })

    mocks.prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })
    mocks.recalcPositions.mockResolvedValue([])
  })

  it('completa importacao grande sem timeout e usa timeout configurado', async () => {
    const payload = buildPayload(120)

    const result = await confirmAndImportNegociacaoForUser('user-1', payload)

    expect(result.transactionsImported).toBe(120)
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
    const [, options] = mocks.prisma.$transaction.mock.calls[0]
    expect(options).toMatchObject({ timeout: 60000, maxWait: 10000 })
  })

  it('usa createMany em assets e transacoes em vez de upsert em loop', async () => {
    const payload = buildPayload(5)

    await confirmAndImportNegociacaoForUser('user-1', payload)

    expect(mocks.tx.asset.createMany).toHaveBeenCalled()
    expect(mocks.tx.transaction.createMany).toHaveBeenCalled()
    expect(mocks.tx.asset.upsert).not.toHaveBeenCalled()
  })

  it('cria audit log fora da transacao principal', async () => {
    const payload = buildPayload(2)

    await confirmAndImportNegociacaoForUser('user-1', payload)

    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled()
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('recalcula posicoes apos importacao com sucesso', async () => {
    const payload = buildPayload(2)

    await confirmAndImportNegociacaoForUser('user-1', payload)

    expect(mocks.recalcPositions).toHaveBeenCalledWith('account-1')
  })
})
