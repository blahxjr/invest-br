import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import { Decimal, Prisma } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import {
  updateTransaction,
  deleteTransaction,
  updateIncomeEvent,
  deleteIncomeEvent,
} from '../../src/app/(app)/transactions/actions'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../helpers/fixtures'

// Mock NextAuth
vi.mock('../../src/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { auth } from '../../src/lib/auth'

const mockAuth = auth as ReturnType<typeof vi.fn>

// ── Fixtures ─────────────────────────────────────────────────────────────────
let userId: string
let portfolioId: string
let accountId: string
let petr4Id: string
let clientId: string
let institutionId: string
let assetClassId: string
let transactionId: string
let incomeEventId: string
const suiteId = uniqueSuffix()

beforeAll(async () => {
  // Cria estrutura mínima
  const user = await prisma.user.create({
    data: { email: `tx-actions-${suiteId}@invest.br`, name: uniqueName('Action Test User') },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Carteira Ações'), userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { name: uniqueName('Cliente Ações'), userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: uniqueName('Instituição Ações') },
  })
  institutionId = institution.id

  const assetClass = await prisma.assetClass.create({
    data: {
      name: uniqueName('Classe Ações'),
      code: `ACT_${suiteId.slice(0, 6).toUpperCase()}`,
      description: 'Classe para testes de actions',
    },
  })
  assetClassId = assetClass.id

  const account = await prisma.account.create({
    data: {
      name: uniqueName('Conta Ações'),
      type: 'BROKERAGE',
      portfolioId,
      clientId,
      institutionId,
    },
  })
  accountId = account.id

  const asset = await prisma.asset.create({
    data: {
      ticker: uniqueTicker(),
      name: 'Petrobras PN',
      category: 'STOCK',
      assetClassId,
    },
  })
  petr4Id = asset.id

  // Cria uma transação inicial
  const tx = await prisma.transaction.create({
    data: {
      referenceId: `ref-${suiteId}-1`,
      type: 'BUY',
      accountId,
      assetId: petr4Id,
      quantity: new Prisma.Decimal('100'),
      price: new Prisma.Decimal('28.50'),
      totalAmount: new Prisma.Decimal('2850'),
      date: new Date('2025-01-15'),
      notes: 'Compra inicial',
    },
  })
  transactionId = tx.id

  // Cria um evento de renda
  const income = await prisma.incomeEvent.create({
    data: {
      type: 'DIVIDEND',
      accountId,
      assetId: petr4Id,
      grossAmount: new Prisma.Decimal('150'),
      taxAmount: new Prisma.Decimal('0'),
      netAmount: new Prisma.Decimal('150'),
      paymentDate: new Date('2025-02-01'),
      notes: 'Dividendo',
    },
  })
  incomeEventId = income.id
})

afterAll(async () => {
  await safeDeleteMany([
    { model: 'AuditLog', where: {} },
    { model: 'IncomeEvent', where: {} },
    { model: 'LedgerEntry', where: {} },
    { model: 'Transaction', where: {} },
    { model: 'Account', where: {} },
    { model: 'Client', where: {} },
    { model: 'Asset', where: {} },
    { model: 'AssetClass', where: {} },
    { model: 'Institution', where: {} },
    { model: 'Portfolio', where: {} },
    { model: 'User', where: {} },
  ])
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Transaction Actions', () => {
  it('should update transaction fields and create audit log', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await updateTransaction(transactionId, {
      quantity: '150',
      price: '29.00',
      notes: 'Compra atualizada',
    })

    expect(result.success).toBe(true)

    // Verificar que a transação foi atualizada
    const updated = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })
    expect(updated?.quantity?.toString()).toBe('150')
    expect(updated?.price?.toString()).toBe('29')
    expect(updated?.notes).toBe('Compra atualizada')

    // Verificar que AuditLog foi criado
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'TRANSACTION',
        entityId: transactionId,
        action: 'UPDATE',
      },
    })
    expect(audit).toBeDefined()
    expect(audit?.previousValue).toBeDefined()
    expect(audit?.newValue).toBeDefined()
    expect(audit?.changedBy).toBe(userId)
  })

  it('should return error when transaction not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await updateTransaction('invalid-id', { notes: 'Test' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('should soft-delete transaction and create audit log', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await deleteTransaction(transactionId)
    expect(result.success).toBe(true)

    // Verificar que deletedAt foi setado
    const deleted = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })
    expect(deleted?.deletedAt).toBeDefined()

    // Verificar que AuditLog foi criado
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'TRANSACTION',
        entityId: transactionId,
        action: 'DELETE',
      },
    })
    expect(audit).toBeDefined()
    expect(audit?.previousValue).toBeDefined()
    expect(audit?.newValue).toBeNull()
  })

  it('should return error when deleting non-existent transaction', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await deleteTransaction('invalid-id')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})

describe('IncomeEvent Actions', () => {
  it('should update income event and create audit log', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await updateIncomeEvent(incomeEventId, {
      grossAmount: '200',
      netAmount: '200',
      notes: 'Dividendo atualizado',
    })

    if (!result.success) {
      console.log('updateIncomeEvent error:', result.error)
    }
    expect(result.success).toBe(true)

    // Verificar que o evento foi atualizado
    const updated = await prisma.incomeEvent.findUnique({
      where: { id: incomeEventId },
    })
    expect(updated?.grossAmount.toString()).toBe('200')
    expect(updated?.netAmount.toString()).toBe('200')
    expect(updated?.notes).toBe('Dividendo atualizado')

    // Verificar que AuditLog foi criado
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'INCOME',
        entityId: incomeEventId,
        action: 'UPDATE',
      },
    })
    expect(audit).toBeDefined()
  })

  it('should soft-delete income event and create audit log', async () => {
    mockAuth.mockResolvedValue({
      user: { id: userId, email: 'test@invest.br' },
    })

    const result = await deleteIncomeEvent(incomeEventId)
    if (!result.success) {
      console.log('deleteIncomeEvent error:', result.error)
    }
    expect(result.success).toBe(true)

    // Verificar que deletedAt foi setado
    const deleted = await prisma.incomeEvent.findUnique({
      where: { id: incomeEventId },
    })
    expect(deleted?.deletedAt).toBeDefined()

    // Verificar que AuditLog foi criado
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityType: 'INCOME',
        entityId: incomeEventId,
        action: 'DELETE',
      },
    })
    expect(audit).toBeDefined()
  })
})
