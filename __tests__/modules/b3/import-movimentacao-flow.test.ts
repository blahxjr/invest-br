import type { TransactionType } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { importMovimentacaoRows } from '@/modules/b3/service'
import type { MovimentacaoReviewRow } from '@/modules/b3/parser'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
let createdClientId: string | null = null
let existingInstitutionId: string | null = null
let existingAccountId: string | null = null
const createdTickers: string[] = []

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `mov-flow-${suiteId}@invest.br`,
      name: uniqueName('Mov Flow User'),
    },
  })
  userId = user.id

  await prisma.assetClass.upsert({
    where: { code: 'ACOES' },
    update: {},
    create: { code: 'ACOES', name: 'Acoes' },
  })

  await prisma.assetClass.upsert({
    where: { code: 'FII' },
    update: {},
    create: { code: 'FII', name: 'Fundos Imobiliarios' },
  })
})

afterAll(async () => {
  const client = await prisma.client.findFirst({
    where: { userId },
    select: { id: true },
  })

  if (client?.id) {
    createdClientId = client.id
  }

  const accountIds = createdClientId
    ? (await prisma.account.findMany({ where: { clientId: createdClientId }, select: { id: true } })).map((item) => item.id)
    : []

  await safeDeleteMany(prisma.auditLog, { changedBy: userId })

  if (accountIds.length > 0) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.transaction, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.account, { id: { in: accountIds } })
  }

  if (existingInstitutionId) {
    await safeDeleteMany(prisma.institution, { id: existingInstitutionId })
  }

  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })

  if (createdClientId) {
    await safeDeleteMany(prisma.client, { id: createdClientId })
  }

  await safeDeleteMany(prisma.portfolio, { userId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

function buildRow(input: {
  ticker: string
  instituicao: string
  referenceId: string
  type?: TransactionType
  sourceMovementType?: string
  isIncoming?: boolean
  isTaxExempt?: boolean
  quantity?: number
  price?: number | null
  total?: number
}) {
  return {
    date: new Date('2026-04-16T00:00:00.000Z'),
    type: input.type ?? 'DIVIDEND',
    ticker: input.ticker,
    instituicao: input.instituicao,
    quantity: input.quantity ?? 10,
    price: input.price ?? 1,
    total: input.total ?? 10,
    referenceId: input.referenceId,
    sourceMovementType: input.sourceMovementType ?? 'Rendimento',
    isIncoming: input.isIncoming ?? true,
    isTaxExempt: input.isTaxExempt ?? false,
    subscriptionDeadline: null,
  }
}

function scopedReferenceId(referenceId: string): string {
  return `usr:${userId}:${referenceId}`
}

describe('importMovimentacaoRows', () => {
  it('cria estrutura minima automaticamente para usuario sem conta previa', async () => {
    const ticker = uniqueTicker('MOVA')
    createdTickers.push(ticker)

    const result = await importMovimentacaoRows(userId, [
      buildRow({
        ticker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: `ref-${ticker}-1`,
      }),
    ])

    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)

    const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } })
    expect(client?.id).toBeTruthy()

    const institution = await prisma.institution.findFirst({
      where: { name: 'CORRETORA FLOW TESTE S.A.' },
      select: { id: true },
    })
    expect(institution?.id).toBeTruthy()

    const account = await prisma.account.findFirst({
      where: {
        clientId: client?.id,
        institutionId: institution?.id,
      },
      select: { id: true },
    })
    expect(account?.id).toBeTruthy()

    existingInstitutionId = institution?.id ?? null
    existingAccountId = account?.id ?? null
  })

  it('reutiliza conta existente para a mesma instituicao', async () => {
    const ticker = uniqueTicker('MOVB')
    createdTickers.push(ticker)

    const first = await importMovimentacaoRows(userId, [
      buildRow({
        ticker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: `ref-${ticker}-1`,
      }),
    ])

    const secondTicker = uniqueTicker('MOVC')
    createdTickers.push(secondTicker)

    const second = await importMovimentacaoRows(userId, [
      buildRow({
        ticker: secondTicker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: `ref-${secondTicker}-1`,
      }),
    ])

    expect(first.imported).toBe(1)
    expect(second.imported).toBe(1)

    const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } })
    const institution = await prisma.institution.findFirst({
      where: { name: 'CORRETORA FLOW TESTE S.A.' },
      select: { id: true },
    })

    const accounts = await prisma.account.findMany({
      where: {
        clientId: client?.id,
        institutionId: institution?.id,
      },
      select: { id: true },
    })

    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.id).toBe(existingAccountId)
  })

  it('mantem idempotencia e nao duplica transacoes', async () => {
    const ticker = uniqueTicker('MOVD')
    createdTickers.push(ticker)
    const referenceId = `ref-${ticker}-idem`

    const first = await importMovimentacaoRows(userId, [
      buildRow({ ticker, instituicao: 'CORRETORA FLOW TESTE S.A.', referenceId }),
    ])

    const second = await importMovimentacaoRows(userId, [
      buildRow({ ticker, instituicao: 'CORRETORA FLOW TESTE S.A.', referenceId }),
    ])

    expect(first.imported).toBe(1)
    expect(second.imported).toBe(0)
    expect(second.skipped).toBe(1)
  })

  it('preenche metadados contabeis para compra de FII e rendimento isento', async () => {
    const buyTicker = uniqueTicker('MXRF')
    const incomeTicker = `${uniqueTicker('HGLG').slice(0, 4)}11`
    createdTickers.push(buyTicker, incomeTicker)

    const buyReferenceId = `ref-${buyTicker}-buy`
    const incomeReferenceId = `ref-${incomeTicker}-income`

    const buyResult = await importMovimentacaoRows(userId, [
      buildRow({
        ticker: buyTicker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: buyReferenceId,
        type: 'BUY',
        sourceMovementType: 'Transferência - Liquidação',
        isIncoming: false,
        quantity: 20,
        price: 10,
        total: 200,
      }),
    ])

    const incomeResult = await importMovimentacaoRows(userId, [
      buildRow({
        ticker: incomeTicker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: incomeReferenceId,
        type: 'DIVIDEND',
        sourceMovementType: 'Rendimento',
        isIncoming: true,
        isTaxExempt: true,
        quantity: 0,
        price: null,
        total: 15,
      }),
    ])

    expect(buyResult.imported).toBe(1)
    expect(incomeResult.imported).toBe(1)

    const buyTx = await prisma.transaction.findUnique({
      where: { referenceId: scopedReferenceId(buyReferenceId) },
      include: { ledgerEntries: true },
    })
    const incomeTx = await prisma.transaction.findUnique({
      where: { referenceId: scopedReferenceId(incomeReferenceId) },
      include: { ledgerEntries: true },
    })

    expect(buyTx?.type).toBe('BUY')
    expect(buyTx?.sourceMovementType).toBe('Transferência - Liquidação')
    expect(buyTx?.isTaxExempt).toBe(false)
    expect(buyTx?.ledgerEntries).toHaveLength(2)
    const buyDebit = buyTx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.debit ?? 0), 0)
    const buyCredit = buyTx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.credit ?? 0), 0)
    expect(buyDebit).toBe(200)
    expect(buyCredit).toBe(200)
    expect(buyTx?.ledgerEntries.every((entry) => entry.isIncoming === false)).toBe(true)

    expect(incomeTx?.type).toBe('DIVIDEND')
    expect(incomeTx?.sourceMovementType).toBe('Rendimento')
    expect(incomeTx?.isTaxExempt).toBe(true)
    expect(incomeTx?.ledgerEntries).toHaveLength(2)
    const incomeDebit = incomeTx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.debit ?? 0), 0)
    const incomeCredit = incomeTx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.credit ?? 0), 0)
    expect(incomeDebit).toBe(15)
    expect(incomeCredit).toBe(15)
    expect(incomeTx?.ledgerEntries.every((entry) => entry.isIncoming === true)).toBe(true)
  })

  it('aceita transferencia de custodia e subscricao sem impacto de caixa', async () => {
    const transferTicker = uniqueTicker('MOVT')
    const subscriptionTicker = uniqueTicker('MOVS')
    createdTickers.push(transferTicker, subscriptionTicker)

    const transferReferenceId = `ref-${transferTicker}-transfer`
    const subscriptionReferenceId = `ref-${subscriptionTicker}-subscription`

    const result = await importMovimentacaoRows(userId, [
      buildRow({
        ticker: transferTicker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: transferReferenceId,
        type: 'CUSTODY_TRANSFER',
        sourceMovementType: 'Transferência de Custódia',
        isIncoming: false,
        quantity: 30,
        price: null,
        total: 0,
      }),
      buildRow({
        ticker: subscriptionTicker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId: subscriptionReferenceId,
        type: 'SUBSCRIPTION_RIGHT',
        sourceMovementType: 'Direitos de Subscrição',
        isIncoming: false,
        quantity: 12,
        price: null,
        total: 0,
      }),
    ])

    expect(result.imported).toBe(2)

    const transactions = await prisma.transaction.findMany({
      where: {
        referenceId: {
          in: [scopedReferenceId(transferReferenceId), scopedReferenceId(subscriptionReferenceId)],
        },
      },
      include: { ledgerEntries: true },
      orderBy: { referenceId: 'asc' },
    })

    expect(transactions).toHaveLength(2)
    expect(transactions.every((transaction) => transaction.ledgerEntries.length === 0)).toBe(true)
    expect(transactions.map((transaction) => transaction.type).sort()).toEqual(['CUSTODY_TRANSFER', 'SUBSCRIPTION_RIGHT'])
  })

  it('classifica vencimento de renda fixa como entrada financeira', async () => {
    const ticker = uniqueTicker('CDBT')
    createdTickers.push(ticker)
    const referenceId = `ref-${ticker}-maturity`

    const result = await importMovimentacaoRows(userId, [
      buildRow({
        ticker,
        instituicao: 'CORRETORA FLOW TESTE S.A.',
        referenceId,
        type: 'MATURITY',
        sourceMovementType: 'Vencimento',
        isIncoming: true,
        quantity: 1,
        price: null,
        total: 1050,
      }),
    ])

    expect(result.imported).toBe(1)

    const tx = await prisma.transaction.findUnique({
      where: { referenceId: scopedReferenceId(referenceId) },
      include: { ledgerEntries: true },
    })

    expect(tx?.type).toBe('MATURITY')
    expect(tx?.ledgerEntries).toHaveLength(2)
    const maturityDebit = tx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.debit ?? 0), 0)
    const maturityCredit = tx?.ledgerEntries.reduce((acc, entry) => acc + Number(entry.credit ?? 0), 0)
    expect(maturityDebit).toBe(1050)
    expect(maturityCredit).toBe(1050)
    expect(tx?.ledgerEntries.every((entry) => entry.isIncoming === true)).toBe(true)
  })

  it('nao bloqueia importacao principal quando existem linhas REVISAR', async () => {
    const ticker = uniqueTicker('MOVE')
    createdTickers.push(ticker)

    const reviewRows: MovimentacaoReviewRow[] = [
      {
        lineNumber: 88,
        reason: 'tipo_movimentacao_desconhecido',
        raw: {
          entradaSaida: 'Credito',
          data: '16/04/2026',
          movimentacao: 'Cessão de Direitos',
          produto: 'SNAG12 - SUNO AGRO',
          instituicao: 'CORRETORA FLOW TESTE S.A.',
          quantidade: '40',
          precoUnitario: '-',
          valorOperacao: '-',
        },
      },
    ]

    const result = await importMovimentacaoRows(
      userId,
      [
        buildRow({
          ticker,
          instituicao: 'CORRETORA FLOW TESTE S.A.',
          referenceId: `ref-${ticker}-ok`,
        }),
      ],
      reviewRows,
    )

    expect(result.imported).toBe(1)
    expect(result.errors.some((item) => item.includes('REVISAR linha 88'))).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: {
        changedBy: userId,
        entityType: 'IMPORT_B3_MOVIMENTACAO',
      },
      orderBy: { changedAt: 'desc' },
      select: { newValue: true },
    })

    expect(audit?.newValue).toContain('tipo_movimentacao_desconhecido')
  })
})
