'use server'

import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  importMovimentacaoRows,
  importNegociacaoRows,
  importPosicaoRows,
  type ImportResult,
} from '@/modules/b3/service'
import {
  parseMovimentacao,
  parseNegociacao,
  parsePosicao,
  type RawSheet,
} from '@/modules/b3/parser'
import { getPortfolioSummary } from '@/modules/positions/service'
import * as XLSX from 'xlsx'

export type DebugImportStep = 'NEGOCIACAO' | 'MOVIMENTACAO' | 'POSICAO'

export type PreviewTable = {
  columns: string[]
  rows: string[][]
}

export type DebugImportResponse = {
  ok: boolean
  step: DebugImportStep
  summary: {
    parsedRows: number
    imported: number
    skipped: number
    upserted: number
    errorsCount: number
  }
  preview: PreviewTable
  logsMd: string
  errors: string[]
}

type RawRow = Array<string | number | null | undefined>

function workbookFromArrayBuffer(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: 'array', cellDates: false })
}

function sheetRows(workbook: XLSX.WorkBook, sheetName?: string): RawRow[] {
  const resolvedName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0]
  const worksheet = workbook.Sheets[resolvedName]
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  }) as RawRow[]
}

function allSheets(workbook: XLSX.WorkBook): RawSheet[] {
  return workbook.SheetNames.map((name) => ({
    name,
    rows: sheetRows(workbook, name),
  }))
}

function sheetRowsForNegociacao(workbook: XLSX.WorkBook): RawRow[] {
  return sheetRows(workbook, 'Negociação').length > 0
    ? sheetRows(workbook, 'Negociação')
    : sheetRows(workbook, 'Negociacao')
}

async function getUploadedFile(formData: FormData): Promise<File> {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new Error('Arquivo nao enviado')
  }
  if (file.size === 0) {
    throw new Error('Arquivo vazio')
  }
  return file
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function resultToCounts(result: ImportResult) {
  return {
    imported: result.imported ?? 0,
    skipped: result.skipped ?? 0,
    upserted: result.upserted ?? 0,
    errorsCount: result.errors.length,
  }
}

function buildMarkdownLog(step: DebugImportStep, parsedRows: number, result: ImportResult): string {
  const now = new Date().toISOString()
  const summary = resultToCounts(result)
  const errors = result.errors.slice(0, 20)

  return [
    `# Debug Import ${step}`,
    '',
    `- generatedAt: ${now}`,
    `- parsedRows: ${parsedRows}`,
    `- imported: ${summary.imported}`,
    `- skipped: ${summary.skipped}`,
    `- upserted: ${summary.upserted}`,
    `- errorsCount: ${summary.errorsCount}`,
    '',
    '## Errors',
    '',
    errors.length > 0 ? errors.map((item) => `- ${item}`).join('\n') : '- none',
  ].join('\n')
}

function successResponse(
  step: DebugImportStep,
  parsedRows: number,
  preview: PreviewTable,
  result: ImportResult,
): DebugImportResponse {
  const summary = resultToCounts(result)
  return {
    ok: true,
    step,
    summary: {
      parsedRows,
      ...summary,
    },
    preview,
    logsMd: buildMarkdownLog(step, parsedRows, result),
    errors: result.errors,
  }
}

function errorResponse(step: DebugImportStep, message: string): DebugImportResponse {
  return {
    ok: false,
    step,
    summary: {
      parsedRows: 0,
      imported: 0,
      skipped: 0,
      upserted: 0,
      errorsCount: 1,
    },
    preview: { columns: [], rows: [] },
    logsMd: `# Debug Import ${step}\n\n- status: failed\n- error: ${message}`,
    errors: [message],
  }
}

/**
 * Executa importacao e analise de negociacao para depuracao.
 */
