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

export type AssetClassOption = {
  id: string
  name: string
  code: string | null
}

export type ExistingAssetOption = {
  id: string
  ticker: string | null
  name: string
  className: string
}

export type MissingClass = {
  inferredCode: string
  suggestedName: string
  suggestedDescription: string
  affectedTickers: string[]
}

export type UnresolvedAsset = {
  ticker: string
  suggestedName: string
  inferredClass: InferredAssetClass | null
  inferredCategory: AssetCategory | null
  rows: ParsedRow[]
  resolution?: {
    action: 'create' | 'associate'
    assetClassId?: string
    existingAssetId?: string
    name?: string
    category?: AssetCategory
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
  missingClasses: MissingClass[]
  availableClasses: AssetClassOption[]
  existingAssets: ExistingAssetOption[]
  summary: AnalyzeNegociacaoSummary
}

export type ImportPayload = {
  readyRows: ParsedRow[]
  classesToCreate: Array<{
    inferredCode: string
    name: string
    code: string
    description?: string
  }>
  resolutions: UnresolvedAsset[]
}

export type ConfirmImportResult = {
  assetsCreated: number
  transactionsImported: number
  transactionsSkipped: number
}

type DbCategory = AssetCategory
type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>

const CLASS_SUGGESTIONS: Record<string, { name: string; description: string; code: string }> = {
  FII: { name: 'Fundos Imobiliários', description: 'FIIs negociados na B3', code: 'FII' },
  ETF: { name: 'ETFs', description: 'Fundos de índice negociados em bolsa', code: 'ETF' },
  ACAO: { name: 'Ações', description: 'Ações de empresas listadas na B3', code: 'ACOES' },
  RENDA_FIXA: { name: 'Renda Fixa', description: 'Títulos de renda fixa (Tesouro, CDB, etc.)', code: 'RENDA_FIXA' },
  BDR: { name: 'BDRs', description: 'Brazilian Depositary Receipts', code: 'BDR' },
  CRIPTO: { name: 'Criptoativos', description: 'Criptomoedas e tokens', code: 'CRIPTO' },
  OUTRO: { name: 'Outros', description: 'Ativos não classificados', code: 'OUTROS' },
}

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

/**
 * Infere categoria do ativo para preenchimento automático no wizard.
 */
export function inferAssetCategory(inferredClass: string | null): AssetCategory | null {
  switch (inferredClass) {
    case 'FII':
      return AssetCategory.FII
    case 'ETF':
      return AssetCategory.ETF
    case 'ACAO':
      return AssetCategory.STOCK
    case 'RENDA_FIXA':
      return AssetCategory.FIXED_INCOME
    case 'BDR':
      return AssetCategory.BDR
    case 'CRIPTO':
      return AssetCategory.CRYPTO
    default:
      return null
  }
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

  const [assetsByTicker, classes, allAssets] = await Promise.all([
    prisma.asset.findMany({
      where: { ticker: { in: tickers } },
      select: { id: true, ticker: true },
    }),
    prisma.assetClass.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.asset.findMany({
      where: { ticker: { not: null } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        ticker: true,
        name: true,
        assetClass: { select: { name: true } },
      },
    }),
  ])

  const assetByTicker = new Map(assetsByTicker.map((asset) => [asset.ticker ?? '', asset.id]))
  const availableClasses: AssetClassOption[] = classes.map((assetClass) => ({
    id: assetClass.id,
    name: assetClass.name,
    code: assetClass.code,
  }))
  const existingAssets: ExistingAssetOption[] = allAssets.map((asset) => ({
    id: asset.id,
    ticker: asset.ticker,
    name: asset.name,
    className: asset.assetClass.name,
  }))
  const availableClassCodes = new Set(
    classes
      .map((assetClass) => assetClass.code?.trim().toUpperCase() ?? null)
      .filter((code): code is string => Boolean(code)),
  )

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

  const missingByInferredCode = new Map<string, Set<string>>()

  const unresolvedAssets: UnresolvedAsset[] = Array.from(groupedUnresolved.entries()).map(([ticker, unresolvedRows]) => {
    const inferredClass = inferAssetClass(ticker)
    const inferredCode = inferredClass
    const expectedClassCode = toAssetClassCode(inferredClass)

    if (inferredCode && expectedClassCode && !availableClassCodes.has(expectedClassCode)) {
      const affected = missingByInferredCode.get(inferredCode) ?? new Set<string>()
      affected.add(ticker)
      missingByInferredCode.set(inferredCode, affected)
    }

    return {
      ticker,
      suggestedName: getSuggestedName(ticker, inferredClass),
      inferredClass,
      inferredCategory: inferAssetCategory(inferredClass),
      rows: unresolvedRows,
    }
  })

  const missingClasses: MissingClass[] = Array.from(missingByInferredCode.entries()).map(([inferredCode, tickersSet]) => {
    const suggestion = CLASS_SUGGESTIONS[inferredCode] ?? CLASS_SUGGESTIONS.OUTRO
    return {
      inferredCode,
      suggestedName: suggestion.name,
      suggestedDescription: suggestion.description,
      affectedTickers: Array.from(tickersSet).sort(),
    }
  })

  const uniqueUnresolvedTickers = unresolvedAssets.map((asset) => asset.ticker)
  const unresolvedCount = unresolvedAssets.reduce((sum, asset) => sum + asset.rows.length, 0)

  return {
    ready,
    unresolvedAssets,
    missingClasses,
    availableClasses,
    existingAssets,
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

    for (const classInput of payload.classesToCreate) {
      const code = classInput.code.trim().toUpperCase()
      if (!code) {
        throw new Error('Código de classe inválido para criação automática')
      }

      await tx.assetClass.upsert({
        where: { code },
        update: {
          name: classInput.name.trim(),
          description: classInput.description?.trim() || null,
        },
        create: {
          code,
          name: classInput.name.trim(),
          description: classInput.description?.trim() || null,
        },
      })
    }

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
          category: resolution.category ?? inferAssetCategory(unresolved.inferredClass) ?? toDbCategoryFromClassCode(classRecord.code ?? classRecord.name),
        },
        create: {
          ticker: unresolved.ticker,
          name: resolution.name?.trim() || unresolved.ticker,
          assetClassId: classRecord.id,
          category: resolution.category ?? inferAssetCategory(unresolved.inferredClass) ?? toDbCategoryFromClassCode(classRecord.code ?? classRecord.name),
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
