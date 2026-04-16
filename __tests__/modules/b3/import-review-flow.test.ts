import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  analyzeMovimentacaoRows,
  analyzePosicaoRows,
  confirmAndImportMovimentacaoForUser,
  confirmAndImportPosicaoForUser,
} from '@/modules/b3/service'
import type { MovimentacaoRow, MovimentacaoReviewRow, PosicaoRow } from '@/modules/b3/parser'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
let clientId: string | null = null
const createdTickers: string[] = []

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `review-flow-${suiteId}@invest.br`,
      name: uniqueName('Review Flow User'),
    },
  })
  userId = user.id

  await prisma.assetClass.upsert({
    where: { code: 'ACOES' },
    update: {},
    create: { code: 'ACOES', name: 'Acoes' },
  })
})

afterAll(async () => {
  const client = await prisma.client.findFirst({ where: { userId }, select: { id: true } })
  if (client?.id) {
    clientId = client.id
  }

  const accountIds = clientId
    ? (await prisma.account.findMany({ where: { clientId }, select: { id: true } })).map((item) => item.id)
    : []

  await safeDeleteMany(prisma.auditLog, { changedBy: userId })
  if (accountIds.length > 0) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.transaction, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.account, { id: { in: accountIds } })
  }

  await safeDeleteMany(prisma.institution, { name: { in: ['CORRETORA REVIEW FLOW S.A.', 'BANCO REVIEW FLOW'] } })
  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })

  if (clientId) {
    await safeDeleteMany(prisma.client, { id: clientId })
  }

  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

describe('fluxo de análise/revisão/confirmacao', () => {
  it('movimentacao preserva linhas REVISAR e importa apenas linhas confirmadas válidas', async () => {
    const ticker = uniqueTicker('RVMO')
    createdTickers.push(ticker)

    const readyRows: MovimentacaoRow[] = [
      {
        date: new Date('2026-04-16T00:00:00.000Z'),
        type: 'DIVIDEND',
        ticker,
        instituicao: 'CORRETORA REVIEW FLOW S.A.',
        quantity: 10,
        price: 1,
        total: 10,
        referenceId: `ref-${ticker}-1`,
      },
    ]

    const parserReviewRows: MovimentacaoReviewRow[] = [
      {
        lineNumber: 77,
        reason: 'tipo_movimentacao_desconhecido',
        raw: {
          entradaSaida: 'Credito',
          data: '16/04/2026',
          movimentacao: 'Evento não suportado',
          produto: 'AAAA11 - TESTE',
          instituicao: '',
          quantidade: '0',
          precoUnitario: '-',
          valorOperacao: '-',
        },
      },
    ]

    const analysis = await analyzeMovimentacaoRows(readyRows, parserReviewRows)
    expect(analysis.summary.totalRows).toBe(2)
    expect(analysis.summary.reviewRows).toBeGreaterThan(0)

    const result = await confirmAndImportMovimentacaoForUser(userId, analysis.lines)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.reviewed).toBe(2)
  })

  it('posicao exige revisão de problemas e só persiste linhas válidas confirmadas', async () => {
    const tickerValid = uniqueTicker('RVPO')
    const tickerInvalid = uniqueTicker('RVPX')
    createdTickers.push(tickerValid, tickerInvalid)

    const rows: PosicaoRow[] = [
      {
        ticker: tickerValid,
        name: `${tickerValid} TESTE`,
        category: 'STOCK',
        quantity: 1,
        closePrice: 10,
        updatedValue: 10,
        instituicao: 'BANCO REVIEW FLOW',
        conta: 'Conta 1',
      },
      {
        ticker: tickerInvalid,
        name: `${tickerInvalid} TESTE`,
        category: 'STOCK',
        quantity: 1,
        closePrice: 10,
        updatedValue: 10,
        instituicao: '',
        conta: 'Conta 2',
      },
    ]

    const analysis = await analyzePosicaoRows(rows)
    expect(analysis.summary.totalRows).toBe(2)
    expect(analysis.summary.reviewRows).toBe(1)

    const result = await confirmAndImportPosicaoForUser(userId, analysis.lines)
    expect(result.upserted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.reviewed).toBe(2)
  })
})