export async function importNegociacaoDebug(formData: FormData): Promise<DebugImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('NEGOCIACAO', 'Usuario nao autenticado')
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRowsForNegociacao(workbook)
    const parsed = parseNegociacao(rows)
    const result = await importNegociacaoRows(session.user.id, parsed)

    const preview: PreviewTable = {
      columns: ['Data', 'Tipo', 'Ticker', 'Instituicao', 'Quantidade', 'Preco', 'Total'],
      rows: parsed.slice(0, 10).map((row) => [
        formatDate(row.date),
        row.type,
        row.ticker,
        row.instituicao || '-',
        String(row.quantity),
        String(row.price),
        String(row.total),
      ]),
    }

    return successResponse('NEGOCIACAO', parsed.length, preview, result)
  } catch (error) {
    return errorResponse('NEGOCIACAO', error instanceof Error ? error.message : 'Erro desconhecido')
  }
}

/**
 * Executa importacao e analise de movimentacao para depuracao.
 */
export async function importMovimentacaoDebug(formData: FormData): Promise<DebugImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('MOVIMENTACAO', 'Usuario nao autenticado')
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRows(workbook, 'Movimentação')
    const parsedResult = parseMovimentacao(rows)
    const result = await importMovimentacaoRows(session.user.id, parsedResult.readyRows, parsedResult.reviewRows)

    const preview: PreviewTable = {
      columns: ['Data', 'Tipo', 'Ticker', 'Instituicao', 'Quantidade', 'Valor Operacao'],
      rows: parsedResult.readyRows.slice(0, 10).map((row) => [
        formatDate(row.date),
        row.type,
        row.ticker,
        row.instituicao || '-',
        String(row.quantity),
        String(row.total ?? 0),
      ]),
    }

    return successResponse('MOVIMENTACAO', parsedResult.readyRows.length, preview, result)
  } catch (error) {
    return errorResponse('MOVIMENTACAO', error instanceof Error ? error.message : 'Erro desconhecido')
  }
}

/**
 * Executa importacao e analise de posicao para depuracao.
 */
export async function importPosicaoDebug(formData: FormData): Promise<DebugImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('POSICAO', 'Usuario nao autenticado')
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const parsed = parsePosicao(allSheets(workbook))
    const result = await importPosicaoRows(session.user.id, parsed)

    const preview: PreviewTable = {
      columns: ['Ticker', 'Nome', 'Categoria', 'Quantidade', 'Preco Fechamento', 'Valor Atualizado'],
      rows: parsed.slice(0, 10).map((row) => [
        row.ticker,
        row.name,
        row.category,
        String(row.quantity),
        String(row.closePrice),
        String(row.updatedValue),
      ]),
    }

    return successResponse('POSICAO', parsed.length, preview, result)
  } catch (error) {
    return errorResponse('POSICAO', error instanceof Error ? error.message : 'Erro desconhecido')
  }
}

// ─── analyzeImport ───────────────────────────────────────────────────────────

export type ImportType = 'negociacao' | 'movimentacao' | 'posicao'

export type RecentAuditEntry = {
  id: string
  entityType: string
  action: string
  changedAt: string
  newValue: string | null
}

export type RecentTransaction = {
  id: string
  referenceId: string
  type: string
  accountId: string
  assetId: string | null
  totalAmount: string
  date: string
  notes: string | null
  createdAt: string
}

export type RecentLedgerEntry = {
  id: string
  transactionId: string
  accountId: string
  debit: string | null
  credit: string | null
  balanceAfter: string
  createdAt: string
}

export type DashboardMetrics = {
  totalCost: string
  totalValue: string
  totalGainLoss: string
  assetCount: number
  topPositions: Array<{
    ticker: string
    name: string
    totalCost: string
    currentValue: string | null
  }>
}

export type PostImportDbSnapshot = {
  auditLogsCount: number
  recentAuditLogs: RecentAuditEntry[]
  recentTransactions: RecentTransaction[]
  recentLedgerEntries: RecentLedgerEntry[]
  affectedAccountIds: string[]
  dashboardMetrics: DashboardMetrics | null
}

