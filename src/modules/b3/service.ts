import { AccountType, AssetCategory, InstitutionType, Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import * as positionsService from '@/modules/positions/service'
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
  institutionPreviews: InstitutionPreview[]
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
  institutionsCreated: number
  accountsCreated: number
  transactionsImported: number
  transactionsSkipped: number
}

export type InstitutionPreview = {
  normalizedName: string
  displayName: string
  inferredType: 'Corretora' | 'Banco' | 'Exchange' | 'Outra'
  isNew: boolean
  rowCount: number
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

/**
 * Normaliza o nome da instituição para comparação e upsert.
 */
export function normalizeInstitutionName(raw: string): string {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) {
    throw new Error('Nome de instituição vazio')
  }
  return trimmed
}

/**
 * Infere o tipo da instituição com base no nome informado.
 */
export function inferInstitutionType(name: string): InstitutionType {
  const upper = name.toUpperCase()

  if (
    upper.includes('CRYPTO') || upper.includes('CRIPTO')
    || upper.includes('BINANCE') || upper.includes('MERCADO BITCOIN')
    || upper.includes('FOXBIT')
  ) return InstitutionType.CRYPTO_EXCHANGE

  if (
    upper.includes('BANCO') || upper.includes('BANK')
    || upper.includes('CAIXA') || upper.includes('BRADESCO')
    || upper.includes('ITAU') || upper.includes('SANTANDER')
    || upper.includes('BB ') || upper.includes('NUBANK')
  ) return InstitutionType.BANK

  if (
    upper.includes('CORRETORA') || upper.includes('INVEST')
    || upper.includes('INVESTIMENTOS') || upper.includes('VALORES')
    || upper.includes('BROKER') || upper.includes('DTVM')
    || upper.includes('RICO') || upper.includes('CLEAR')
    || upper.includes('INTER') || upper.includes('TORO')
  ) return InstitutionType.BROKER

  return InstitutionType.OTHER
}

/**
 * Gera um nome amigável para a conta com base no nome da instituição.
 */
export function buildAccountName(institutionName: string): string {
  const stopWords = new Set([
    'DE', 'DA', 'DO', 'DAS', 'DOS', 'S.A.', 'S/A', 'LTDA', 'SA',
    'CORRETORA', 'VALORES', 'DISTRIBUIDORA',
    'TITULOS', 'MOBILIARIOS', 'MOBILIÁRIOS',
  ])

  const words = institutionName
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word.toUpperCase()))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

  return words.join(' ') || institutionName.slice(0, 30)
}

function institutionTypeToPtBr(type: InstitutionType): InstitutionPreview['inferredType'] {
  if (type === InstitutionType.BROKER) return 'Corretora'
  if (type === InstitutionType.BANK) return 'Banco'
  if (type === InstitutionType.CRYPTO_EXCHANGE) return 'Exchange'
  return 'Outra'
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
 * Busca o cliente padrão do usuário para vincular contas criadas via importação.
 */
export async function getClientForUser(userId: string): Promise<string> {
  const client = await prisma.client.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!client) {
    throw new Error('Nenhum cliente encontrado para o usuário autenticado')
  }

  return client.id
}

/**
 * Garante a existência de uma instituição pelo nome normalizado.
 */
