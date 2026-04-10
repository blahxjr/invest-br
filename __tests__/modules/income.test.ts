import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Decimal } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { createTransaction } from '../../src/modules/transactions/service'
import {
  createIncomeEvent,
  createRentalReceipt,
  getIncomeEventsByAccount,
  getTotalIncomeByAccount,
  calculatePositionByAsset,
  getPositionsByAccount,
} from '../../src/modules/income/service'

// ── Fixtures ─────────────────────────────────────────────────────────────────
let userId: string
let portfolioId: string
let accountId: string
let petr4Id: string
let xpml11Id: string
let clientId: string
let institutionId: string

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `income-test-${Date.now()}@invest.br`, name: 'Income Test User' },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: 'Carteira Income Teste', userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { name: 'Cliente Income Teste', userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: `Instituição Income ${Date.now()}` },
  })
  institutionId = institution.id

  const account = await prisma.account.create({
    data: {
      name: 'Conta Income Teste',
      type: 'BROKERAGE',
      portfolioId,
      clientId,
      institutionId,
    },
  })
  accountId = account.id

  // Usa ativos já populados pelo seed
  const petr4 = await prisma.asset.findUnique({ where: { ticker: 'PETR4' } })
  if (!petr4) throw new Error('PETR4 não encontrado — rode pnpm db:seed antes dos testes')
  petr4Id = petr4.id

  const xpml11 = await prisma.asset.findUnique({ where: { ticker: 'XPML11' } })
  if (!xpml11) throw new Error('XPML11 não encontrado — rode pnpm db:seed antes dos testes')
  xpml11Id = xpml11.id

  // Prepara saldo inicial para suportar operações de compra
  await createTransaction({
    referenceId: `deposito-income-${accountId}`,
    type: 'DEPOSIT',
    accountId,
    totalAmount: 50000,
    date: new Date('2026-01-01'),
  })
})