export type AnalyzeImportResponse = {
  ok: boolean
  type: ImportType
  importResult: {
    parsedRows: number
    imported: number
    skipped: number
    upserted: number
    errorsCount: number
    errors: string[]
  }
  dbSnapshot: PostImportDbSnapshot
  preview: PreviewTable
  logsMd: string
}

const IMPORT_DEBUG_DIR = path.resolve(process.cwd(), 'memory', 'import-debug')
const ENTITY_TYPE_MAP: Record<ImportType, string> = {
  negociacao: 'IMPORT_B3_NEGOCIACAO',
  movimentacao: 'IMPORT_B3_MOVIMENTACAO',
  posicao: 'IMPORT_B3_POSICAO',
}

async function queryPostImportSnapshot(
  userId: string,
  importType: ImportType,
): Promise<PostImportDbSnapshot> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const entityType = ENTITY_TYPE_MAP[importType]

  // Conta AuditLogs recentes do tipo da importacao
  const [auditLogsCount, recentAuditLogs] = await Promise.all([
    prisma.auditLog.count({
      where: { entityType, changedAt: { gte: oneHourAgo } },
    }),
    prisma.auditLog.findMany({
      where: { entityType, changedAt: { gte: oneHourAgo } },
      orderBy: { changedAt: 'desc' },
      take: 5,
      select: { id: true, entityType: true, action: true, changedAt: true, newValue: true },
    }),
  ])

  // Busca transacoes recentes vinculadas ao usuario
  const recentTransactionsRaw = await prisma.transaction.findMany({
    where: {
      createdAt: { gte: oneHourAgo },
      account: { client: { userId } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      referenceId: true,
      type: true,
      accountId: true,
      assetId: true,
      totalAmount: true,
      date: true,
      notes: true,
      createdAt: true,
    },
  })

  const affectedAccountIds = [...new Set(recentTransactionsRaw.map((t) => t.accountId))]

  // LedgerEntries das contas afetadas criados recentemente
  const recentLedgerEntriesRaw =
    affectedAccountIds.length > 0
      ? await prisma.ledgerEntry.findMany({
          where: {
            accountId: { in: affectedAccountIds },
            createdAt: { gte: oneHourAgo },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            transactionId: true,
            accountId: true,
            debit: true,
            credit: true,
            balanceAfter: true,
            createdAt: true,
          },
        })
      : []

  // Metricas do dashboard
  let dashboardMetrics: DashboardMetrics | null = null
  try {
    const summary = await getPortfolioSummary(userId)
    dashboardMetrics = {
      totalCost: summary.totalCost.toString(),
      totalValue: summary.totalValue.toString(),
      totalGainLoss: summary.totalGainLoss.toString(),
      assetCount: summary.assetCount,
      topPositions: summary.topPositions.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        totalCost: p.totalCost,
        currentValue: p.currentValue ?? null,
      })),
    }
  } catch {
    // dashboard nao bloqueia analise
  }

  return {
    auditLogsCount,
    recentAuditLogs: recentAuditLogs.map((a) => ({
      ...a,
      changedAt: a.changedAt.toISOString(),
    })),
    recentTransactions: recentTransactionsRaw.map((t) => ({
      ...t,
      type: String(t.type),
      totalAmount: t.totalAmount.toString(),
      date: t.date.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
    recentLedgerEntries: recentLedgerEntriesRaw.map((entry) => ({
      ...entry,
      debit: entry.debit?.toString() ?? null,
      credit: entry.credit?.toString() ?? null,
      balanceAfter: entry.balanceAfter.toString(),
      createdAt: entry.createdAt.toISOString(),
    })),
    affectedAccountIds,
    dashboardMetrics,
  }
}

function buildAnalyzeMarkdownLog(
  importType: ImportType,
  parsedRows: number,
  result: ImportResult,
  snapshot: PostImportDbSnapshot,
): string {
  const now = new Date().toISOString()
  const counts = resultToCounts(result)
  const errors = result.errors.slice(0, 20)
  const top5 = (snapshot.dashboardMetrics?.topPositions ?? []).slice(0, 5)

  return [
    `# Analise Import ${importType.toUpperCase()}`,
    '',
    `- generatedAt: ${now}`,
    `- parsedRows: ${parsedRows}`,
    `- imported: ${counts.imported}`,
    `- skipped: ${counts.skipped}`,
    `- upserted: ${counts.upserted}`,
    `- errorsCount: ${counts.errorsCount}`,
    '',
    '## BD Snapshot (ultima 1h)',
    '',
    `- auditLogsCount: ${snapshot.auditLogsCount}`,
    `- recentTransactions: ${snapshot.recentTransactions.length}`,
    `- recentLedgerEntries: ${snapshot.recentLedgerEntries.length}`,
    `- affectedAccounts: ${snapshot.affectedAccountIds.join(', ') || 'nenhuma'}`,
    '',
    '## Dashboard Metrics',
    '',
    snapshot.dashboardMetrics
      ? [
          `- totalCost: ${snapshot.dashboardMetrics.totalCost}`,
          `- totalValue: ${snapshot.dashboardMetrics.totalValue}`,
          `- totalGainLoss: ${snapshot.dashboardMetrics.totalGainLoss}`,
          `- assetCount: ${snapshot.dashboardMetrics.assetCount}`,
          '',
          '### Top 5 Posicoes',
          top5.map((p) => `- ${p.ticker}: custo=${p.totalCost} valor=${p.currentValue ?? 'sem_cotacao'}`).join('\n') || '- nenhuma',
        ].join('\n')
      : '- indisponivel',
    '',
    '## Errors',
    '',
    errors.length > 0 ? errors.map((item) => `- ${item}`).join('\n') : '- none',
  ].join('\n')
}

/**
 * Executa importacao B3 completa, consulta BD imediatamente apos e retorna
 * relatorio estruturado com snapshot de auditoria, transacoes, ledger e dashboard.
 */
export async function analyzeImport(
  importType: ImportType,
  file: File,
): Promise<AnalyzeImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      ok: false,
      type: importType,
      importResult: { parsedRows: 0, imported: 0, skipped: 0, upserted: 0, errorsCount: 1, errors: ['Usuario nao autenticado'] },
      dbSnapshot: {
        auditLogsCount: 0,
        recentAuditLogs: [],
        recentTransactions: [],
        recentLedgerEntries: [],
        affectedAccountIds: [],
        dashboardMetrics: null,
      },
      preview: { columns: [], rows: [] },
      logsMd: `# Analise Import ${importType.toUpperCase()}\n\n- status: failed\n- error: Usuario nao autenticado`,
    }
  }

  const userId = session.user.id

  try {
    if (file.size === 0) throw new Error('Arquivo vazio')

    const buffer = await file.arrayBuffer()
    const workbook = workbookFromArrayBuffer(buffer)

    let result: ImportResult
    let parsedRows: number
    let preview: PreviewTable

    if (importType === 'negociacao') {
      const rows = sheetRowsForNegociacao(workbook)
      const parsed = parseNegociacao(rows)
      parsedRows = parsed.length
      result = await importNegociacaoRows(userId, parsed)
      preview = {
        columns: ['Data', 'Tipo', 'Ticker', 'Instituicao', 'Quantidade', 'Preco', 'Total'],
        rows: parsed.slice(0, 10).map((row) => [
          formatDate(row.date),
          row.type,
          row.ticker,
          row.instituicao || '-',
          String(row.quantity),
          String(row.price),
          String(row.total),
        ]),
      }
    } else if (importType === 'movimentacao') {
      const rows = sheetRows(workbook, 'Movimentação')
      const parsedResult = parseMovimentacao(rows)
      parsedRows = parsedResult.readyRows.length
      result = await importMovimentacaoRows(userId, parsedResult.readyRows, parsedResult.reviewRows)
      preview = {
        columns: ['Data', 'Tipo', 'Ticker', 'Instituicao', 'Quantidade', 'Valor Operacao'],
        rows: parsedResult.readyRows.slice(0, 10).map((row) => [
          formatDate(row.date),
          row.type,
          row.ticker,
          row.instituicao || '-',
          String(row.quantity),
          String(row.total ?? 0),
        ]),
      }
    } else {
      const parsed = parsePosicao(allSheets(workbook))
      parsedRows = parsed.length
      result = await importPosicaoRows(userId, parsed)
      preview = {
        columns: ['Ticker', 'Nome', 'Categoria', 'Quantidade', 'Preco Fechamento', 'Valor Atualizado'],
        rows: parsed.slice(0, 10).map((row) => [
          row.ticker,
          row.name,
          row.category,
          String(row.quantity),
          String(row.closePrice),
          String(row.updatedValue),
        ]),
      }
    }

    const snapshot = await queryPostImportSnapshot(userId, importType)
    const logsMd = buildAnalyzeMarkdownLog(importType, parsedRows, result, snapshot)
    const counts = resultToCounts(result)

    revalidatePath('/debug/import')

    return {
      ok: true,
      type: importType,
      importResult: { parsedRows, ...counts, errors: result.errors },
      dbSnapshot: snapshot,
      preview,
      logsMd,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    const emptySnapshot: PostImportDbSnapshot = {
      auditLogsCount: 0,
      recentAuditLogs: [],
      recentTransactions: [],
      recentLedgerEntries: [],
      affectedAccountIds: [],
      dashboardMetrics: null,
    }
    return {
      ok: false,
      type: importType,
      importResult: { parsedRows: 0, imported: 0, skipped: 0, upserted: 0, errorsCount: 1, errors: [message] },
      dbSnapshot: emptySnapshot,
      preview: { columns: [], rows: [] },
      logsMd: `# Analise Import ${importType.toUpperCase()}\n\n- status: failed\n- error: ${message}`,
    }
  }
}

