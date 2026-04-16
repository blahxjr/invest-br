import { AssetCategory, Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { createTransaction } from '@/modules/transactions/service'
import { inferAssetClass, type InferredAssetClass, type MovimentacaoRow, type NegociacaoRow, type PosicaoRow } from './parser'

export type ImportResult = {
  imported?: number
  skipped?: number
  upserted?: number
  errors: string[]
}

export type ParsedRow = NegociacaoRow & {
  assetId?: string
}

export type UnresolvedAsset = {
  ticker: string
  suggestedName: string
  inferredClass: InferredAssetClass | null
  availableClasses: string[]
  rows: ParsedRow[]
  resolution?: {
    action: 'create' | 'associate'
    assetClassId?: string
    existingAssetId?: string
    name?: string
  }
}

export type ParsedNegociacaoResult = {
  ready: ParsedRow[]
  unresolvedAssets: UnresolvedAsset[]
}

export type AnalyzeNegociacaoSummary = {
  totalRows: number
  readyCount: number
  unresolvedCount: number
  uniqueUnresolvedTickers: string[]
}

export type AnalyzeNegociacaoResult = ParsedNegociacaoResult & {
  summary: AnalyzeNegociacaoSummary
}

export type ImportPayload = {
  readyRows: ParsedRow[]
  resolutions: UnresolvedAsset[]
}

export type ConfirmImportResult = {
  assetsCreated: number
  transactionsImported: number
  transactionsSkipped: number
}

type DbCategory = AssetCategory
type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>

function inferCategoryFromTickerAndMarket(ticker: string, mercado?: string): PosicaoRow['category'] {
  const upperTicker = ticker.toUpperCase()
  const lowerMarket = (mercado ?? '').toLowerCase()

  if (lowerMarket.includes('renda fixa')) return 'ETF'
  if (upperTicker.endsWith('11')) return 'FII'
  return 'STOCK'
}

function toDbCategory(category: PosicaoRow['category']): DbCategory {
  if (category === 'FII') return AssetCategory.FII
  if (category === 'ETF') return AssetCategory.ETF
  if (category === 'BDR') return AssetCategory.BDR
  return AssetCategory.STOCK
}

function toDbCategoryFromClassCode(code: string): DbCategory {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'FII') return AssetCategory.FII
  if (normalized === 'ETF') return AssetCategory.ETF
  if (normalized === 'RENDA_FIXA') return AssetCategory.FIXED_INCOME
  return AssetCategory.STOCK
}

function toAssetClassCode(inferred: InferredAssetClass | null): string | null {
  if (!inferred) return null
  if (inferred === 'ACAO') return 'ACOES'
  return inferred
}

function getSuggestedName(ticker: string, inferred: InferredAssetClass | null): string {
  if (!inferred) return ticker
  return `${ticker} - ${inferred}`
}

function normalizeDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildNegociacaoIdempotencyKey(row: ParsedRow): string {
  const raw = [
    row.ticker,
    normalizeDate(row.date),
    row.type,
    row.quantity.toString(),
    row.price.toString(),
    row.instituicao,
  ].join('|')

  const digest = createHash('sha256').update(raw).digest('hex')
  return `b3-negociacao-${digest}`
}

async function getCurrentBalance(accountId: string, tx: TxClient): Promise<Prisma.Decimal> {
  const last = await tx.ledgerEntry.findFirst({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    select: { balanceAfter: true },
  })

  return last?.balanceAfter ?? new Prisma.Decimal(0)
}

function ensureDate(value: Date | string): Date {
  if (value instanceof Date) return value
  return new Date(value)
}

async function getAssetClassIdByCategory(category: PosicaoRow['category']): Promise<string> {
  const code = category === 'ETF' ? 'ETF' : category === 'FII' ? 'FII' : 'ACOES'

  const assetClass = await prisma.assetClass.findUnique({
    where: { code },
    select: { id: true },
  })

  if (!assetClass) {
    throw new Error(`Classe de ativo nao encontrada para codigo ${code}`)
  }

  return assetClass.id
}

/**
 * Busca a conta padrao do usuario para vincular importacoes em lote.
 */
