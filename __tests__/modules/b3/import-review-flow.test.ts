import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  analyzeMovimentacaoRows,
  analyzePosicaoRows,
  confirmAndImportMovimentacaoForUser,
  confirmAndImportPosicaoForUser,
} from '@/modules/b3/service'
import { parseMovimentacaoForReview, parsePosicaoForReview } from '@/modules/b3/parser'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

const suiteId = uniqueSuffix()
let userId: string
let clientId: string
const createdTickers: string[] = []

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `review-flow-${suiteId}@invest.br`,
      name: uniqueName('Review Flow User'),
    },
  })
  userId = user.id

  const client = await prisma.client.create({
    data: {
      name: uniqueName('Cliente Review Flow'),
      userId,
    },
  })
  clientId = client.id

  await prisma.assetClass.upsert({
    where: { code: 'ACOES' },
    update: {},
    create: { code: 'ACOES', name: 'Acoes' },
  })
})

afterAll(async () => {
  const accountIds = (await prisma.account.findMany({ where: { clientId }, select: { id: true } })).map(
    (item) => item.id,
  )

  await safeDeleteMany(prisma.auditLog, { changedBy: userId })
  if (accountIds.length > 0) {
    await safeDeleteMany(prisma.ledgerEntry, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.transaction, { accountId: { in: accountIds } })
    await safeDeleteMany(prisma.account, { id: { in: accountIds } })
  }

  await safeDeleteMany(prisma.institution, { name: { in: ['CORRETORA REVIEW FLOW S.A.', 'BANCO REVIEW FLOW'] } })
  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

describe('fluxo de análise/revisão/confirmacao', () => {
  it('movimentacao preserva linhas REVISAR e importa apenas linhas confirmadas válidas', async () => {
    const ticker = uniqueTicker('RVMO')
    createdTickers.push(ticker)

    const rawRows = [
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '16/04/2026', 'Dividendo', `${ticker} - TESTE`, 'CORRETORA REVIEW FLOW S.A.', '10', '1', '10'],
      ['Credito', '16/04/2026', 'Evento não suportado', 'AAAA11 - TESTE', '', '0', '-', '-'],
    ]

    const analysis = await analyzeMovimentacaoRows(parseMovimentacaoForReview(rawRows))
    expect(analysis.summary.totalRows).toBe(2)
    expect(analysis.summary.reviewRows).toBeGreaterThan(0)

    const result = await confirmAndImportMovimentacaoForUser(userId, analysis.lines)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.reviewed).toBe(2)

    const importedLine = analysis.lines.find((line) => line.action === 'IMPORT')
    expect(importedLine).toBeTruthy()

    const importedAsset = await prisma.asset.findUnique({
      where: { ticker: importedLine!.ticker },
      select: { name: true },
    })

    expect(importedAsset?.name).toBe('TESTE')
  })

  it('posicao exige revisão de problemas e só persiste linhas válidas confirmadas', async () => {
    const tickerValid = uniqueTicker('RVPO')
    const tickerInvalid = uniqueTicker('RVPX')
    createdTickers.push(tickerValid, tickerInvalid)

    const sheets = [
      {
        name: 'Acoes',
        rows: [
          ['Produto', 'Instituição', 'Conta', 'Código de Negociação', '', '', 'Tipo', '', 'Quantidade', '', '', '', 'Preço de fechamento', 'Valor atualizado'],
          [`${tickerValid} - TESTE`, 'BANCO REVIEW FLOW', 'Conta 1', tickerValid, '', '', 'ON', '', '1', '', '', '', '10', '10'],
          [`${tickerInvalid} - TESTE`, '', 'Conta 2', tickerInvalid, '', '', 'ON', '', '1', '', '', '', '10', '10'],
        ],
      },
    ]

    const analysis = await analyzePosicaoRows(parsePosicaoForReview(sheets))
    expect(analysis.summary.totalRows).toBe(2)
    expect(analysis.summary.reviewRows).toBe(1)

    const result = await confirmAndImportPosicaoForUser(userId, analysis.lines)
    expect(result.upserted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.reviewed).toBe(2)
  })
})