// ─── getDebugLogs ────────────────────────────────────────────────────────────

export type DebugLogFile = {
  filename: string
  content: string
}

/**
 * Le todos os arquivos .md de memory/import-debug/ e retorna array de logs.
 */
export async function getDebugLogs(): Promise<DebugLogFile[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  try {
    const entries = await readdir(IMPORT_DEBUG_DIR)
    const mdFiles = entries.filter((name) => name.endsWith('.md')).sort()

    const logs = await Promise.all(
      mdFiles.map(async (filename) => {
        try {
          const content = await readFile(path.join(IMPORT_DEBUG_DIR, filename), 'utf-8')
          return { filename, content }
        } catch {
          return { filename, content: '(erro ao ler arquivo)' }
        }
      }),
    )

    return logs
  } catch {
    return []
  }
}

// ─── updateIssuesOpen ────────────────────────────────────────────────────────

export type UpdateIssuesResponse = {
  ok: boolean
  appended: number
  error?: string
}

export type DebugAuditLogRow = {
  id: string
  source: string
  action: string
  entity: string
  timestamp: string
  userId: string | null
}

export type DebugTransactionRow = {
  id: string
  accountId: string
  type: string
  quantity: string | null
  price: string | null
  total: string
  notes: string | null
  createdAt: string
}

