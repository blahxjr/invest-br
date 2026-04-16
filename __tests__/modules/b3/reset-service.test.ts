import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    auditLog: { deleteMany: vi.fn() },
    ledgerEntry: { deleteMany: vi.fn() },
    incomeEvent: { deleteMany: vi.fn() },
    rentalReceipt: { deleteMany: vi.fn() },
    transaction: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    institution: { deleteMany: vi.fn() },
    asset: { deleteMany: vi.fn() },
    assetClass: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}))

import { resetImportData } from '@/modules/b3/reset-service'

describe('resetImportData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.auditLog.deleteMany.mockResolvedValue({ count: 4 })
    mocks.prisma.ledgerEntry.deleteMany.mockResolvedValue({ count: 5 })
    mocks.prisma.incomeEvent.deleteMany.mockResolvedValue({ count: 2 })
    mocks.prisma.rentalReceipt.deleteMany.mockResolvedValue({ count: 1 })
    mocks.prisma.transaction.deleteMany.mockResolvedValue({ count: 8 })
    mocks.prisma.account.deleteMany.mockResolvedValue({ count: 3 })
    mocks.prisma.institution.deleteMany.mockResolvedValue({ count: 2 })
    mocks.prisma.asset.deleteMany.mockResolvedValue({ count: 6 })
    mocks.prisma.assetClass.findMany.mockResolvedValue([{ id: 'class-1' }])
    mocks.prisma.assetClass.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('remove dados na ordem esperada e retorna o resumo consolidado', async () => {
    const result = await resetImportData()

    expect(result).toEqual({
      auditLogsDeleted: 4,
      ledgerEntriesDeleted: 5,
      incomeEventsDeleted: 2,
      rentalReceiptsDeleted: 1,
      transactionsDeleted: 8,
      accountsDeleted: 3,
      institutionsDeleted: 2,
      assetsDeleted: 6,
      assetClassesDeleted: 1,
    })

    expect(mocks.prisma.asset.deleteMany).toHaveBeenCalledWith({
      where: { ticker: { not: null } },
    })
    expect(mocks.prisma.assetClass.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          notIn: ['class-1'],
        },
      },
    })
  })
})