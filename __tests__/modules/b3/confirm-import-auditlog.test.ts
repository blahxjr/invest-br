/**
 * Testes end-to-end: confirmAndImportMovimentacaoForUser — AuditLog e fluxo completo.
 *
 * Cobre:
 *  1. AuditLog sempre criado, mesmo com 0 linhas
 *  2. AuditLog criado quando todas as linhas são skippadas
 *  3. AuditLog registra imported/skipped/errors corretamente
 *  4. AuditLog persistido com entityType correto
 *  5. Fluxo completo: planilha mock → confirm → AuditLog + Transaction criados
 *  6. Idempotência: segunda importação não cria nova Transaction, mas cria AuditLog
 *  7. Linha SKIP não gera Transaction, mas é auditada
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { analyzeMovimentacaoRows, confirmAndImportMovimentacaoForUser } from '@/modules/b3/service'
import { parseMovimentacaoForReview } from '@/modules/b3/parser'
import type { MovimentacaoReviewLine } from '@/modules/b3/service'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
const createdTickers: string[] = []

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `auditlog-${suiteId}@invest.br`,
      name: uniqueName('AuditLog Test User'),
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
  const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } })
  const accountIds = client?.id
    ? (await prisma.account.findMany({ where: { clientId: client.id }, select: { id: true } })).map((a) => a.id)
    : []

  await safeDeleteMany(prisma.auditLog, { changedBy: userId })

  if (accountIds.length > 0) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.transaction, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.account, { id: { in: accountIds } })
  }

  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })

  if (client?.id) {
    await safeDeleteMany(prisma.client, { id: client.id })
  }

  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

/**
 * Monta uma MovimentacaoReviewLine mínima para testes unitários que não
 * passam pelo parser completo.
 */
function buildReviewLine(input: {
  ticker: string
  referenceId: string
  action?: 'IMPORT' | 'SKIP'
  type?: MovimentacaoReviewLine['type']
  instituicao?: string
}): MovimentacaoReviewLine {
  return {
    id: input.referenceId,
    lineNumber: 1,
    status: 'OK',
    classification: 'LIQUIDACAO',
    reason: '',
    action: input.action ?? 'IMPORT',
    referenceId: input.referenceId,
    original: {
      entradaSaida: 'Credito',
      data: '16/04/2026',
      movimentacao: 'Rendimento',
      produto: `${input.ticker} - TESTE`,
      instituicao: input.instituicao ?? 'CORR AUDITLOG S.A.',
      quantidade: '10',
      precoUnitario: '1',
      valorOperacao: '10',
    },
    normalized: {
      date: new Date('2026-04-16'),
      type: input.type ?? 'DIVIDEND',
      ticker: input.ticker,
      instituicao: input.instituicao ?? 'CORR AUDITLOG S.A.',
      quantity: 10,
      price: 1,
      total: 10,
      referenceId: input.referenceId,
      sourceMovementType: 'Rendimento',
      isIncoming: true,
      isTaxExempt: true,
      subscriptionDeadline: null,
    },
    date: new Date('2026-04-16'),
    type: input.type ?? 'DIVIDEND',
    ticker: input.ticker,
    instituicao: input.instituicao ?? 'CORR AUDITLOG S.A.',
    conta: '',
    quantity: 10,
    price: 1,
    total: 10,
    sourceMovementType: 'Rendimento',
    isIncoming: true,
    isTaxExempt: true,
    subscriptionDeadline: null,
    issues: [],
  }
}