export type DebugLedgerRow = {
  id: string
  accountId: string
  balanceBefore: string
  balanceAfter: string
  entryType: string
  timestamp: string
}

export type DebugResultsSnapshotResponse = {
  auditLogs: DebugAuditLogRow[]
  transactions: DebugTransactionRow[]
  ledger: DebugLedgerRow[]
  summary: {
    positionsRecalculated: number
    errorsFound: number
    acceptedRecords: number
    totalRecords: number
  }
}

/**
 * Faz append de novos issues em memory/import-debug/issues-open.md.
 * Cada string do array vira um item de lista no arquivo.
 */
export async function updateIssuesOpen(
  newIssues: string[],
): Promise<UpdateIssuesResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, appended: 0, error: 'Usuario nao autenticado' }
  }

  if (!Array.isArray(newIssues) || newIssues.length === 0) {
    return { ok: false, appended: 0, error: 'Nenhum issue fornecido' }
  }

  const sanitized = newIssues
    .map((issue) => String(issue).trim())
    .filter((issue) => issue.length > 0 && issue.length <= 500)

  if (sanitized.length === 0) {
    return { ok: false, appended: 0, error: 'Issues invalidos ou muito longos (max 500 chars cada)' }
  }

  const issuesFile = path.join(IMPORT_DEBUG_DIR, 'issues-open.md')
  const timestamp = new Date().toISOString()
  const lines = sanitized.map((issue) => `- [${timestamp}] ${issue}`)
  const appendBlock = `\n${lines.join('\n')}\n`

  try {
    await mkdir(IMPORT_DEBUG_DIR, { recursive: true })
    await appendFile(issuesFile, appendBlock, 'utf-8')

    revalidatePath('/debug/import')

    return { ok: true, appended: sanitized.length }
  } catch (error) {
    return {
      ok: false,
      appended: 0,
      error: error instanceof Error ? error.message : 'Erro ao gravar issues',
    }
  }
}