export async function getDefaultAccountForUser(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { portfolio: { userId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!account) {
    throw new Error('Nenhuma conta encontrada para o usuario autenticado')
  }

  return account.id
}

/**
 * Garante a existencia do ativo por ticker e retorna seu id.
 */
export async function upsertAssetFromImport(
  ticker: string,
  name: string,
  category: PosicaoRow['category'],
): Promise<string> {
  const assetClassId = await getAssetClassIdByCategory(category)
  const dbCategory = toDbCategory(category)

  const asset = await prisma.asset.upsert({
    where: { ticker },
    update: {
      name,
      category: dbCategory,
      assetClassId,
    },
    create: {
      ticker,
      name,
      category: dbCategory,
      assetClassId,
    },
    select: { id: true },
  })

  return asset.id
}

/**
 * Analisa as linhas de negociação e separa o que está pronto do que requer resolução manual.
 */
export async function analyzeNegociacaoRows(rows: NegociacaoRow[]): Promise<AnalyzeNegociacaoResult> {
  const parsedRows: ParsedRow[] = rows.map((row) => ({ ...row }))
  const tickers = Array.from(new Set(parsedRows.map((row) => row.ticker)))

  const [assets, classes] = await Promise.all([
    prisma.asset.findMany({
      where: { ticker: { in: tickers } },
      select: { id: true, ticker: true },
    }),
    prisma.assetClass.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ])

  const assetByTicker = new Map(assets.map((asset) => [asset.ticker ?? '', asset.id]))
  const availableClasses = classes.map((assetClass) => assetClass.code ?? assetClass.name)

  const ready: ParsedRow[] = []
  const groupedUnresolved = new Map<string, ParsedRow[]>()

  for (const row of parsedRows) {
    const existingAssetId = assetByTicker.get(row.ticker)
    if (existingAssetId) {
      ready.push({ ...row, assetId: existingAssetId })
      continue
    }

    const existingRows = groupedUnresolved.get(row.ticker) ?? []
    existingRows.push(row)
    groupedUnresolved.set(row.ticker, existingRows)
  }

  const unresolvedAssets: UnresolvedAsset[] = Array.from(groupedUnresolved.entries()).map(([ticker, unresolvedRows]) => {
    const inferredClass = inferAssetClass(ticker)
    return {
      ticker,
      suggestedName: getSuggestedName(ticker, inferredClass),
      inferredClass,
      availableClasses,
      rows: unresolvedRows,
    }
  })

  const uniqueUnresolvedTickers = unresolvedAssets.map((asset) => asset.ticker)
  const unresolvedCount = unresolvedAssets.reduce((sum, asset) => sum + asset.rows.length, 0)

  return {
    ready,
    unresolvedAssets,
    summary: {
      totalRows: parsedRows.length,
      readyCount: ready.length,
      unresolvedCount,
      uniqueUnresolvedTickers,
    },
  }
}

/**
 * Confirma resoluções pendentes e importa transações de negociação de forma idempotente.
 */
export async function confirmAndImportNegociacaoForUser(
  userId: string,
  payload: ImportPayload,
): Promise<ConfirmImportResult> {
  const accountId = await getDefaultAccountForUser(userId)
  const normalizedReadyRows: ParsedRow[] = payload.readyRows.map((row) => ({
    ...row,
    date: ensureDate(row.date),
  }))

  return prisma.$transaction(async (tx) => {
    const resolvedAssetIdByTicker = new Map<string, string>()
    let assetsCreated = 0

    for (const unresolved of payload.resolutions) {
      const resolution = unresolved.resolution
      if (!resolution) {
        throw new Error(`Ativo ${unresolved.ticker} sem resolução definida`)
      }

      if (resolution.action === 'associate') {
        if (!resolution.existingAssetId) {
          throw new Error(`Ativo ${unresolved.ticker} sem existingAssetId para associação`)
        }
        resolvedAssetIdByTicker.set(unresolved.ticker, resolution.existingAssetId)
        continue
      }

      if (!resolution.assetClassId) {
        throw new Error(`Ativo ${unresolved.ticker} sem classe de ativo para criação`)
      }

      const classRecord = await tx.assetClass.findFirst({
        where: {
          OR: [
            { id: resolution.assetClassId },
            { code: resolution.assetClassId },
            { name: resolution.assetClassId },
          ],
        },
        select: { id: true, code: true, name: true },
      })

      if (!classRecord) {
        throw new Error(`Classe de ativo inválida para ${unresolved.ticker}`)
      }

      const existing = await tx.asset.findUnique({
        where: { ticker: unresolved.ticker },
        select: { id: true },
      })

      const asset = await tx.asset.upsert({
        where: { ticker: unresolved.ticker },
        update: {
          name: resolution.name?.trim() || unresolved.ticker,
          assetClassId: classRecord.id,
          category: toDbCategoryFromClassCode(classRecord.code ?? classRecord.name),
        },
        create: {
          ticker: unresolved.ticker,
          name: resolution.name?.trim() || unresolved.ticker,
          assetClassId: classRecord.id,
          category: toDbCategoryFromClassCode(classRecord.code ?? classRecord.name),
        },
        select: { id: true },
      })

      if (!existing) {
        assetsCreated++
      }

      resolvedAssetIdByTicker.set(unresolved.ticker, asset.id)
    }

    const unresolvedRows = payload.resolutions.flatMap((asset) =>
      asset.rows.map((row) => ({
        ...row,
        date: ensureDate(row.date),
      })),
    )

    const rowsToImport: ParsedRow[] = [...normalizedReadyRows, ...unresolvedRows]

    let transactionsImported = 0
    let transactionsSkipped = 0
    let currentBalance = await getCurrentBalance(accountId, tx)

    for (const row of rowsToImport) {
      const rowAssetId = row.assetId ?? resolvedAssetIdByTicker.get(row.ticker)
      if (!rowAssetId) {
        throw new Error(`Não foi possível resolver ativo para ticker ${row.ticker}`)
      }

      const referenceId = buildNegociacaoIdempotencyKey(row)
      const existingTx = await tx.transaction.findUnique({
        where: { referenceId },
        select: { id: true },
      })

      if (existingTx) {
        transactionsSkipped++
        await tx.auditLog.create({
          data: {
            entityType: 'TRANSACTION',
            entityId: existingTx.id,
            action: 'IMPORT_B3_NEGOCIACAO',
            previousValue: null,
            newValue: JSON.stringify({ referenceId, skipped: true }),
            changedBy: userId,
          },
        })
        continue
      }

      const totalAmount = new Prisma.Decimal(row.total.toString())
      const isDebit = row.type === 'BUY'
      currentBalance = isDebit
        ? currentBalance.minus(totalAmount)
        : currentBalance.plus(totalAmount)

      const transaction = await tx.transaction.create({
        data: {
          referenceId,
          type: row.type,
          accountId,
          assetId: rowAssetId,
          quantity: new Prisma.Decimal(row.quantity.toString()),
          price: new Prisma.Decimal(row.price.toString()),
          totalAmount,
          date: row.date,
          notes: `Importacao B3 - Negociacao (${row.instituicao})`,
        },
        select: { id: true },
      })

      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          accountId,
          debit: isDebit ? totalAmount : null,
          credit: isDebit ? null : totalAmount,
          balanceAfter: currentBalance,
        },
      })

      await tx.auditLog.create({
        data: {
          entityType: 'TRANSACTION',
          entityId: transaction.id,
          action: 'IMPORT_B3_NEGOCIACAO',
          previousValue: null,
          newValue: JSON.stringify({ referenceId, ticker: row.ticker, type: row.type }),
          changedBy: userId,
        },
      })

      transactionsImported++
    }

    return {
      assetsCreated,
      transactionsImported,
      transactionsSkipped,
    }
  })
}

