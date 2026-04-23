import { AccountType, AssetCategory, InstitutionType, Prisma, TransactionType } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import * as positionsService from '@/modules/positions/service'
import { createTransaction } from '@/modules/transactions/service'
import { getCanonicalAssetClassMeta, normalizeInstitutionName as normalizeInstitutionNameFn } from './normalization'
import {
  inferAssetClass,
  type InferredAssetClass,
  type MovimentacaoParsedLine,
  type MovimentacaoReviewRow,
  type MovimentacaoRow,
  type NegociacaoRow,
  type PosicaoParsedLine,
  type PosicaoRow,
} from './parser'

// Re-export for backward compatibility with tests
export const normalizeInstitutionName = normalizeInstitutionNameFn

export type ImportResult = {
  imported?: number
  skipped?: number
  upserted?: number
  errors: string[]
}

export type ParsedRow = NegociacaoRow & {
  assetId?: string
  conta?: string
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

export type InstitutionAccountMapping = {
  normalizedInstitutionName: string
  displayInstitutionName: string
  rowCount: number
  pendingRowReferenceIds: string[]
  rowsWithExplicitAccountCount: number
  rowsWithoutAccountCount: number
  existingAccounts: Array<{
    name: string
  }>
  autoFillStrategy: 'SINGLE_ACCOUNT' | 'MULTIPLE_ACCOUNTS' | 'NO_ACCOUNT_FOUND'
  suggestedAccountName?: string
}

export type InstitutionAccountSummary = {
  institutionsWithAutoFill: number
  institutionsRequiringSelection: number
  totalRowsPendingAccountSelection: number
}

export type AnalyzeNegociacaoResult = ParsedNegociacaoResult & {
  missingClasses: MissingClass[]
  availableClasses: AssetClassOption[]
  existingAssets: ExistingAssetOption[]
  institutionPreviews: InstitutionPreview[]
  institutionAccountMappings: InstitutionAccountMapping[]
  institutionAccountSummary: InstitutionAccountSummary
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

export type ReviewRowAction = 'IMPORT' | 'SKIP'

export type MovimentacaoReviewLine = {
  id: string
  lineNumber: number
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  classification: 'LIQUIDACAO' | 'PROVENTO' | 'EVENTO_CORPORATIVO' | 'IGNORAR' | 'REVISAR'
  reason: string
  action: ReviewRowAction
  referenceId: string
  original: {
    entradaSaida: string
    data: string
    movimentacao: string
    produto: string
    instituicao: string
    quantidade: string
    precoUnitario: string
    valorOperacao: string
  }
  normalized: {
    date: Date | null
    type: TransactionType | null
    ticker: string
    instituicao: string
    quantity: number
    price: number | null
    total: number | null
    referenceId: string
    sourceMovementType: string
    isIncoming: boolean | null
    isTaxExempt: boolean
    subscriptionDeadline: Date | null
  }
  date: Date
  type: TransactionType | null
  ticker: string
  instituicao: string
  conta: string
  quantity: number
  price: number | null
  total: number | null
  sourceMovementType: string
  isIncoming: boolean
  isTaxExempt: boolean
  subscriptionDeadline: Date | null
  issues: string[]
}

export type AnalyzeMovimentacaoResult = {
  lines: MovimentacaoReviewLine[]
  institutionAccountMappings: InstitutionAccountMapping[]
  institutionAccountSummary: InstitutionAccountSummary
  exportArtifacts: {
    mainFile: MovimentacaoReviewLine[]
    reviewFile: MovimentacaoReviewLine[]
    decisionLog: string
  }
  summary: {
    totalRows: number
    importableRows: number
    reviewRows: number
  }
}

export type ConfirmMovimentacaoResult = {
  imported: number
  skipped: number
  reviewed: number
  errors: string[]
}

export type PosicaoReviewLine = {
  id: string
  lineNumber: number
  sheetName: string
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  classification: 'CATALOGO_NOVO' | 'CATALOGO_EXISTENTE' | 'CONFLITO_CADASTRO' | 'DADO_INCONSISTENTE' | 'IGNORAR'
  reason: string
  action: ReviewRowAction
  original: {
    produto: string
    instituicao: string
    conta: string
    codigoNegociacao: string
    tipo: string
    quantidade: string
    precoFechamento: string
    valorAtualizado: string
  }
  normalized: {
    ticker: string
    name: string
    category: PosicaoRow['category'] | null
    quantity: number
    closePrice: number
    updatedValue: number
    instituicao: string
    conta: string
  }
  existingAsset?: {
    id: string
    name: string
    category: AssetCategory
  }
  ticker: string
  name: string
  category: PosicaoRow['category']
  quantity: number
  closePrice: number
  updatedValue: number
  instituicao: string
  conta: string
  issues: string[]
}

export type AnalyzePosicaoResult = {
  lines: PosicaoReviewLine[]
  exportArtifacts: {
    divergenceFile: PosicaoReviewLine[]
    syncLog: string
  }
  summary: {
    totalRows: number
    importableRows: number
    reviewRows: number
  }
}

export type ConfirmPosicaoResult = {
  upserted: number
  skipped: number
  reviewed: number
  errors: string[]
}

export type InstitutionPreview = {
  normalizedName: string
  displayName: string
  inferredType: 'Corretora' | 'Banco' | 'Exchange' | 'Outra'
  isNew: boolean
  accountName: string
  accountStatus: 'NOVA' | 'JÁ EXISTE'
  isAccountNew: boolean
  rowCount: number
}

type ImportAccountResolution = {
  institutionName: string
  institutionId: string
  accountId: string
  accountName: string
  institutionCreated: boolean
  accountCreated: boolean
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

  const isFixedIncomeTicker =
    upperTicker.startsWith('CDB')
    || upperTicker.startsWith('LCI')
    || upperTicker.startsWith('LCA')
    || upperTicker.startsWith('CRI')
    || upperTicker.startsWith('CRA')
    || upperTicker.startsWith('DEB')
    || upperTicker.startsWith('RDB')
    || upperTicker.startsWith('TESOURO')
    || upperTicker.startsWith('TNFS')
    || upperTicker.startsWith('TNLF')
    || upperTicker.startsWith('NTNB')
    || upperTicker.startsWith('NTNF')
    || upperTicker.startsWith('LFT')
    || upperTicker.startsWith('LTN')

  if (lowerMarket.includes('renda fixa') || lowerMarket.includes('tesouro') || isFixedIncomeTicker) {
    return 'FIXED_INCOME'
  }
  if (upperTicker.endsWith('11')) return 'FII'
  return 'STOCK'
}

function toDbCategory(category: PosicaoRow['category']): DbCategory {
  if (category === 'FII') return AssetCategory.FII
  if (category === 'ETF') return AssetCategory.ETF
  if (category === 'BDR') return AssetCategory.BDR
  if (category === 'FIXED_INCOME') return AssetCategory.FIXED_INCOME
  if (category === 'FUND') return AssetCategory.FII
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

function normalizeAccountName(accountName: string | null | undefined, institutionName: string): string {
  const normalized = accountName?.trim()
  if (normalized) return normalized
  return buildAccountName(institutionName)
}

function buildInstitutionAccountKey(institutionName: string, accountName: string): string {
  return `${normalizeInstitutionNameFn(institutionName)}|${normalizeAccountName(accountName, institutionName)}`
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

function extractAssetNameFromProduto(produto: string | undefined, fallbackTicker: string): string {
  const raw = (produto ?? '').trim()
  if (!raw) return fallbackTicker

  const parts = raw.split(' - ').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return parts.slice(1).join(' - ')
  }

  return raw === fallbackTicker ? fallbackTicker : raw
}

function buildNegociacaoIdempotencyKey(row: ParsedRow): string {
  const raw = [
    row.ticker,
    normalizeDate(row.date),
    row.type,
    row.quantity.toString(),
    row.price.toString(),
    row.instituicao,
    normalizeAccountName(row.conta, row.instituicao),
  ].join('|')

  const digest = createHash('sha256').update(raw).digest('hex')
  return `b3-negociacao-${digest}`
}

function buildMovimentacaoIdempotencyKey(row: {
  date: Date
  type: TransactionType
  ticker: string
  instituicao: string
  quantity: number
  total: number | null
  sourceMovementType: string
}): string {
  const raw = [
    row.ticker,
    normalizeDate(row.date),
    row.type,
    row.quantity.toString(),
    (row.total ?? 0).toString(),
    row.instituicao,
    row.sourceMovementType,
  ].join('|')

  const digest = createHash('sha256').update(raw).digest('hex')
  return `b3-movimentacao-${digest}`
}

function scopeReferenceIdForUser(userId: string, referenceId: string): string {
  const normalized = referenceId.trim()
  if (!normalized) return normalized

  const prefix = `usr:${userId}:`
  if (normalized.startsWith(prefix)) {
    return normalized
  }

  return `${prefix}${normalized}`
}

const MOVIMENTACAO_CASHLESS_TYPES = new Set<string>([
  'CUSTODY_TRANSFER',
  'SUBSCRIPTION_RIGHT',
  'SUBSCRIPTION_EXPIRED',
  'RIGHTS_TRANSFER',
  'RIGHTS_TRANSFER_PENDING',
  'CORPORATE_UPDATE',
  'SPLIT',
  'BONUS_SHARES',
  'FRACTIONAL_DEBIT',
  'FRACTIONAL_AUCTION',
])

const MOVIMENTACAO_OPTIONAL_QUANTITY_TYPES = new Set<string>([
  'DIVIDEND',
  'INCOME',
  'MATURITY',
])

function validateMovimentacaoLine(line: {
  type: TransactionType | null
  ticker: string
  instituicao: string
  quantity: number
  total: number | null
  sourceMovementType?: string
}): string[] {
  const issues: string[] = []
  if (!line.ticker.trim()) issues.push('ticker_ausente')
  if (!line.instituicao.trim()) issues.push('instituicao_ausente')
  if (!line.type) issues.push('tipo_transacao_ausente')
  if (line.type && !MOVIMENTACAO_OPTIONAL_QUANTITY_TYPES.has(line.type) && line.quantity <= 0) issues.push('quantidade_invalida')
  if (line.type && !MOVIMENTACAO_CASHLESS_TYPES.has(line.type) && (line.total ?? 0) <= 0) issues.push('valor_total_invalido')
  if (!line.sourceMovementType?.trim()) issues.push('movimentacao_origem_ausente')
  return issues
}

function validatePosicaoLine(line: {
  ticker: string
  name: string
  instituicao: string
}): string[] {
  const issues: string[] = []
  if (!line.ticker.trim()) issues.push('ticker_ausente')
  if (!line.name.trim()) issues.push('nome_ausente')
  if (!line.instituicao.trim()) issues.push('instituicao_ausente')
  return issues
}

function ensureDate(value: Date | string): Date {
  if (value instanceof Date) return value
  return new Date(value)
}

/** Mapeamento de categoria para código de AssetClass no banco. */
const CATEGORY_TO_CLASS_CODE: Record<PosicaoRow['category'], { code: string; name: string; description: string }> = {
  STOCK: { code: 'ACOES', name: 'Ações', description: 'Ações de empresas listadas na B3' },
  FII: { code: 'FII', name: 'Fundos Imobiliários', description: 'FIIs negociados na B3' },
  ETF: { code: 'ETF', name: 'ETFs', description: 'Fundos de índice negociados em bolsa' },
  BDR: { code: 'BDR', name: 'BDRs', description: 'Brazilian Depositary Receipts' },
  FIXED_INCOME: { code: 'RENDA_FIXA', name: 'Renda Fixa', description: 'Títulos de renda fixa (Tesouro, CDB, LCI, LCA etc.)' },
  FUND: { code: 'FII', name: 'Fundos Imobiliários', description: 'FIIs negociados na B3' },
}

/**
 * Busca ou cria a AssetClass correspondente à categoria do ativo.
 * Garante que as classes de referência sempre existam no banco.
 */
async function getAssetClassIdByCategory(category: PosicaoRow['category']): Promise<string> {
  const meta = CATEGORY_TO_CLASS_CODE[category] ?? CATEGORY_TO_CLASS_CODE.STOCK

  const assetClass = await prisma.assetClass.upsert({
    where: { code: meta.code },
    update: {},
    create: { code: meta.code, name: meta.name, description: meta.description },
    select: { id: true },
  })

  if (!assetClass) {
    throw new Error(`Falha ao obter/criar classe de ativo para codigo ${meta.code}`)
  }

  return assetClass.id
}

type ImportContext = {
  clientId?: string
  portfolioId?: string
}

/**
 * Resolve o cliente da importação sem criar defaults implícitos.
 */
export async function getOrCreateClientForUser(userId: string, explicitClientId?: string): Promise<string> {
  if (explicitClientId) {
    const client = await prisma.client.findFirst({
      where: { id: explicitClientId, userId },
      select: { id: true },
    })

    if (!client) {
      throw new Error('clientId invalido para o usuario autenticado')
    }

    return client.id
  }

  const client = await prisma.client.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!client) {
    throw new Error('Nenhum cliente encontrado para importacao. Informe clientId explicitamente ou crie um cliente antes de importar.')
  }

  return client.id
}

/**
 * Resolve o portfolio da importação priorizando clientId quando presente, sem criar defaults.
 */
export async function getOrCreateDefaultPortfolioForUser(
  userId: string,
  tx: TxClient = prisma,
  options: ImportContext = {},
): Promise<string | undefined> {
  if (options.portfolioId) {
    const portfolio = await tx.portfolio.findFirst({
      where: {
        id: options.portfolioId,
        OR: [
          { client: { userId } },
          { userId },
        ],
      },
      select: { id: true },
    })

    if (!portfolio) {
      throw new Error('portfolioId invalido para o usuario autenticado')
    }

    return portfolio.id
  }

  if (options.clientId) {
    const byClient = await tx.portfolio.findFirst({
      where: { clientId: options.clientId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (byClient) {
      return byClient.id
    }
  }

  const byUser = await tx.portfolio.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  return byUser?.id
}

/**
 * Garante a existência de uma instituição pelo nome normalizado.
 */
export async function upsertInstitution(name: string, tx: TxClient): Promise<string> {
  const normalized = normalizeInstitutionNameFn(name)
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
  accountName?: string,
  portfolioId?: string,
): Promise<string> {
  const normalizedAccountName = normalizeAccountName(accountName, institutionName)
  const existing = await tx.account.findFirst({
    where: { institutionId, clientId, name: normalizedAccountName },
    select: { id: true, portfolioId: true },
  })
  if (existing) {
    if (portfolioId && !existing.portfolioId) {
      await tx.account.update({
        where: { id: existing.id },
        data: { portfolioId },
      })
    }
    return existing.id
  }

  const created = await tx.account.create({
    data: {
      name: normalizedAccountName,
      type: AccountType.BROKERAGE,
      clientId,
      institutionId,
      portfolioId: portfolioId ?? null,
    },
    select: { id: true },
  })
  return created.id
}

/**
 * Resolve conta por instituição para importação, criando instituição/conta quando necessário.
 */
export async function resolveImportAccountForInstitution(
  institutionName: string,
  clientId: string,
  tx: TxClient,
  accountName?: string,
  portfolioId?: string,
): Promise<ImportAccountResolution> {
  const normalizedName = normalizeInstitutionNameFn(institutionName)
  const normalizedAccountName = normalizeAccountName(accountName, normalizedName)

  const existingInstitution = await tx.institution.findFirst({
    where: { name: normalizedName },
    select: { id: true },
  })

  const institutionId = await upsertInstitution(normalizedName, tx)

  const existingAccount = await tx.account.findFirst({
    where: { institutionId, clientId, name: normalizedAccountName },
    select: { id: true, name: true },
  })

  const accountId = await upsertAccountForInstitution(
    institutionId,
    normalizedName,
    clientId,
    tx,
    normalizedAccountName,
    portfolioId,
  )

  const resolvedAccountName = existingAccount?.name || normalizedAccountName

  return {
    institutionName: normalizedName,
    institutionId,
    accountId,
    accountName: resolvedAccountName,
    institutionCreated: !existingInstitution,
    accountCreated: !existingAccount,
  }
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

async function getCurrentQuantityForAccountAsset(accountId: string, assetId: string): Promise<Prisma.Decimal> {
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      assetId,
      type: { in: ['BUY', 'SELL'] },
      deletedAt: null,
    },
    select: {
      type: true,
      quantity: true,
    },
  })

  return transactions.reduce((acc, tx) => {
    const qty = tx.quantity ?? new Prisma.Decimal(0)
    if (tx.type === 'BUY') return acc.plus(qty)
    if (tx.type === 'SELL') return acc.minus(qty)
    return acc
  }, new Prisma.Decimal(0))
}

function buildPosicaoAdjustmentReferenceId(
  accountId: string,
  ticker: string,
  targetQuantity: Prisma.Decimal,
  updatedValue: Prisma.Decimal,
): string {
  const raw = `${accountId}|${ticker}|${targetQuantity.toString()}|${updatedValue.toString()}`
  const digest = createHash('sha256').update(raw).digest('hex')
  return `b3-posicao-ajuste-${digest}`
}

async function applyPosicaoSnapshotAdjustment(input: {
  userId: string
  accountId: string
  assetId: string
  ticker: string
  targetQuantity: number
  closePrice: number
  updatedValue: number
  lineNumber?: number
}): Promise<'adjusted' | 'already-matched' | 'idempotent'> {
  const targetQty = new Prisma.Decimal(input.targetQuantity.toString())
  const currentQty = await getCurrentQuantityForAccountAsset(input.accountId, input.assetId)
  const delta = targetQty.minus(currentQty)

  if (delta.eq(0)) {
    return 'already-matched'
  }

  const absoluteDelta = delta.abs()
  const updatedValue = new Prisma.Decimal(Math.max(0, input.updatedValue).toString())
  const closePrice = new Prisma.Decimal(Math.max(0, input.closePrice).toString())

  const avgPriceFromSnapshot = targetQty.gt(0)
    ? updatedValue.div(targetQty)
    : new Prisma.Decimal(0)

  const effectivePrice = avgPriceFromSnapshot.gt(0)
    ? avgPriceFromSnapshot
    : closePrice

  const totalAmount = effectivePrice.gt(0)
    ? effectivePrice.times(absoluteDelta)
    : new Prisma.Decimal(0)

  const referenceId = scopeReferenceIdForUser(
    input.userId,
    buildPosicaoAdjustmentReferenceId(input.accountId, input.ticker, targetQty, updatedValue),
  )

  const tx = await createTransaction({
    referenceId,
    type: delta.gt(0) ? 'BUY' : 'SELL',
    accountId: input.accountId,
    assetId: input.assetId,
    quantity: absoluteDelta.toString(),
    price: effectivePrice.toString(),
    totalAmount: totalAmount.toString(),
    date: new Date(),
    sourceMovementType: 'Importacao Posicao B3',
    notes: `Ajuste de posicao B3${typeof input.lineNumber === 'number' ? ` (linha ${input.lineNumber})` : ''}`,
  })

  return tx.idempotent ? 'idempotent' : 'adjusted'
}

/**
 * Analisa as linhas de negociação e separa o que está pronto do que requer resolução manual.
 */
export async function analyzeNegociacaoRows(rows: NegociacaoRow[], userId?: string): Promise<AnalyzeNegociacaoResult> {
  const parsedRows: ParsedRow[] = rows.map((row) => ({ ...row }))
  const tickers = Array.from(new Set(parsedRows.map((row) => row.ticker)))
  const institutionNames = Array.from(
    new Set(
      parsedRows
        .map((row) => row.instituicao)
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => normalizeInstitutionNameFn(value)),
    ),
  )

  const client = userId
    ? await prisma.client.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    : null

  const [assetsByTicker, classes, allAssets, existingInstitutions, existingAccounts] = await Promise.all([
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
          select: { id: true, name: true, type: true },
        })
      : Promise.resolve([]),
    client?.id
      ? prisma.account.findMany({
          where: {
            clientId: client.id,
            institution: { name: { in: institutionNames } },
          },
          select: { institutionId: true, name: true },
        })
      : Promise.resolve([]),
  ])

  const assetByTicker = new Map(assetsByTicker.map((asset) => [asset.ticker ?? '', asset.id]))
  const availableClasses: AssetClassOption[] = classes.map((assetClass) => ({
    id: assetClass.id,
    name: assetClass.name,
    code: assetClass.code,
  }))
  const existingAssets: ExistingAssetOption[] = allAssets
    .filter((asset) => asset.assetClass !== null)
    .map((asset) => ({
      id: asset.id,
      ticker: asset.ticker,
      name: asset.name,
      className: asset.assetClass!.name,
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
    const normalized = normalizeInstitutionNameFn(row.instituicao)
    institutionRowCount.set(normalized, (institutionRowCount.get(normalized) ?? 0) + 1)
  }

  const existingInstitutionByName = new Map(existingInstitutions.map((institution) => [institution.name, institution]))
  const existingAccountsByInstitutionId = new Map<string, typeof existingAccounts>()
  for (const account of existingAccounts) {
    const current = existingAccountsByInstitutionId.get(account.institutionId) ?? []
    current.push(account)
    existingAccountsByInstitutionId.set(account.institutionId, current)
  }

  const institutionPreviews: InstitutionPreview[] = Array.from(institutionRowCount.entries()).map(
    ([normalizedName, rowCount]) => {
      const existing = existingInstitutionByName.get(normalizedName)
      const inferred = existing?.type ?? inferInstitutionType(normalizedName)
      const accounts = existing ? existingAccountsByInstitutionId.get(existing.id) ?? [] : []
      const firstAccount = accounts[0] ?? null
      const accountName = firstAccount?.name || buildAccountName(normalizedName)
      return {
        normalizedName,
        displayName: buildAccountName(normalizedName),
        inferredType: institutionTypeToPtBr(inferred),
        isNew: !existing,
        accountName,
        accountStatus: firstAccount ? 'JÁ EXISTE' : 'NOVA',
        isAccountNew: !firstAccount,
        rowCount,
      }
    },
  )

  const institutionAccountMappings: InstitutionAccountMapping[] = Array.from(institutionRowCount.entries()).map(
    ([normalizedName, rowCount]) => {
      const existingInstitution = existingInstitutionByName.get(normalizedName)
      const existingInstitutionAccounts = existingInstitution
        ? (existingAccountsByInstitutionId.get(existingInstitution.id) ?? [])
            .map((account) => account.name.trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
        : []

      const rowsForInstitution = parsedRows.filter((row) => normalizeInstitutionNameFn(row.instituicao) === normalizedName)
      const rowsWithExplicitAccountCount = rowsForInstitution.filter((row) => Boolean(row.conta?.trim())).length
      const rowsWithoutAccountCount = rowsForInstitution.length - rowsWithExplicitAccountCount
      const autoFillStrategy = existingInstitutionAccounts.length === 1
        ? 'SINGLE_ACCOUNT'
        : existingInstitutionAccounts.length > 1
          ? 'MULTIPLE_ACCOUNTS'
          : 'NO_ACCOUNT_FOUND'

      return {
        normalizedInstitutionName: normalizedName,
        displayInstitutionName: buildAccountName(normalizedName),
        rowCount,
        pendingRowReferenceIds: rowsForInstitution.map((row) => row.referenceId),
        rowsWithExplicitAccountCount,
        rowsWithoutAccountCount,
        existingAccounts: existingInstitutionAccounts.map((name) => ({ name })),
        autoFillStrategy,
        suggestedAccountName: autoFillStrategy === 'SINGLE_ACCOUNT' ? existingInstitutionAccounts[0] : undefined,
      }
    },
  )

  const institutionAccountSummary: InstitutionAccountSummary = {
    institutionsWithAutoFill: institutionAccountMappings.filter((mapping) => mapping.autoFillStrategy === 'SINGLE_ACCOUNT').length,
    institutionsRequiringSelection: institutionAccountMappings.filter((mapping) => mapping.autoFillStrategy === 'MULTIPLE_ACCOUNTS').length,
    totalRowsPendingAccountSelection: institutionAccountMappings.reduce((sum, mapping) => sum + mapping.rowsWithoutAccountCount, 0),
  }

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
    institutionAccountMappings,
    institutionAccountSummary,
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
  context: ImportContext = {},
): Promise<ConfirmImportResult> {
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
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
        .map((value) => normalizeInstitutionNameFn(value)),
    ),
  )

  const result = await prisma.$transaction(async (tx) => {
    const resolvedAssetIdByTicker = new Map<string, string>()
    const accountByInstitutionAndName = new Map<string, string>()
    let institutionsCreated = 0
    let accountsCreated = 0

    for (const instName of uniqueInstitutions) {
      const rowsForInstitution = rowsToImport.filter((row) => normalizeInstitutionNameFn(row.instituicao) === instName)
      const accountNames = Array.from(new Set(rowsForInstitution.map((row) => normalizeAccountName(row.conta, instName))))

      for (const accountName of accountNames) {
        const resolution = await resolveImportAccountForInstitution(instName, clientId, tx, accountName, portfolioId)

        if (resolution.institutionCreated) institutionsCreated++
        if (resolution.accountCreated) accountsCreated++

        accountByInstitutionAndName.set(buildInstitutionAccountKey(instName, accountName), resolution.accountId)
      }
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
      const normalizedInst = normalizeInstitutionNameFn(row.instituicao ?? '')
      const rowAccountId = accountByInstitutionAndName.get(buildInstitutionAccountKey(normalizedInst, row.conta ?? ''))
      if (!rowAccountId) {
        throw new Error(`Conta não encontrada para ${row.instituicao}`)
      }

      const assetId = row.assetId ?? resolvedAssetIdByTicker.get(row.ticker)
      if (!assetId) {
        throw new Error(`Não foi possível resolver ativo para ticker ${row.ticker}`)
      }

      const referenceId = scopeReferenceIdForUser(userId, buildNegociacaoIdempotencyKey(row))
      txByReferenceId.set(referenceId, {
        referenceId,
        type: row.type,
        accountId: rowAccountId,
        assetId,
        quantity: new Prisma.Decimal(row.quantity.toString()),
        price: new Prisma.Decimal(row.price.toString()),
        totalAmount: new Prisma.Decimal(row.total.toString()),
        date: row.date,
        notes: `Importacao B3 - Negociacao (${row.instituicao}${row.conta ? ` / ${row.conta}` : ''})`,
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

function parsePtBrNumber(raw: string): number {
  const value = raw.trim()
  if (!value || value === '-') return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parsePtBrDate(raw: string): Date {
  const value = raw.trim()
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function extractTickerFromProduto(raw: string): string {
  const value = raw.trim().toUpperCase()
  if (!value) return ''
  const [first] = value.split(' - ')
  return first?.trim() ?? ''
}

/**
 * Analisa movimentações e prepara linhas para revisão antes da persistência.
 */
export async function analyzeMovimentacaoRows(
  parsedLines: MovimentacaoParsedLine[],
  userId?: string,
): Promise<AnalyzeMovimentacaoResult> {
  const institutionNames = Array.from(
    new Set(
      parsedLines
        .map((line) => line.normalized.instituicao)
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => normalizeInstitutionNameFn(value)),
    ),
  )

  const client = userId
    ? await prisma.client.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    : null

  const [existingInstitutions, existingAccounts] = await Promise.all([
    institutionNames.length
      ? prisma.institution.findMany({
          where: { name: { in: institutionNames } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    client?.id
      ? prisma.account.findMany({
          where: {
            clientId: client.id,
            institution: { name: { in: institutionNames } },
          },
          select: { institutionId: true, name: true },
        })
      : Promise.resolve([]),
  ])

  const lines: MovimentacaoReviewLine[] = parsedLines.map((line, index) => {
    const normalizedCandidate = {
      type: line.normalized.type,
      ticker: line.normalized.ticker,
      instituicao: line.normalized.instituicao,
      quantity: line.normalized.quantity,
      total: line.normalized.total,
      sourceMovementType: line.normalized.sourceMovementType,
    }
    const issues = line.status === 'OK'
      ? validateMovimentacaoLine(normalizedCandidate)
      : [line.reason, ...validateMovimentacaoLine(normalizedCandidate)]

    const normalizedDate = line.normalized.date ?? parsePtBrDate(line.raw.data)

    return {
      id: `mov-${index + 1}`,
      lineNumber: line.lineNumber,
      status: line.status,
      classification: line.classification,
      reason: line.reason,
      action: line.status === 'OK' && issues.length === 0 ? 'IMPORT' : 'SKIP',
      referenceId: line.normalized.referenceId,
      original: line.raw,
      normalized: line.normalized,
      date: normalizedDate,
      type: line.normalized.type,
      ticker: line.normalized.ticker,
      instituicao: line.normalized.instituicao,
      conta: '',
      quantity: line.normalized.quantity,
      price: line.normalized.price,
      total: line.normalized.total,
      sourceMovementType: line.normalized.sourceMovementType,
      isIncoming: line.normalized.isIncoming ?? false,
      isTaxExempt: line.normalized.isTaxExempt,
      subscriptionDeadline: line.normalized.subscriptionDeadline,
      issues,
    }
  })

  const institutionRowCount = new Map<string, number>()
  for (const line of lines) {
    if (!line.instituicao?.trim()) continue
    const normalizedInstitution = normalizeInstitutionNameFn(line.instituicao)
    institutionRowCount.set(normalizedInstitution, (institutionRowCount.get(normalizedInstitution) ?? 0) + 1)
  }

  const existingInstitutionByName = new Map(existingInstitutions.map((institution) => [institution.name, institution]))
  const existingAccountsByInstitutionId = new Map<string, typeof existingAccounts>()
  for (const account of existingAccounts) {
    const current = existingAccountsByInstitutionId.get(account.institutionId) ?? []
    current.push(account)
    existingAccountsByInstitutionId.set(account.institutionId, current)
  }

  const institutionAccountMappings: InstitutionAccountMapping[] = Array.from(institutionRowCount.entries()).map(
    ([normalizedName, rowCount]) => {
      const existingInstitution = existingInstitutionByName.get(normalizedName)
      const existingInstitutionAccounts = existingInstitution
        ? (existingAccountsByInstitutionId.get(existingInstitution.id) ?? [])
            .map((account) => account.name.trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
        : []

      const rowsForInstitution = lines.filter((line) => {
        if (!line.instituicao?.trim()) return false
        return normalizeInstitutionNameFn(line.instituicao) === normalizedName
      })
      const rowsWithExplicitAccountCount = rowsForInstitution.filter((line) => Boolean(line.conta?.trim())).length
      const rowsWithoutAccountCount = rowsForInstitution.length - rowsWithExplicitAccountCount
      const autoFillStrategy = existingInstitutionAccounts.length === 1
        ? 'SINGLE_ACCOUNT'
        : existingInstitutionAccounts.length > 1
          ? 'MULTIPLE_ACCOUNTS'
          : 'NO_ACCOUNT_FOUND'

      return {
        normalizedInstitutionName: normalizedName,
        displayInstitutionName: buildAccountName(normalizedName),
        rowCount,
        pendingRowReferenceIds: rowsForInstitution.map((line) => line.referenceId),
        rowsWithExplicitAccountCount,
        rowsWithoutAccountCount,
        existingAccounts: existingInstitutionAccounts.map((name) => ({ name })),
        autoFillStrategy,
        suggestedAccountName: autoFillStrategy === 'SINGLE_ACCOUNT' ? existingInstitutionAccounts[0] : undefined,
      }
    },
  )

  const institutionAccountSummary: InstitutionAccountSummary = {
    institutionsWithAutoFill: institutionAccountMappings.filter((mapping) => mapping.autoFillStrategy === 'SINGLE_ACCOUNT').length,
    institutionsRequiringSelection: institutionAccountMappings.filter((mapping) => mapping.autoFillStrategy === 'MULTIPLE_ACCOUNTS').length,
    totalRowsPendingAccountSelection: institutionAccountMappings.reduce((sum, mapping) => sum + mapping.rowsWithoutAccountCount, 0),
  }

  const mainFile = lines.filter((line) => line.action === 'IMPORT')
  const reviewFile = lines.filter((line) => line.action !== 'IMPORT' || line.status !== 'OK')

  return {
    lines,
    institutionAccountMappings,
    institutionAccountSummary,
    exportArtifacts: {
      mainFile,
      reviewFile,
      decisionLog: JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalRows: lines.length,
        decisions: lines.map((line) => ({
          lineNumber: line.lineNumber,
          action: line.action,
          status: line.status,
          classification: line.classification,
          reason: line.reason,
          issues: line.issues,
          referenceId: line.referenceId,
        })),
      }),
    },
    summary: {
      totalRows: lines.length,
      importableRows: lines.filter((line) => line.action === 'IMPORT' && line.issues.length === 0).length,
      reviewRows: lines.filter((line) => line.status === 'REVISAR' || line.issues.length > 0).length,
    },
  }
}

/**
 * Confirma e persiste movimentações após revisão manual do usuário.
 */
export async function confirmAndImportMovimentacaoForUser(
  userId: string,
  lines: MovimentacaoReviewLine[],
  context: ImportContext = {},
): Promise<ConfirmMovimentacaoResult> {
  console.log(`IMPORT_B3_MOVIMENTACAO: ${lines.length} linhas confirmadas`)
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const lineAudit: Array<Record<string, unknown>> = []
  const affectedAccountIds = new Set<string>()

  for (const line of lines) {
    if (line.action === 'SKIP') {
      skipped++
      lineAudit.push({ id: line.id, action: 'SKIP', issues: line.issues, status: line.status, reason: line.reason })
      continue
    }

    const issues = validateMovimentacaoLine(line)
    if (issues.length > 0) {
      skipped++
      errors.push(`Movimentacao linha ${line.lineNumber}: ${issues.join(', ')}`)
      lineAudit.push({ id: line.id, action: 'SKIP_INVALID', issues, status: line.status, reason: line.reason })
      continue
    }

    try {
      if (!line.type) {
        skipped++
        errors.push(`Movimentacao linha ${line.lineNumber}: tipo_transacao_ausente`)
        lineAudit.push({ id: line.id, action: 'SKIP_INVALID', issues: ['tipo_transacao_ausente'], status: line.status, reason: line.reason })
        continue
      }

      const resolution = await resolveImportAccountForInstitution(
        line.instituicao,
        clientId,
        prisma,
        line.conta,
        portfolioId,
      )
      const category = inferCategoryFromTickerAndMarket(line.ticker)
      const assetName = extractAssetNameFromProduto(line.original?.produto, line.ticker)
      const assetId = await upsertAssetFromImport(line.ticker, assetName, category)

      const referenceIdBase = line.referenceId?.trim()
        ? line.referenceId
        : buildMovimentacaoIdempotencyKey({
            date: ensureDate(line.date),
          type: line.type,
            ticker: line.ticker,
            instituicao: line.instituicao,
            quantity: line.quantity,
            total: line.total,
            sourceMovementType: line.sourceMovementType,
          })
      const referenceId = scopeReferenceIdForUser(userId, referenceIdBase)

      const tx = await createTransaction({
        referenceId,
        type: line.type,
        accountId: resolution.accountId,
        assetId,
        quantity: line.quantity,
        price: line.price ?? undefined,
        totalAmount: line.total ?? 0,
        date: ensureDate(line.date),
        sourceMovementType: line.sourceMovementType,
        isTaxExempt: line.isTaxExempt,
        subscriptionDeadline: line.subscriptionDeadline ?? undefined,
        isIncoming: line.isIncoming,
        ledgerMovementType: line.sourceMovementType,
        ledgerDescription: `Importacao B3 - ${line.sourceMovementType} (${line.instituicao}${line.conta ? ` / ${line.conta}` : ''})`,
        notes: `Importacao B3 - Movimentacao (${line.instituicao}${line.conta ? ` / ${line.conta}` : ''})`,
      })

      if (tx.idempotent) {
        skipped++
        lineAudit.push({ id: line.id, action: 'IDEMPOTENT_SKIP', referenceId })
      } else {
        imported++
        affectedAccountIds.add(resolution.accountId)
        lineAudit.push({ id: line.id, action: 'IMPORTED', referenceId, accountId: resolution.accountId })
      }
    } catch (error) {
      skipped++
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Movimentacao linha ${line.lineNumber}: ${message}`)
      lineAudit.push({ id: line.id, action: 'ERROR', error: message })
    }
  }

  try {
    await prisma.auditLog.create({
      data: {
        entityType: 'IMPORT_B3_MOVIMENTACAO',
        entityId: 'batch-confirm',
        action: 'CREATE',
        previousValue: null,
        newValue: JSON.stringify({ imported, skipped, reviewed: lines.length, errors, lines: lineAudit }),
        changedBy: userId,
        changedAt: new Date(),
      },
    })
  } catch (auditError) {
    console.error('IMPORT_B3_MOVIMENTACAO: falha ao gravar AuditLog', auditError)
  }

  for (const accountId of affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  return {
    imported,
    skipped,
    reviewed: lines.length,
    errors,
  }
}

/**
 * Analisa posições e prepara revisão antes da persistência.
 */
export async function analyzePosicaoRows(parsedLines: PosicaoParsedLine[]): Promise<AnalyzePosicaoResult> {
  const tickers = Array.from(new Set(parsedLines.map((line) => line.normalized.ticker).filter(Boolean)))
  const existingAssets = tickers.length
    ? await prisma.asset.findMany({
        where: { ticker: { in: tickers } },
        select: { id: true, ticker: true, name: true, category: true },
      })
    : []

  const existingByTicker = new Map(
    existingAssets
      .filter((asset) => Boolean(asset.ticker))
      .map((asset) => [asset.ticker as string, asset]),
  )

  const lines: PosicaoReviewLine[] = parsedLines.map((line, index) => {
    const existing = line.normalized.ticker ? existingByTicker.get(line.normalized.ticker) : undefined
    const issues = validatePosicaoLine({
      ticker: line.normalized.ticker,
      name: line.normalized.name,
      instituicao: line.normalized.instituicao,
    })

    let status = line.status
    let classification = line.classification
    let reason = line.reason

    if (existing) {
      const normalizedCategory = line.normalized.category ? toDbCategory(line.normalized.category) : null
      const hasConflict = (normalizedCategory && existing.category !== normalizedCategory)
        || (line.normalized.name.trim() && existing.name.trim().toUpperCase() !== line.normalized.name.trim().toUpperCase())

      if (hasConflict) {
        status = 'REVISAR'
        classification = 'CONFLITO_CADASTRO'
        reason = 'conflito_entre_posicao_e_cadastro'
        if (!issues.includes('conflito_cadastro')) {
          issues.push('conflito_cadastro')
        }
      } else if (status === 'OK') {
        classification = 'CATALOGO_EXISTENTE'
        reason = 'ativo_existente_reconciliado'
      }
    } else if (status === 'OK') {
      classification = 'CATALOGO_NOVO'
      reason = 'ativo_novo_para_criacao'
    }

    const normalizedCategory = line.normalized.category ?? 'STOCK'

    return {
      id: `pos-${index + 1}`,
      lineNumber: line.lineNumber,
      sheetName: line.sheetName,
      status,
      classification,
      reason,
      action: status === 'OK' && issues.length === 0 ? 'IMPORT' : 'SKIP',
      original: line.raw,
      normalized: line.normalized,
      existingAsset: existing
        ? {
            id: existing.id,
            name: existing.name,
            category: existing.category,
          }
        : undefined,
      ticker: line.normalized.ticker,
      name: line.normalized.name,
      category: normalizedCategory,
      quantity: line.normalized.quantity,
      closePrice: line.normalized.closePrice,
      updatedValue: line.normalized.updatedValue,
      instituicao: line.normalized.instituicao,
      conta: line.normalized.conta,
      issues,
    }
  })

  const divergenceFile = lines.filter((line) => line.status !== 'OK' || line.action !== 'IMPORT')

  return {
    lines,
    exportArtifacts: {
      divergenceFile,
      syncLog: JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalRows: lines.length,
        divergences: divergenceFile.map((line) => ({
          lineNumber: line.lineNumber,
          ticker: line.ticker,
          status: line.status,
          classification: line.classification,
          reason: line.reason,
          issues: line.issues,
        })),
      }),
    },
    summary: {
      totalRows: lines.length,
      importableRows: lines.filter((line) => line.action === 'IMPORT' && line.issues.length === 0).length,
      reviewRows: lines.filter((line) => line.status === 'REVISAR' || line.issues.length > 0).length,
    },
  }
}

/**
 * Confirma e persiste posições após revisão manual do usuário.
 */
export async function confirmAndImportPosicaoForUser(
  userId: string,
  lines: PosicaoReviewLine[],
  context: ImportContext = {},
): Promise<ConfirmPosicaoResult> {
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
  let upserted = 0
  let skipped = 0
  const errors: string[] = []
  const lineAudit: Array<Record<string, unknown>> = []
  const affectedAccountIds = new Set<string>()
  const tickers = Array.from(new Set(lines.map((line) => line.ticker).filter(Boolean)))
  const existingBefore = tickers.length
    ? await prisma.asset.findMany({ where: { ticker: { in: tickers } }, select: { ticker: true } })
    : []
  const existingTickerSet = new Set(existingBefore.map((asset) => asset.ticker ?? '').filter(Boolean))

  for (const line of lines) {
    if (line.action === 'SKIP') {
      skipped++
      lineAudit.push({ id: line.id, action: 'SKIP', issues: line.issues })
      continue
    }

    const issues = validatePosicaoLine(line)
    if (issues.length > 0) {
      skipped++
      errors.push(`Posicao linha ${line.lineNumber}: ${issues.join(', ')}`)
      lineAudit.push({ id: line.id, action: 'SKIP_INVALID', issues })
      continue
    }

    try {
      const resolution = await resolveImportAccountForInstitution(line.instituicao, clientId, prisma, line.conta, portfolioId)
      const assetId = await upsertAssetFromImport(line.ticker, line.name, line.category)
      const adjustment = await applyPosicaoSnapshotAdjustment({
        userId,
        accountId: resolution.accountId,
        assetId,
        ticker: line.ticker,
        targetQuantity: line.quantity,
        closePrice: line.closePrice,
        updatedValue: line.updatedValue,
        lineNumber: line.lineNumber,
      })

      upserted++
      affectedAccountIds.add(resolution.accountId)
      const wasExisting = existingTickerSet.has(line.ticker)
      lineAudit.push({
        id: line.id,
        action: wasExisting ? 'UPDATED' : 'CREATED',
        ticker: line.ticker,
        classification: line.classification,
        reason: line.reason,
        positionAdjustment: adjustment,
      })
      existingTickerSet.add(line.ticker)
    } catch (error) {
      skipped++
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Posicao linha ${line.lineNumber}: ${message}`)
      lineAudit.push({ id: line.id, action: 'ERROR', error: message, classification: line.classification, reason: line.reason })
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: 'IMPORT_B3_POSICAO',
      entityId: 'batch-confirm',
      action: 'CREATE',
      previousValue: null,
      newValue: JSON.stringify({ upserted, skipped, reviewed: lines.length, errors, lines: lineAudit }),
      changedBy: userId,
      changedAt: new Date(),
    },
  })

  for (const accountId of affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  return {
    upserted,
    skipped,
    reviewed: lines.length,
    errors,
  }
}

/**
 * Importa linhas de negociacao criando transacoes idempotentes.
 */
export async function importNegociacaoRows(
  userId: string,
  rows: NegociacaoRow[],
  context: ImportContext = {},
): Promise<ImportResult> {
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const reviewRows: Array<{ referenceId: string; reason: string; instituicao: string }> = []
  const institutionAudit = new Map<string, { accountName: string; institutionCreated: boolean; accountCreated: boolean }>()
  const affectedAccountIds = new Set<string>()

  for (const row of rows) {
    try {
      if (!row.instituicao?.trim()) {
        reviewRows.push({ referenceId: row.referenceId, reason: 'instituicao_ausente', instituicao: '' })
        skipped++
        continue
      }

      const resolution = await resolveImportAccountForInstitution(row.instituicao, clientId, prisma, undefined, portfolioId)
      institutionAudit.set(resolution.institutionName, {
        accountName: resolution.accountName,
        institutionCreated: resolution.institutionCreated,
        accountCreated: resolution.accountCreated,
      })

      const category = inferCategoryFromTickerAndMarket(row.ticker, row.mercado)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)

      const tx = await createTransaction({
        referenceId: scopeReferenceIdForUser(userId, row.referenceId),
        type: row.type,
        accountId: resolution.accountId,
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
        affectedAccountIds.add(resolution.accountId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Negociacao ${row.referenceId}: ${message}`)
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: 'IMPORT_B3_NEGOCIACAO',
      entityId: 'batch',
      action: 'CREATE',
      previousValue: null,
      newValue: JSON.stringify({
        imported,
        skipped,
        errors,
        reviewRows,
        institutions: Array.from(institutionAudit.entries()).map(([institution, info]) => ({
          institution,
          accountName: info.accountName,
          institutionStatus: info.institutionCreated ? 'NOVA' : 'JÁ EXISTE',
          accountStatus: info.accountCreated ? 'NOVA' : 'JÁ EXISTE',
        })),
      }),
      changedBy: userId,
      changedAt: new Date(),
    },
  })

  for (const accountId of affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  return { imported, skipped, errors }
}

/**
 * Importa linhas de movimentacao criando transacoes idempotentes.
 */
export async function importMovimentacaoRows(
  userId: string,
  rows: MovimentacaoRow[],
  parserReviewRows: MovimentacaoReviewRow[] = [],
  context: ImportContext = {},
): Promise<ImportResult> {
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const runtimeReviewRows: Array<{ referenceId: string; reason: string; instituicao: string }> = []
  const institutionAudit = new Map<string, { accountName: string; institutionCreated: boolean; accountCreated: boolean }>()
  const affectedAccountIds = new Set<string>()

  for (const row of rows) {
    try {
      if (!row.instituicao?.trim()) {
        runtimeReviewRows.push({ referenceId: row.referenceId, reason: 'instituicao_ausente', instituicao: '' })
        skipped++
        continue
      }

      const resolution = await resolveImportAccountForInstitution(row.instituicao, clientId, prisma, undefined, portfolioId)
      institutionAudit.set(resolution.institutionName, {
        accountName: resolution.accountName,
        institutionCreated: resolution.institutionCreated,
        accountCreated: resolution.accountCreated,
      })

      const category = inferCategoryFromTickerAndMarket(row.ticker)
      const assetId = await upsertAssetFromImport(row.ticker, row.ticker, category)
      const totalAmount = row.total ?? 0
      const issues = validateMovimentacaoLine({
        type: row.type,
        ticker: row.ticker,
        instituicao: row.instituicao,
        quantity: row.quantity,
        total: row.total,
        sourceMovementType: row.sourceMovementType,
      })

      if (issues.length > 0) {
        runtimeReviewRows.push({
          referenceId: row.referenceId,
          reason: issues.join(','),
          instituicao: row.instituicao,
        })
        skipped++
        continue
      }

      const tx = await createTransaction({
        referenceId: scopeReferenceIdForUser(userId, row.referenceId),
        type: row.type,
        accountId: resolution.accountId,
        assetId,
        quantity: row.quantity,
        price: row.price ?? undefined,
        totalAmount,
        date: row.date,
        sourceMovementType: row.sourceMovementType,
        isTaxExempt: row.isTaxExempt,
        subscriptionDeadline: row.subscriptionDeadline ?? undefined,
        isIncoming: row.isIncoming,
        ledgerMovementType: row.sourceMovementType,
        ledgerDescription: `Importacao B3 - ${row.sourceMovementType} (${row.instituicao})`,
        notes: `Importacao B3 - Movimentacao (${row.instituicao})`,
      })

      if (tx.idempotent) {
        skipped++
      } else {
        imported++
        affectedAccountIds.add(resolution.accountId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Movimentacao ${row.referenceId}: ${message}`)
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: 'IMPORT_B3_MOVIMENTACAO',
      entityId: 'batch',
      action: 'CREATE',
      previousValue: null,
      newValue: JSON.stringify({
        imported,
        skipped,
        errors,
        reviewRows: {
          parser: parserReviewRows,
          runtime: runtimeReviewRows,
        },
        invalidRows: parserReviewRows.length,
        institutions: Array.from(institutionAudit.entries()).map(([institution, info]) => ({
          institution,
          accountName: info.accountName,
          institutionStatus: info.institutionCreated ? 'NOVA' : 'JÁ EXISTE',
          accountStatus: info.accountCreated ? 'NOVA' : 'JÁ EXISTE',
        })),
      }),
      changedBy: userId,
      changedAt: new Date(),
    },
  })

  for (const accountId of affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  const parserReviewMessages = parserReviewRows.map((item) => (
    `REVISAR linha ${item.lineNumber}: ${item.reason}`
  ))

  return {
    imported,
    skipped: skipped + parserReviewRows.length,
    errors: [...errors, ...parserReviewMessages],
  }
}

/**
 * Importa linhas de posicao sincronizando apenas o catalogo de ativos.
 */
export async function importPosicaoRows(
  userId: string,
  rows: PosicaoRow[],
  context: ImportContext = {},
): Promise<ImportResult> {
  const clientId = await getOrCreateClientForUser(userId, context.clientId)
  const portfolioId = await getOrCreateDefaultPortfolioForUser(userId, prisma, {
    clientId,
    portfolioId: context.portfolioId,
  })
  let upserted = 0
  let skipped = 0
  const errors: string[] = []
  const reviewRows: Array<{ ticker: string; reason: string; instituicao: string }> = []
  const institutionAudit = new Map<string, { accountName: string; institutionCreated: boolean; accountCreated: boolean }>()
  const affectedAccountIds = new Set<string>()

  for (const row of rows) {
    try {
      if (!row.instituicao?.trim()) {
        reviewRows.push({ ticker: row.ticker, reason: 'instituicao_ausente', instituicao: '' })
        skipped++
        continue
      }

      const resolution = await resolveImportAccountForInstitution(row.instituicao, clientId, prisma, row.conta, portfolioId)
      institutionAudit.set(resolution.institutionName, {
        accountName: resolution.accountName,
        institutionCreated: resolution.institutionCreated,
        accountCreated: resolution.accountCreated,
      })

      const assetId = await upsertAssetFromImport(row.ticker, row.name, row.category)
      await applyPosicaoSnapshotAdjustment({
        userId,
        accountId: resolution.accountId,
        assetId,
        ticker: row.ticker,
        targetQuantity: row.quantity,
        closePrice: row.closePrice,
        updatedValue: row.updatedValue,
      })
      upserted++
      affectedAccountIds.add(resolution.accountId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      errors.push(`Posicao ${row.ticker}: ${message}`)
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: 'IMPORT_B3_POSICAO',
      entityId: 'batch',
      action: 'CREATE',
      previousValue: null,
      newValue: JSON.stringify({
        upserted,
        skipped,
        errors,
        reviewRows,
        institutions: Array.from(institutionAudit.entries()).map(([institution, info]) => ({
          institution,
          accountName: info.accountName,
          institutionStatus: info.institutionCreated ? 'NOVA' : 'JÁ EXISTE',
          accountStatus: info.accountCreated ? 'NOVA' : 'JÁ EXISTE',
        })),
      }),
      changedBy: userId,
      changedAt: new Date(),
    },
  })

  for (const accountId of affectedAccountIds) {
    await positionsService.recalcPositions(accountId)
  }

  return { upserted, skipped, errors }
}