/**
 * Retorna snapshot recente para visualizacao de AuditLog, Transaction e Ledger.
 */
export async function getDebugResultsSnapshot(): Promise<DebugResultsSnapshotResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      auditLogs: [],
      transactions: [],
      ledger: [],
      summary: {
        positionsRecalculated: 0,
        errorsFound: 0,
        acceptedRecords: 0,
        totalRecords: 0,
      },
    }
  }

  const userId = session.user.id
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [auditLogsRaw, transactionsRaw, ledgerRaw] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        changedAt: { gte: oneHourAgo },
      },
      orderBy: { changedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        entityType: true,
        action: true,
        changedAt: true,
        changedBy: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        account: { client: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        accountId: true,
        type: true,
        quantity: true,
        price: true,
        totalAmount: true,
        notes: true,
        createdAt: true,
        assetId: true,
      },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        createdAt: { gte: oneHourAgo },
        account: { client: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        accountId: true,
        debit: true,
        credit: true,
        balanceAfter: true,
        createdAt: true,
      },
    }),
  ])

  const auditLogs: DebugAuditLogRow[] = auditLogsRaw.map((row) => ({
    id: row.id,
    source: row.entityType.includes('IMPORT_B3') ? 'B3' : 'Sistema',
    action: row.action,
    entity: row.entityType,
    timestamp: row.changedAt.toISOString(),
    userId: row.changedBy,
  }))

  const transactions: DebugTransactionRow[] = transactionsRaw.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    type: String(row.type),
    quantity: row.quantity?.toString() ?? null,
    price: row.price?.toString() ?? null,
    total: row.totalAmount.toString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }))

  const ledger: DebugLedgerRow[] = ledgerRaw.map((row) => {
    const debit = Number(row.debit?.toString() ?? '0')
    const credit = Number(row.credit?.toString() ?? '0')
    const after = Number(row.balanceAfter.toString())
    const before = after + debit - credit

    return {
      id: row.id,
      accountId: row.accountId,
      balanceBefore: before.toFixed(2),
      balanceAfter: row.balanceAfter.toString(),
      entryType: debit > 0 ? 'DEBIT' : credit > 0 ? 'CREDIT' : 'NEUTRAL',
      timestamp: row.createdAt.toISOString(),
    }
  })

  const positionsRecalculated = new Set(
    transactionsRaw.map((row) => row.assetId).filter((id): id is string => Boolean(id)),
  ).size
  const errorsFound = auditLogs.filter((row) => row.action.toUpperCase().includes('ERROR')).length
  const acceptedRecords = transactions.length + ledger.length
  const totalRecords = acceptedRecords + errorsFound

  return {
    auditLogs,
    transactions,
    ledger,
    summary: {
      positionsRecalculated,
      errorsFound,
      acceptedRecords,
      totalRecords,
    },
  }
}