describe('confirmAndImportMovimentacaoForUser — AuditLog', () => {
  it('1. cria AuditLog mesmo com 0 linhas', async () => {
    const auditsBefore = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })

    const result = await confirmAndImportMovimentacaoForUser(userId, [])

    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.reviewed).toBe(0)

    const auditsAfter = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })
    expect(auditsAfter).toBe(auditsBefore + 1)
  })

  it('2. AuditLog criado quando todas as linhas são SKIP', async () => {
    const ticker = uniqueTicker('AUSK')
    createdTickers.push(ticker)

    const auditsBefore = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })

    const result = await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker, referenceId: `ref-skip-${ticker}`, action: 'SKIP' }),
    ])

    expect(result.skipped).toBe(1)
    expect(result.imported).toBe(0)

    const auditsAfter = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })
    expect(auditsAfter).toBe(auditsBefore + 1)
  })

  it('3. AuditLog registra contadores imported/skipped corretamente', async () => {
    const tickerImp = uniqueTicker('AUIM')
    const tickerSkip = uniqueTicker('AUSK2')
    createdTickers.push(tickerImp, tickerSkip)

    await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker: tickerImp, referenceId: `ref-${tickerImp}-a3` }),
      buildReviewLine({ ticker: tickerSkip, referenceId: `ref-${tickerSkip}-a3`, action: 'SKIP' }),
    ])

    const auditLog = await prisma.auditLog.findFirst({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
      orderBy: { changedAt: 'desc' },
    })

    expect(auditLog).toBeTruthy()
    const payload = JSON.parse(auditLog!.newValue as string)
    expect(payload.imported).toBe(1)
    expect(payload.skipped).toBe(1)
    expect(payload.reviewed).toBe(2)
  })

  it('4. AuditLog tem entityType IMPORT_B3_MOVIMENTACAO e action CREATE', async () => {
    const ticker = uniqueTicker('AUET')
    createdTickers.push(ticker)

    await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker, referenceId: `ref-${ticker}-a4` }),
    ])

    const auditLog = await prisma.auditLog.findFirst({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
      orderBy: { changedAt: 'desc' },
    })

    expect(auditLog?.entityType).toBe('IMPORT_B3_MOVIMENTACAO')
    expect(auditLog?.action).toBe('CREATE')
    expect(auditLog?.changedBy).toBe(userId)
  })

  it('5. fluxo completo via parser: planilha mock → AuditLog + Transaction criados', async () => {
    const ticker = uniqueTicker('AUFP')
    createdTickers.push(ticker)

    const rawRows = [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '16/04/2026', 'Dividendo', `${ticker} - TESTE`, 'CORR AUDITLOG S.A.', '10', '1', '10'],
    ]

    const auditsBefore = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })

    const analysis = await analyzeMovimentacaoRows(parseMovimentacaoForReview(rawRows))
    expect(analysis.summary.totalRows).toBe(1)

    const result = await confirmAndImportMovimentacaoForUser(userId, analysis.lines)
    expect(result.imported).toBe(1)
    expect(result.errors).toHaveLength(0)

    // AuditLog criado
    const auditsAfter = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })
    expect(auditsAfter).toBe(auditsBefore + 1)

    // Transaction criada no banco
    const importedLine = analysis.lines.find((l) => l.action === 'IMPORT')
    expect(importedLine).toBeTruthy()
    const tx = await prisma.transaction.findFirst({
      where: { referenceId: importedLine!.referenceId },
    })
    expect(tx).toBeTruthy()
    expect(tx?.type).toBe('DIVIDEND')
  })

  it('6. idempotência: segunda importação não cria nova Transaction, mas cria novo AuditLog', async () => {
    const ticker = uniqueTicker('AUIP')
    createdTickers.push(ticker)
    const referenceId = `ref-${ticker}-idem`

    const result1 = await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker, referenceId }),
    ])
    expect(result1.imported).toBe(1)

    const auditsBefore = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })

    const result2 = await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker, referenceId }),
    ])
    expect(result2.imported).toBe(0)
    expect(result2.skipped).toBe(1)

    const auditsAfter = await prisma.auditLog.count({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
    })
    expect(auditsAfter).toBe(auditsBefore + 1)

    const txCount = await prisma.transaction.count({ where: { referenceId } })
    expect(txCount).toBe(1)
  })

  it('7. linha SKIP não gera Transaction, mas é registrada no AuditLog', async () => {
    const ticker = uniqueTicker('AUSK3')
    createdTickers.push(ticker)
    const referenceId = `ref-${ticker}-skip7`

    await confirmAndImportMovimentacaoForUser(userId, [
      buildReviewLine({ ticker, referenceId, action: 'SKIP' }),
    ])

    const tx = await prisma.transaction.findFirst({ where: { referenceId } })
    expect(tx).toBeNull()

    const auditLog = await prisma.auditLog.findFirst({
      where: { changedBy: userId, entityType: 'IMPORT_B3_MOVIMENTACAO' },
      orderBy: { changedAt: 'desc' },
    })
    expect(auditLog).toBeTruthy()
    const payload = JSON.parse(auditLog!.newValue as string)
    const skippedEntry = payload.lines.find((l: { action: string }) => l.action === 'SKIP')
    expect(skippedEntry).toBeTruthy()
  })
})