afterAll(async () => {
  await prisma.incomeEvent.deleteMany({ where: { accountId } })
  await prisma.rentalReceipt.deleteMany({ where: { accountId } })
  await prisma.ledgerEntry.deleteMany({ where: { accountId } })
  await prisma.transaction.deleteMany({ where: { accountId } })
  await prisma.account.delete({ where: { id: accountId } })
  await prisma.client.delete({ where: { id: clientId } })
  await prisma.institution.delete({ where: { id: institutionId } })
  await prisma.portfolio.delete({ where: { id: portfolioId } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

// ── Testes — Income Events ────────────────────────────────────────────────────

describe('createIncomeEvent() — dividendo PETR4', () => {
  it('registra dividendo líquido de R$ 85,00 com IR retido de R$ 15,00', async () => {
    const event = await createIncomeEvent({
      type: 'DIVIDEND',
      accountId,
      assetId: petr4Id,
      grossAmount: 100,
      taxAmount: 15,
      netAmount: 85,
      paymentDate: new Date('2026-03-15'),
      notes: 'Dividendo trimestral PETR4',
    })

    expect(event.type).toBe('DIVIDEND')
    expect(event.accountId).toBe(accountId)
    expect(event.assetId).toBe(petr4Id)
    expect(event.grossAmount).toEqual(new Decimal('100'))
    expect(event.taxAmount).toEqual(new Decimal('15'))
    expect(event.netAmount).toEqual(new Decimal('85'))
    expect(event.notes).toBe('Dividendo trimestral PETR4')
  })
})

describe('createIncomeEvent() — rendimento FII (FII_RENT)', () => {
  it('registra rendimento mensal de FII sem IR (isento para PF)', async () => {
    const event = await createIncomeEvent({
      type: 'FII_RENT',
      accountId,
      assetId: xpml11Id,
      grossAmount: 220.5,
      taxAmount: 0,
      netAmount: 220.5,
      paymentDate: new Date('2026-03-10'),
    })

    expect(event.type).toBe('FII_RENT')
    expect(event.netAmount).toEqual(new Decimal('220.5'))
    expect(event.taxAmount).toEqual(new Decimal('0'))
    expect(event.asset?.ticker).toBe('XPML11')
  })
})

describe('getIncomeEventsByAccount()', () => {
  it('retorna todos os eventos de renda ordenados por data desc', async () => {
    const events = await getIncomeEventsByAccount(accountId)

    expect(events.length).toBeGreaterThanOrEqual(2)
    // Deve estar em ordem decrescente
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].paymentDate.getTime()).toBeGreaterThanOrEqual(
        events[i].paymentDate.getTime(),
      )
    }
  })
})

describe('getTotalIncomeByAccount()', () => {
  it('soma todos os rendimentos líquidos da conta', async () => {
    const total = await getTotalIncomeByAccount(accountId)

    // 85 (DIVIDEND) + 220.5 (FII_RENT) = 305.5
    expect(total.greaterThanOrEqualTo(new Decimal('305.5'))).toBe(true)
  })
})

// ── Testes — Rental Receipts ─────────────────────────────────────────────────

describe('createRentalReceipt()', () => {
  it('registra recibo de aluguel imobiliário com despesas', async () => {
    const receipt = await createRentalReceipt({
      propertyName: 'Ap. Moema 42',
      accountId,
      grossRent: 3500,
      expenses: 320.75,
      netRent: 3179.25,
      paymentDate: new Date('2026-03-05'),
    })

    expect(receipt.propertyName).toBe('Ap. Moema 42')
    expect(receipt.grossRent).toEqual(new Decimal('3500'))
    expect(receipt.expenses).toEqual(new Decimal('320.75'))
    expect(receipt.netRent).toEqual(new Decimal('3179.25'))
    expect(receipt.accountId).toBe(accountId)
  })
})

// ── Testes — Cálculo de Posição ───────────────────────────────────────────────

describe('calculatePositionByAsset() — apenas compras', () => {
  it('calcula posição correta após 2 compras de PETR4', async () => {
    // Compra 1: 100 unidades @ R$ 35,00
    await createTransaction({
      referenceId: `compra-petr4-pos-1-${accountId}`,
      type: 'BUY',
      accountId,
      assetId: petr4Id,
      quantity: 100,
      price: 35.0,
      totalAmount: 3500,
      date: new Date('2026-01-10'),
    })

    // Compra 2: 50 unidades @ R$ 40,00
    await createTransaction({
      referenceId: `compra-petr4-pos-2-${accountId}`,
      type: 'BUY',
      accountId,
      assetId: petr4Id,
      quantity: 50,
      price: 40.0,
      totalAmount: 2000,
      date: new Date('2026-02-01'),
    })

    const position = await calculatePositionByAsset(accountId, petr4Id)

    expect(position).not.toBeNull()
    expect(position!.ticker).toBe('PETR4')
    expect(position!.quantity).toEqual(new Decimal('150'))

    // Custo médio = (100×35 + 50×40) / 150 = 5500 / 150 ≈ 36.6666...
    const expectedAvgCost = new Decimal(5500).div(new Decimal(150))
    expect(position!.averageCost.toFixed(4)).toBe(expectedAvgCost.toFixed(4))
    expect(position!.totalCost.toFixed(2)).toBe(new Decimal('5500').toFixed(2))
    expect(position!.buyCount).toBe(2)
    expect(position!.sellCount).toBe(0)
  })
})

describe('calculatePositionByAsset() — compra e venda parcial', () => {
  it('reduz quantidade após venda parcial e mantém custo médio', async () => {
    // Vende 50 de PETR4 (tinha 150 antes deste describe)
    await createTransaction({
      referenceId: `venda-petr4-pos-1-${accountId}`,
      type: 'SELL',
      accountId,
      assetId: petr4Id,
      quantity: 50,
      price: 38.0,
      totalAmount: 1900,
      date: new Date('2026-03-01'),
    })

    const position = await calculatePositionByAsset(accountId, petr4Id)

    expect(position!.quantity).toEqual(new Decimal('100'))
    // Custo médio não muda na venda — permanece ≈ 36.6666
    const expectedAvgCost = new Decimal(5500).div(new Decimal(150))
    expect(position!.averageCost.toFixed(4)).toBe(expectedAvgCost.toFixed(4))
    expect(position!.sellCount).toBe(1)
  })
})

describe('getPositionsByAccount()', () => {
  it('lista posições abertas da conta (qty > 0)', async () => {
    const positions = await getPositionsByAccount(accountId)

    // Deve incluir PETR4 (qty 100) mas não ativos sem transações
    expect(positions.length).toBeGreaterThanOrEqual(1)
    const petr4Pos = positions.find((p) => p.ticker === 'PETR4')
    expect(petr4Pos).toBeDefined()
    expect(petr4Pos!.quantity.greaterThan(0)).toBe(true)
  })
})
