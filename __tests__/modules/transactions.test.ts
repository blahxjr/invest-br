import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Decimal } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import {
  createTransaction,
  getTransactionsByAccount,
  getAccountBalance,
  getTransactionByReference,
} from '../../src/modules/transactions/service'

// ── Fixtures ─────────────────────────────────────────────────────────────────
let userId: string
let portfolioId: string
let accountId: string
let petr4Id: string
let clientId: string
let institutionId: string

beforeAll(async () => {
  // Cria estrutura mínima de suporte
  const user = await prisma.user.create({
    data: { email: `tx-test-${Date.now()}@invest.br`, name: 'Ledger Test User' },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: 'Carteira Teste Ledger', userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { name: 'Cliente Ledger Teste', userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: `Instituição Ledger ${Date.now()}` },
  })
  institutionId = institution.id

  const account = await prisma.account.create({
    data: {
      name: 'Conta XP Teste',
      type: 'BROKERAGE',
      portfolioId,
      clientId,
      institutionId,
    },
  })
  accountId = account.id

  // Usa PETR4 já do seed — localiza pelo ticker
  const petr4 = await prisma.asset.findUnique({ where: { ticker: 'PETR4' } })
  if (!petr4) throw new Error('PETR4 não encontrado — rode pnpm db:seed antes dos testes')
  petr4Id = petr4.id
})

afterAll(async () => {
  // Limpa em ordem inversa de dependência (FK)
  await prisma.ledgerEntry.deleteMany({ where: { accountId } })
  await prisma.transaction.deleteMany({ where: { accountId } })
  await prisma.account.delete({ where: { id: accountId } })
  await prisma.client.delete({ where: { id: clientId } })
  await prisma.institution.delete({ where: { id: institutionId } })
  await prisma.portfolio.delete({ where: { id: portfolioId } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

// ── Testes ───────────────────────────────────────────────────────────────────

describe('createTransaction() — depósito inicial', () => {
  it('cria depósito de R$ 10.000 e gera ledger entry com crédito', async () => {
    const tx = await createTransaction({
      referenceId: `deposito-inicial-${accountId}`,
      type: 'DEPOSIT',
      accountId,
      totalAmount: 10000,
      date: new Date('2026-01-10'),
      notes: 'Aporte inicial',
    })

    expect(tx.idempotent).toBe(false)
    expect(tx.type).toBe('DEPOSIT')
    expect(tx.totalAmount).toEqual(new Decimal('10000'))
    expect(tx.ledgerEntries).toHaveLength(1)
    expect(tx.ledgerEntries[0].credit).toEqual(new Decimal('10000'))
    expect(tx.ledgerEntries[0].debit).toBeNull()
    expect(tx.ledgerEntries[0].balanceAfter).toEqual(new Decimal('10000'))
  })
})

describe('createTransaction() — compra PETR4', () => {
  it('compra 100 PETR4 @ R$ 35,50 e debita R$ 3.550 do saldo', async () => {
    const tx = await createTransaction({
      referenceId: `compra-petr4-001-${accountId}`,
      type: 'BUY',
      accountId,
      assetId: petr4Id,
      quantity: 100,
      price: 35.50,
      totalAmount: 3550,
      date: new Date('2026-01-15'),
    })

    expect(tx.idempotent).toBe(false)
    expect(tx.type).toBe('BUY')
    expect(tx.quantity).toEqual(new Decimal('100'))
    expect(tx.price).toEqual(new Decimal('35.5'))
    expect(tx.totalAmount).toEqual(new Decimal('3550'))
    expect(tx.ledgerEntries[0].debit).toEqual(new Decimal('3550'))
    expect(tx.ledgerEntries[0].credit).toBeNull()
    // Saldo: 10000 - 3550 = 6450
    expect(tx.ledgerEntries[0].balanceAfter).toEqual(new Decimal('6450'))
  })
})

describe('createTransaction() — venda parcial PETR4', () => {
  it('vende 50 PETR4 @ R$ 38,00 e credita R$ 1.900 ao saldo', async () => {
    const tx = await createTransaction({
      referenceId: `venda-petr4-001-${accountId}`,
      type: 'SELL',
      accountId,
      assetId: petr4Id,
      quantity: 50,
      price: 38.00,
      totalAmount: 1900,
      date: new Date('2026-02-10'),
    })

    expect(tx.type).toBe('SELL')
    expect(tx.ledgerEntries[0].credit).toEqual(new Decimal('1900'))
    // Saldo: 6450 + 1900 = 8350
    expect(tx.ledgerEntries[0].balanceAfter).toEqual(new Decimal('8350'))
  })
})

describe('createTransaction() — dividendo PETR4', () => {
  it('registra dividendo de R$ 150 como crédito na conta', async () => {
    const tx = await createTransaction({
      referenceId: `dividendo-petr4-jan26-${accountId}`,
      type: 'DIVIDEND',
      accountId,
      assetId: petr4Id,
      totalAmount: 150,
      date: new Date('2026-01-31'),
      notes: 'Dividendo PETR4 jan/2026',
    })

    expect(tx.type).toBe('DIVIDEND')
    expect(tx.assetId).toBe(petr4Id)
    expect(tx.ledgerEntries[0].credit).toEqual(new Decimal('150'))
    // Saldo: 8350 + 150 = 8500
    expect(tx.ledgerEntries[0].balanceAfter).toEqual(new Decimal('8500'))
    expect(tx.idempotent).toBe(false)
  })
})

describe('Idempotência', () => {
  it('retorna transação existente sem criar duplicata quando referenceId repetido', async () => {
    // segunda chamada com o mesmo referenceId do depósito
    const duplicate = await createTransaction({
      referenceId: `deposito-inicial-${accountId}`,
      type: 'DEPOSIT',
      accountId,
      totalAmount: 10000,
      date: new Date('2026-01-10'),
    })

    expect(duplicate.idempotent).toBe(true)
    expect(duplicate.type).toBe('DEPOSIT')

    // Deve haver somente 1 LedgerEntry para o depósito (sem duplicata)
    const entries = await prisma.ledgerEntry.findMany({
      where: { transaction: { referenceId: `deposito-inicial-${accountId}` } },
    })
    expect(entries).toHaveLength(1)
  })
})

describe('getAccountBalance()', () => {
  it('retorna saldo correto consolidado de todas as entradas', async () => {
    const balance = await getAccountBalance(accountId)
    // 10000 (depósito) - 3550 (compra) + 1900 (venda) + 150 (dividendo) = 8500
    expect(balance).toEqual(new Decimal('8500'))
  })
})

describe('getTransactionsByAccount()', () => {
  it('retorna 4 transações da conta ordenadas por data desc', async () => {
    const txs = await getTransactionsByAccount(accountId)
    expect(txs.length).toBe(4)
    // Primeira é a mais recente (venda em fev/26)
    expect(txs[0].type).toBe('SELL')
  })
})