export async function upsertInstitution(name: string, tx: TxClient): Promise<string> {
  const normalized = normalizeInstitutionName(name)
  const existing = await tx.institution.findFirst({
    where: { name: normalized },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await tx.institution.create({
    data: {
      name: normalized,
      type: inferInstitutionType(normalized),
    },
    select: { id: true },
  })
  return created.id
}

/**
 * Garante a existência da conta de uma instituição para o client informado.
 */
export async function upsertAccountForInstitution(
  institutionId: string,
  institutionName: string,
  clientId: string,
  tx: TxClient,
): Promise<string> {
  const existing = await tx.account.findFirst({
    where: { institutionId, clientId },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await tx.account.create({
    data: {
      name: buildAccountName(institutionName),
      type: AccountType.BROKERAGE,
      clientId,
      institutionId,
    },
    select: { id: true },
  })
  return created.id
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
  const institutionNames = Array.from(
    new Set(
      parsedRows
        .map((row) => row.instituicao)
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => normalizeInstitutionName(value)),
    ),
  )

  const [assetsByTicker, classes, allAssets, existingInstitutions] = await Promise.all([
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
    institutionNames.length
      ? prisma.institution.findMany({
          where: { name: { in: institutionNames } },
          select: { name: true, type: true },
        })
      : Promise.resolve([]),
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
  const institutionRowCount = new Map<string, number>()

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

  for (const row of parsedRows) {
    if (!row.instituicao?.trim()) continue
    const normalized = normalizeInstitutionName(row.instituicao)
    institutionRowCount.set(normalized, (institutionRowCount.get(normalized) ?? 0) + 1)
  }

  const existingInstitutionByName = new Map(
    existingInstitutions.map((institution) => [institution.name, institution]),
  )

  const institutionPreviews: InstitutionPreview[] = Array.from(institutionRowCount.entries()).map(
    ([normalizedName, rowCount]) => {
      const existing = existingInstitutionByName.get(normalizedName)
      const inferred = existing?.type ?? inferInstitutionType(normalizedName)
      return {
        normalizedName,
        displayName: buildAccountName(normalizedName),
        inferredType: institutionTypeToPtBr(inferred),
        isNew: !existing,
        rowCount,
      }
    },
  )

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
    institutionPreviews,
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
  const clientId = await getClientForUser(userId)
  const normalizedReadyRows: ParsedRow[] = payload.readyRows.map((row) => ({
    ...row,
    date: ensureDate(row.date),
  }))

  const unresolvedRows = payload.resolutions.flatMap((asset) =>
    asset.rows.map((row) => ({
      ...row,
      date: ensureDate(row.date),
    })),
  )

  const rowsToImport: ParsedRow[] = [...normalizedReadyRows, ...unresolvedRows]
  const uniqueInstitutions = Array.from(
    new Set(
      rowsToImport
        .map((row) => row.instituicao)
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => normalizeInstitutionName(value)),
    ),
  )

  const result = await prisma.$transaction(async (tx) => {
    const resolvedAssetIdByTicker = new Map<string, string>()
    const accountByInstitution = new Map<string, string>()
    let institutionsCreated = 0
    let accountsCreated = 0

    for (const instName of uniqueInstitutions) {
      const existingInst = await tx.institution.findFirst({
        where: { name: instName },
        select: { id: true },
      })

      const institutionId = await upsertInstitution(instName, tx)
      if (!existingInst) institutionsCreated++

      const existingAcc = await tx.account.findFirst({
        where: { institutionId, clientId },
        select: { id: true },
      })

      const accountId = await upsertAccountForInstitution(institutionId, instName, clientId, tx)
      if (!existingAcc) accountsCreated++

      accountByInstitution.set(instName, accountId)
    }

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

    const associateResolutions = payload.resolutions.filter((asset) => asset.resolution?.action === 'associate')
    for (const unresolved of associateResolutions) {
      const existingAssetId = unresolved.resolution?.existingAssetId
      if (!existingAssetId) {
        throw new Error(`Ativo ${unresolved.ticker} sem existingAssetId para associação`)
      }
      resolvedAssetIdByTicker.set(unresolved.ticker, existingAssetId)
    }

    const createResolutions = payload.resolutions.filter((asset) => asset.resolution?.action === 'create')

    const createTickers = createResolutions.map((asset) => asset.ticker)
    const existingAssetsBefore = createTickers.length
      ? await tx.asset.findMany({
          where: { ticker: { in: createTickers } },
          select: { ticker: true },
        })
      : []
    const existingTickersBefore = new Set(existingAssetsBefore.map((asset) => asset.ticker ?? '').filter(Boolean))

    const classCodesToResolve = Array.from(
      new Set(
        createResolutions
          .map((unresolved) => unresolved.resolution?.assetClassId)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    const classRecords = classCodesToResolve.length
      ? await tx.assetClass.findMany({
          where: {
            OR: [
              { id: { in: classCodesToResolve } },
              { code: { in: classCodesToResolve } },
              { name: { in: classCodesToResolve } },
            ],
          },
          select: { id: true, code: true, name: true },
        })
      : []

    const classByAnyKey = new Map<string, { id: string; code: string | null; name: string }>()
    for (const classRecord of classRecords) {
      classByAnyKey.set(classRecord.id, classRecord)
      if (classRecord.code) classByAnyKey.set(classRecord.code, classRecord)
      classByAnyKey.set(classRecord.name, classRecord)
    }

    const assetsToCreate = createResolutions.map((unresolved) => {
      const resolution = unresolved.resolution
      if (!resolution?.assetClassId) {
        throw new Error(`Ativo ${unresolved.ticker} sem classe de ativo para criação`)
      }

      const classRecord = classByAnyKey.get(resolution.assetClassId)
      if (!classRecord) {
        throw new Error(`Classe de ativo inválida para ${unresolved.ticker}`)
      }

      return {
        ticker: unresolved.ticker,
        name: resolution.name?.trim() || unresolved.ticker,
        assetClassId: classRecord.id,
        category:
          resolution.category
          ?? inferAssetCategory(unresolved.inferredClass)
          ?? toDbCategoryFromClassCode(classRecord.code ?? classRecord.name),
      }
    })

    if (assetsToCreate.length > 0) {
      await tx.asset.createMany({
        data: assetsToCreate,
        skipDuplicates: true,
      })
    }

    const allResolvedTickers = Array.from(
      new Set([...createResolutions.map((asset) => asset.ticker), ...associateResolutions.map((asset) => asset.ticker)]),
    )

    if (allResolvedTickers.length > 0) {
      const resolvedAssets = await tx.asset.findMany({
        where: { ticker: { in: allResolvedTickers } },
        select: { id: true, ticker: true },
      })
      for (const asset of resolvedAssets) {
        if (asset.ticker) {
          resolvedAssetIdByTicker.set(asset.ticker, asset.id)
        }
      }
    }

    const txByReferenceId = new Map<string, {
      referenceId: string
      type: 'BUY' | 'SELL'
      accountId: string
      assetId: string
      quantity: Prisma.Decimal
      price: Prisma.Decimal
      totalAmount: Prisma.Decimal
      date: Date
      notes: string
      _meta: ParsedRow
    }>()

    for (const row of rowsToImport) {
      const normalizedInst = normalizeInstitutionName(row.instituicao ?? '')
      const rowAccountId = accountByInstitution.get(normalizedInst)
      if (!rowAccountId) {
        throw new Error(`Conta não encontrada para ${row.instituicao}`)
      }

      const assetId = row.assetId ?? resolvedAssetIdByTicker.get(row.ticker)
      if (!assetId) {
        throw new Error(`Não foi possível resolver ativo para ticker ${row.ticker}`)
      }

      const referenceId = buildNegociacaoIdempotencyKey(row)
      txByReferenceId.set(referenceId, {
        referenceId,
        type: row.type,
        accountId: rowAccountId,
        assetId,
        quantity: new Prisma.Decimal(row.quantity.toString()),
        price: new Prisma.Decimal(row.price.toString()),
        totalAmount: new Prisma.Decimal(row.total.toString()),
        date: row.date,
        notes: `Importacao B3 - Negociacao (${row.instituicao})`,
        _meta: row,
      })
    }

    const uniqueTransactionData = Array.from(txByReferenceId.values())
    const referenceIds = uniqueTransactionData.map((txData) => txData.referenceId)

    const existingTransactions = referenceIds.length
      ? await tx.transaction.findMany({
          where: { referenceId: { in: referenceIds } },
          select: { id: true, referenceId: true },
        })
      : []

    const existingReferenceIds = new Set(existingTransactions.map((transaction) => transaction.referenceId))

    if (uniqueTransactionData.length > 0) {
      await tx.transaction.createMany({
        data: uniqueTransactionData.map((txData) => ({
          referenceId: txData.referenceId,
          type: txData.type,
          accountId: txData.accountId,
          assetId: txData.assetId,
          quantity: txData.quantity,
          price: txData.price,
          totalAmount: txData.totalAmount,
          date: txData.date,
          notes: txData.notes,
        })),
        skipDuplicates: true,
      })
    }

    const insertedReferenceIds = referenceIds.filter((referenceId) => !existingReferenceIds.has(referenceId))

    const insertedTransactions = insertedReferenceIds.length
      ? await tx.transaction.findMany({
          where: { referenceId: { in: insertedReferenceIds } },
          select: { id: true, referenceId: true },
        })
      : []

    const insertedByReferenceId = new Map(
      insertedTransactions.map((transaction) => [transaction.referenceId, transaction.id]),
    )

    const accountIds = Array.from(new Set(uniqueTransactionData.map((transaction) => transaction.accountId)))
    const runningBalances = new Map<string, Prisma.Decimal>()
    for (const accountId of accountIds) {
      const lastLedger = await tx.ledgerEntry.findFirst({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      })
      runningBalances.set(accountId, lastLedger?.balanceAfter ?? new Prisma.Decimal(0))
    }

    const insertedRowsOrdered = uniqueTransactionData
      .filter((txData) => insertedByReferenceId.has(txData.referenceId))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const ledgerEntriesToCreate = insertedRowsOrdered.map((txData) => {
      const isDebit = txData.type === 'BUY'
      const currentBalance = runningBalances.get(txData.accountId) ?? new Prisma.Decimal(0)
      const nextBalance = isDebit
        ? currentBalance.minus(txData.totalAmount)
        : currentBalance.plus(txData.totalAmount)
      runningBalances.set(txData.accountId, nextBalance)

      const transactionId = insertedByReferenceId.get(txData.referenceId)
      if (!transactionId) {
        throw new Error(`Transaction sem ID para referência ${txData.referenceId}`)
      }

      return {
        transactionId,
        accountId: txData.accountId,
        debit: isDebit ? txData.totalAmount : null,
        credit: isDebit ? null : txData.totalAmount,
        balanceAfter: nextBalance,
      }
    })

    if (ledgerEntriesToCreate.length > 0) {
      await tx.ledgerEntry.createMany({ data: ledgerEntriesToCreate })
    }

    const assetsCreated = assetsToCreate.filter((asset) => !existingTickersBefore.has(asset.ticker)).length
    const transactionsImported = insertedTransactions.length
    const transactionsSkipped = uniqueTransactionData.length - transactionsImported
    const affectedAccountIds = Array.from(new Set(uniqueTransactionData.map((txData) => txData.accountId)))

    return {
      assetsCreated,
      institutionsCreated,
      accountsCreated,
      transactionsImported,
      transactionsSkipped,
      affectedAccountIds,
    }
  }, {
    timeout: 60000,
    maxWait: 10000,
  })

  await prisma.auditLog.create({
    data: {
      entityType: 'IMPORT_B3_NEGOCIACAO',
      entityId: 'batch',
      action: 'CREATE',
      previousValue: null,
      newValue: JSON.stringify({ ...result }),
      changedBy: userId,
      changedAt: new Date(),
    },
  })

  for (const accountId of result.affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  return {
    assetsCreated: result.assetsCreated,
    institutionsCreated: result.institutionsCreated,
    accountsCreated: result.accountsCreated,
    transactionsImported: result.transactionsImported,
    transactionsSkipped: result.transactionsSkipped,
  }
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
