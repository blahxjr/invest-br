import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  analyzeNegociacaoRows,
  confirmAndImportNegociacaoForUser,
  type ParsedRow,
  type UnresolvedAsset,
} from '@/modules/b3/service'
import { safeDeleteMany, uniqueName, uniqueSuffix, uniqueTicker } from '../../helpers/fixtures'

let userId: string
let portfolioId: string
let clientId: string
let institutionId: string
let accountId: string
let existingAssetId: string
let fiiClassId: string
let stockClassId: string
let customClassCode: string
const suiteId = uniqueSuffix()

const createdTickers: string[] = []

function buildRow(ticker: string, type: 'BUY' | 'SELL' = 'BUY'): ParsedRow {
  return {
    date: new Date('2026-04-13T00:00:00.000Z'),
    type,
    ticker,
    mercado: 'Mercado a Vista',
    instituicao: 'BTG',
    quantity: 2,
    price: 100,
    total: 200,
    referenceId: `ref-${ticker}-${type}`,
  }
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `b3-wizard-${suiteId}@invest.br`, name: uniqueName('B3 Wizard User') },
  })
  userId = user.id

  const portfolio = await prisma.portfolio.create({
    data: { name: uniqueName('Carteira B3 Wizard'), userId },
  })
  portfolioId = portfolio.id

  const client = await prisma.client.create({
    data: { name: uniqueName('Cliente B3 Wizard'), userId },
  })
  clientId = client.id

  const institution = await prisma.institution.create({
    data: { name: uniqueName('Instituicao B3 Wizard') },
  })
  institutionId = institution.id

  const account = await prisma.account.create({
    data: {
      name: uniqueName('Conta B3 Wizard'),
      type: 'BROKERAGE',
      portfolioId,
      clientId,
      institutionId,
    },
  })
  accountId = account.id

  const fiiClass = await prisma.assetClass.upsert({
    where: { code: 'FII' },
    update: {},
    create: { name: 'Fundos Imobiliarios', code: 'FII' },
  })
  fiiClassId = fiiClass.id

  const stockClass = await prisma.assetClass.upsert({
    where: { code: 'ACOES' },
    update: {},
    create: { name: 'Acoes', code: 'ACOES' },
  })
  stockClassId = stockClass.id
  customClassCode = `ETF_${suiteId.slice(0, 4).toUpperCase()}`

  const existingTicker = uniqueTicker('B3EX')
  createdTickers.push(existingTicker)
  const existingAsset = await prisma.asset.create({
    data: {
      ticker: existingTicker,
      name: uniqueName('Ativo Existente B3'),
      category: 'STOCK',
      assetClassId: stockClassId,
    },
  })
  existingAssetId = existingAsset.id
})

afterAll(async () => {
  await safeDeleteMany(prisma.auditLog, { changedBy: userId })
  await safeDeleteMany(prisma.ledgerEntry, { accountId })
  await safeDeleteMany(prisma.transaction, { accountId })
  await safeDeleteMany(prisma.asset, { ticker: { in: createdTickers } })
  await safeDeleteMany(prisma.assetClass, { code: customClassCode })
  await safeDeleteMany(prisma.account, { id: accountId })
  await safeDeleteMany(prisma.client, { id: clientId })
  await safeDeleteMany(prisma.institution, { id: institutionId })
  await safeDeleteMany(prisma.portfolio, { id: portfolioId })
  await safeDeleteMany(prisma.user, { id: userId })
  await prisma.$disconnect()
})

describe('analyzeNegociacaoRows', () => {
  it('retorna unresolvedAssets quando ticker nao existe no banco', async () => {
    const newTicker = uniqueTicker('BRCO')
    createdTickers.push(newTicker)

    const result = await analyzeNegociacaoRows([buildRow(newTicker)])

    expect(result.ready).toHaveLength(0)
    expect(result.unresolvedAssets).toHaveLength(1)
    expect(result.unresolvedAssets[0]?.ticker).toBe(newTicker)
  })

  it('retorna ready quando ticker ja existe no banco', async () => {
    const existingAsset = await prisma.asset.findUnique({
      where: { id: existingAssetId },
      select: { ticker: true },
    })

    const result = await analyzeNegociacaoRows([buildRow(existingAsset?.ticker ?? '')])

    expect(result.ready).toHaveLength(1)
    expect(result.ready[0]?.assetId).toBe(existingAssetId)
    expect(result.unresolvedAssets).toHaveLength(0)
  })
})

describe('confirmAndImportNegociacaoForUser', () => {
  it('cria AssetClass antes de criar Asset e Transaction', async () => {
    const ticker = uniqueTicker('BRCO')
    createdTickers.push(ticker)

    const unresolved: UnresolvedAsset = {
      ticker,
      suggestedName: `${ticker} - FII`,
      inferredClass: 'FII',
      inferredCategory: 'FII',
      rows: [buildRow(ticker)],
      resolution: {
        action: 'create',
        assetClassId: customClassCode,
        name: ticker,
        category: 'FII',
      },
    }

    const result = await confirmAndImportNegociacaoForUser(userId, {
      readyRows: [],
      classesToCreate: [
        {
          inferredCode: 'ETF',
          name: `Classe ${customClassCode}`,
          code: customClassCode,
          description: 'Classe criada no fluxo de importacao',
        },
      ],
      resolutions: [unresolved],
    })

    const createdClass = await prisma.assetClass.findUnique({ where: { code: customClassCode } })
    const asset = await prisma.asset.findUnique({ where: { ticker } })
    const transaction = await prisma.transaction.findFirst({
      where: { accountId, assetId: asset?.id ?? '' },
      orderBy: { createdAt: 'desc' },
    })

    expect(result.assetsCreated).toBe(1)
    expect(result.transactionsImported).toBe(1)
    expect(createdClass).toBeTruthy()
    expect(asset).toBeTruthy()
    expect(transaction).toBeTruthy()

    const classCreatedAt = createdClass?.createdAt.getTime() ?? 0
    const assetCreatedAt = asset?.createdAt.getTime() ?? 0
    const txCreatedAt = transaction?.createdAt.getTime() ?? 0
    expect(classCreatedAt).toBeLessThanOrEqual(assetCreatedAt)
    expect(assetCreatedAt).toBeLessThanOrEqual(txCreatedAt)
  })

  it('eh idempotente e nao duplica transacoes na segunda importacao', async () => {
    const ticker = uniqueTicker('BTAL')
    createdTickers.push(ticker)

    const unresolved: UnresolvedAsset = {
      ticker,
      suggestedName: `${ticker} - FII`,
      inferredClass: 'FII',
      inferredCategory: 'FII',
      rows: [buildRow(ticker)],
      resolution: {
        action: 'create',
        assetClassId: 'FII',
        name: ticker,
        category: 'FII',
      },
    }

    const first = await confirmAndImportNegociacaoForUser(userId, {
      readyRows: [],
      classesToCreate: [],
      resolutions: [unresolved],
    })

    const second = await confirmAndImportNegociacaoForUser(userId, {
      readyRows: [],
      classesToCreate: [],
      resolutions: [unresolved],
    })

    expect(first.transactionsImported).toBe(1)
    expect(second.transactionsImported).toBe(0)
    expect(second.transactionsSkipped).toBe(1)
  })
})