/**
 * Importa linhas de negociacao criando transacoes idempotentes.
 */
export async function importNegociacaoRows(userId: string, rows: NegociacaoRow[]): Promise<ImportResult> {
  const accountId = await getDefaultAccountForUser(userId)
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const category = inferCategoryFromTickerAndMarket(row.ticker, row.mercado)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)

      const tx = await createTransaction({
        referenceId: row.referenceId,
        type: row.type,
        accountId,
        assetId,
        quantity: row.quantity,
        price: row.price,
        totalAmount: row.total,
        date: row.date,
        notes: `Importacao B3 - Negociacao (${row.instituicao})`,
      })

      if (tx.idempotent) {
        skipped++
      } else {
        imported++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Negociacao ${row.referenceId}: ${message}`)
    }
  }

  return { imported, skipped, errors }
}

/**
 * Importa linhas de movimentacao criando transacoes idempotentes.
 */
export async function importMovimentacaoRows(userId: string, rows: MovimentacaoRow[]): Promise<ImportResult> {
  const accountId = await getDefaultAccountForUser(userId)
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const category = inferCategoryFromTickerAndMarket(row.ticker)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)
      const totalAmount = row.total ?? 0

      if (totalAmount <= 0) {
        skipped++
        continue
      }

      const tx = await createTransaction({
        referenceId: row.referenceId,
        type: row.type,
        accountId,
        assetId,
        quantity: row.quantity,
        price: row.price ?? undefined,
        totalAmount,
        date: row.date,
        notes: `Importacao B3 - Movimentacao (${row.instituicao})`,
      })

      if (tx.idempotent) {
        skipped++
      } else {
        imported++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Movimentacao ${row.referenceId}: ${message}`)
    }
  }

  return { imported, skipped, errors }
}

/**
 * Importa linhas de posicao sincronizando apenas o catalogo de ativos.
 */
export async function importPosicaoRows(rows: PosicaoRow[]): Promise<ImportResult> {
  let upserted = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      await upsertAssetFromImport(row.ticker, row.name, row.category)
      upserted++
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Posicao ${row.ticker}: ${message}`)
    }
  }

  return { upserted, errors }
}
