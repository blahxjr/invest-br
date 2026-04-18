import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Decimal } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import {
  createTransaction,
  getTransactionsByAccount,
  getAccountBalance,
  getTransactionByReference,
  getAccountStatement,
} from '../../src/modules/transactions/service'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../helpers/fixtures'

// ── Fixtures ─────────────────────────────────────────────────────────────────
let userId: string
let portfolioId: string
let accountId: string
let petr4Id: string
let clientId: string
let institutionId: string
let assetClassId: string
const suiteId = uniqueSuffix()

beforeAll(async () => {
  // Cria estrutura mínima de suporte
  const user = await prisma.user.create({
    data: { email: `tx-test-${suiteId}@invest.br`, name: uniqueName('Ledger Test User') },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Carteira Teste Ledger'), userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { name: uniqueName('Cliente Ledger Teste'), userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: uniqueName('Instituição Ledger') },
  })
  institutionId = institution.id

  const assetClass = await prisma.assetClass.create({
    data: {
      name: uniqueName('Classe Ledger'),
      code: `TX_${suiteId.slice(0, 6).toUpperCase()}`,
      description: 'Classe para testes do módulo transactions',
    },
  })
  assetClassId = assetClass.id

  const stockAsset = await prisma.asset.create({
    data: {
      name: uniqueName('Ativo Ledger'),
      ticker: uniqueTicker('TXPET'),
      category: 'STOCK',
      assetClassId,
      currency: 'BRL',
      country: 'BR',
      recommendedHorizon: 'LONG',
    },
  })
  petr4Id = stockAsset.id

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

})

afterAll(async () => {
  // Limpa em ordem inversa de dependência (FK)
  await safeDeleteMany(prisma.ledgerEntry, { accountId })
  await safeDeleteMany(prisma.transaction, { accountId })
  await safeDeleteMany(prisma.account, { id: accountId })
  await safeDeleteMany(prisma.asset, { id: petr4Id })
  await safeDeleteMany(prisma.assetClass, { id: assetClassId })
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.institution, { id: institutionId })
  await safeDeleteMany(prisma.portfolio, { id: portfolioId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

// ── Testes ───────────────────────────────────────────────────────────────────

describe('createTransaction() — depósito inicial', () => {
  it('cria depósito de R$ 10.000 e gera partidas dobradas', async () => {
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
    expect(tx.ledgerEntries).toHaveLength(2)
    const debitTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.debit ?? 0), new Decimal(0))
    const creditTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.credit ?? 0), new Decimal(0))
    expect(debitTotal).toEqual(new Decimal('10000'))
    expect(creditTotal).toEqual(new Decimal('10000'))
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
    expect(tx.ledgerEntries).toHaveLength(2)
    const debitTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.debit ?? 0), new Decimal(0))
    const creditTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.credit ?? 0), new Decimal(0))
    expect(debitTotal).toEqual(new Decimal('3550'))
    expect(creditTotal).toEqual(new Decimal('3550'))
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
    expect(tx.ledgerEntries).toHaveLength(2)
    const debitTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.debit ?? 0), new Decimal(0))
    const creditTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.credit ?? 0), new Decimal(0))
    expect(debitTotal).toEqual(new Decimal('1900'))
    expect(creditTotal).toEqual(new Decimal('1900'))
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
    expect(tx.ledgerEntries).toHaveLength(2)
    const debitTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.debit ?? 0), new Decimal(0))
    const creditTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.credit ?? 0), new Decimal(0))
    expect(debitTotal).toEqual(new Decimal('150'))
    expect(creditTotal).toEqual(new Decimal('150'))
    expect(tx.idempotent).toBe(false)
  })
})

describe('createTransaction() — evento sem caixa', () => {
  it('registra subscricao sem gerar lancamento financeiro', async () => {
    const beforeBalance = await getAccountBalance(accountId)

    const tx = await createTransaction({
      referenceId: `subscricao-direito-001-${accountId}`,
      type: 'SUBSCRIPTION_RIGHT',
      accountId,
      assetId: petr4Id,
      quantity: 20,
      totalAmount: 0,
      date: new Date('2026-02-15'),
      sourceMovementType: 'Direitos de Subscrição',
      isIncoming: false,
      ledgerMovementType: 'Direitos de Subscrição',
      ledgerDescription: 'Credito de direito de subscricao',
    })

    const afterBalance = await getAccountBalance(accountId)

    expect(tx.type).toBe('SUBSCRIPTION_RIGHT')
    expect(tx.sourceMovementType).toBe('Direitos de Subscrição')
    expect(tx.ledgerEntries).toHaveLength(0)
    expect(afterBalance).toEqual(beforeBalance)
  })
})

describe('createTransaction() — renda fixa', () => {
  it('registra vencimento de renda fixa em partidas dobradas', async () => {
    const tx = await createTransaction({
      referenceId: `vencimento-rf-001-${accountId}`,
      type: 'MATURITY',
      accountId,
      totalAmount: 500,
      date: new Date('2026-02-20'),
      notes: 'Vencimento CDB',
    })

    expect(tx.ledgerEntries).toHaveLength(2)
    const debitTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.debit ?? 0), new Decimal(0))
    const creditTotal = tx.ledgerEntries.reduce((acc, e) => acc.plus(e.credit ?? 0), new Decimal(0))
    expect(debitTotal).toEqual(new Decimal('500'))
    expect(creditTotal).toEqual(new Decimal('500'))
  })
})

describe('createTransaction() — transferencia sem financeiro', () => {
  it('nao gera ledger para CUSTODY_TRANSFER', async () => {
    const tx = await createTransaction({
      referenceId: `custody-transfer-001-${accountId}`,
      type: 'CUSTODY_TRANSFER',
      accountId,
      assetId: petr4Id,
      quantity: 10,
      totalAmount: 0,
      date: new Date('2026-02-22'),
      notes: 'Transferencia de custodia',
    })

    expect(tx.ledgerEntries).toHaveLength(0)
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

    // Deve haver somente 2 LedgerEntries para o depósito (sem duplicata)
    const entries = await prisma.ledgerEntry.findMany({
      where: { transaction: { referenceId: `deposito-inicial-${accountId}` } },
    })
    expect(entries).toHaveLength(2)
  })
})

describe('getAccountBalance()', () => {
  it('retorna saldo correto consolidado de todas as entradas', async () => {
    const balance = await getAccountBalance(accountId)
    // 10000 (depósito) - 3550 (compra) + 1900 (venda) + 150 (dividendo) + 500 (vencimento) = 9000
    // Evento sem caixa não altera saldo
    expect(balance).toEqual(new Decimal('9000'))
  })
})

describe('getTransactionsByAccount()', () => {
  it('retorna transações da conta ordenadas por data desc', async () => {
    const txs = await getTransactionsByAccount(accountId)
    expect(txs.length).toBe(7)
    // Primeira é a mais recente (venda em fev/26)
    expect(txs[0].type).toBe('CUSTODY_TRANSFER')
  })
})

describe('getAccountStatement()', () => {
  it('retorna extrato com saldo acumulado e sem linhas de eventos sem caixa', async () => {
    const statement = await getAccountStatement(accountId)
    expect(statement.length).toBeGreaterThan(0)
    expect(statement.some((line) => line.description.includes('subscricao'))).toBe(false)

    const lastLine = statement.at(-1)
    expect(lastLine?.runningBalance).toEqual(new Decimal('9000'))
  })
})
