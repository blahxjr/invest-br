'use server'

import { auth } from '@/lib/auth'
import { resetImportData } from '@/modules/b3/reset-service'
import {
  analyzeMovimentacaoRows,
  analyzeNegociacaoRows,
  analyzePosicaoRows,
  confirmAndImportMovimentacaoForUser,
  confirmAndImportNegociacaoForUser,
  confirmAndImportPosicaoForUser,
  type AssetClassOption,
  type AnalyzeMovimentacaoResult,
  type AnalyzeNegociacaoResult,
  type AnalyzePosicaoResult,
  type ConfirmMovimentacaoResult,
  type ConfirmPosicaoResult,
  type ConfirmImportResult,
  type ExistingAssetOption,
  type ImportPayload,
  type InstitutionAccountMapping,
  type InstitutionAccountSummary,
  type InstitutionPreview,
  type MissingClass,
  type MovimentacaoReviewLine,
  type PosicaoReviewLine,
  importNegociacaoRows,
  type ImportResult,
} from '@/modules/b3/service'
import {
  parseMovimentacaoForReview,
  parseNegociacao,
  parsePosicaoForReview,
  type RawSheet,
} from '@/modules/b3/parser'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

export type SerializableParsedRow = {
  date: string
  type: 'BUY' | 'SELL'
  ticker: string
  mercado: string
  instituicao: string
  conta?: string
  quantity: number
  price: number
  total: number
  referenceId: string
  assetId?: string
}

export type SerializableUnresolvedAsset = {
  ticker: string
  suggestedName: string
  inferredClass: 'FII' | 'ETF' | 'ACAO' | 'RENDA_FIXA' | null
  inferredCategory:
    | 'STOCK'
    | 'FII'
    | 'ETF'
    | 'FIXED_INCOME'
    | 'FUND'
    | 'CRYPTO'
    | 'METAL'
    | 'REAL_ESTATE'
    | 'CASH'
    | 'BDR'
    | null
  rows: SerializableParsedRow[]
  resolution?: {
    action: 'create' | 'associate'
    assetClassId?: string
    existingAssetId?: string
    name?: string
    category?:
      | 'STOCK'
      | 'FII'
      | 'ETF'
      | 'FIXED_INCOME'
      | 'FUND'
      | 'CRYPTO'
      | 'METAL'
      | 'REAL_ESTATE'
      | 'CASH'
      | 'BDR'
  }
}

export type SerializableMissingClass = MissingClass & {
  name: string
  code: string
  description?: string
}

export type SerializableAssetClassOption = AssetClassOption
export type SerializableAssetOption = ExistingAssetOption

export type AnalyzeNegociacaoResponse = {
  ready: SerializableParsedRow[]
  unresolvedAssets: SerializableUnresolvedAsset[]
  missingClasses: SerializableMissingClass[]
  availableClasses: SerializableAssetClassOption[]
  existingAssets: SerializableAssetOption[]
  institutionPreviews: InstitutionPreview[]
  institutionAccountMappings: InstitutionAccountMapping[]
  institutionAccountSummary: InstitutionAccountSummary
  summary: {
    totalRows: number
    readyCount: number
    unresolvedCount: number
    uniqueUnresolvedTickers: string[]
  }
  error?: string
}

export type ConfirmImportPayload = {
  readyRows: SerializableParsedRow[]
  classesToCreate: Array<{
    inferredCode: string
    name: string
    code: string
    description?: string
  }>
  resolutions: SerializableUnresolvedAsset[]
}

export type ConfirmImportResponse = ConfirmImportResult & {
  error?: string
}

export type SerializableMovimentacaoLine = Omit<MovimentacaoReviewLine, 'date' | 'normalized'> & {
  date: string
  normalized: Omit<MovimentacaoReviewLine['normalized'], 'date'> & {
    date: string | null
  }
}

export type AnalyzeMovimentacaoResponse = Omit<AnalyzeMovimentacaoResult, 'lines' | 'exportArtifacts'> & {
  lines: SerializableMovimentacaoLine[]
  exportArtifacts: {
    mainFile: SerializableMovimentacaoLine[]
    reviewFile: SerializableMovimentacaoLine[]
    decisionLog: string
  }
  error?: string
}

export type ConfirmMovimentacaoPayload = {
  lines: SerializableMovimentacaoLine[]
}

export type ConfirmMovimentacaoResponse = ConfirmMovimentacaoResult & {
  error?: string
}

export type AnalyzePosicaoResponse = AnalyzePosicaoResult & {
  exportArtifacts: {
    divergenceFile: PosicaoReviewLine[]
    syncLog: string
  }
  error?: string
}

export type ConfirmPosicaoPayload = {
  lines: PosicaoReviewLine[]
}

export type ConfirmPosicaoResponse = ConfirmPosicaoResult & {
  error?: string
}

export type ResetImportResponse = {
  success: boolean
  summary?: {
    auditLogsDeleted: number
    ledgerEntriesDeleted: number
    incomeEventsDeleted: number
    rentalReceiptsDeleted: number
    transactionsDeleted: number
    accountsDeleted: number
    institutionsDeleted: number
    assetsDeleted: number
    assetClassesDeleted: number
  }
  error?: string
}

function workbookFromArrayBuffer(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: 'array', cellDates: false })
}

function sheetRows(workbook: XLSX.WorkBook, sheetName?: string): Array<Array<string | number | null | undefined>> {
  const resolvedName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0]
  const worksheet = workbook.Sheets[resolvedName]
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  }) as Array<Array<string | number | null | undefined>>
}

function allSheets(workbook: XLSX.WorkBook): RawSheet[] {
  return workbook.SheetNames.map((name) => ({
    name,
    rows: sheetRows(workbook, name),
  }))
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

/**
 * Detecta o nome normalizado da sheet B3 a partir do nome do arquivo.
 */
function sheetNameFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (/acoes|ações/.test(lower)) return 'Acoes'
  if (/bdr/.test(lower)) return 'BDR'
  if (/etf/.test(lower)) return 'ETF'
  if (/fundos/.test(lower)) return 'Fundo de Investimento'
  if (/rendafixa|renda[_\-.~]fixa/.test(lower)) return 'Renda Fixa'
  if (/tesourodireto|tesouro[_\-.~]direto/.test(lower)) return 'Tesouro Direto'
  return filename
}

/**
 * Lê múltiplos arquivos CSV/XLSX do formData e os unifica em um array de RawSheets.
 * Usa o nome do arquivo para determinar o tipo da sheet.
 */
async function sheetsFromMultipleFiles(formData: FormData): Promise<RawSheet[]> {
  const entries = formData.getAll('files')
  const files = entries.filter((e): e is File => e instanceof File && e.size > 0)

  if (files.length === 0) {
    // fallback: tenta campo singular 'file'
    const single = formData.get('file')
    if (single instanceof File && single.size > 0) {
      const wb = workbookFromArrayBuffer(await single.arrayBuffer())
      return allSheets(wb)
    }
    throw new Error('Nenhum arquivo enviado')
  }

  const combined: RawSheet[] = []
  for (const file of files) {
    const wb = workbookFromArrayBuffer(await file.arrayBuffer())
    const detectedName = sheetNameFromFilename(file.name)
    combined.push({
      name: detectedName,
      rows: sheetRows(wb, wb.SheetNames[0]),
    })
  }
  return combined
}

function sheetRowsForNegociacao(workbook: XLSX.WorkBook): Array<Array<string | number | null | undefined>> {
  return sheetRows(workbook, 'Negociação').length > 0
    ? sheetRows(workbook, 'Negociação')
    : sheetRows(workbook, 'Negociacao')
}

function serializeAnalyzeResult(result: AnalyzeNegociacaoResult): AnalyzeNegociacaoResponse {
  return {
    ...result,
    missingClasses: result.missingClasses.map((missingClass) => ({
      ...missingClass,
      name: missingClass.suggestedName,
      code: missingClass.inferredCode === 'ACAO' ? 'ACOES' : missingClass.inferredCode,
      description: missingClass.suggestedDescription,
    })),
    ready: result.ready.map((row) => ({ ...row, date: row.date.toISOString() })),
    unresolvedAssets: result.unresolvedAssets.map((asset) => ({
      ...asset,
      rows: asset.rows.map((row) => ({ ...row, date: row.date.toISOString() })),
    })),
  }
}

function toImportPayload(payload: ConfirmImportPayload): ImportPayload {
  return {
    readyRows: payload.readyRows.map((row) => ({ ...row, date: new Date(row.date) })),
    classesToCreate: payload.classesToCreate,
    resolutions: payload.resolutions.map((asset) => ({
      ...asset,
      rows: asset.rows.map((row) => ({ ...row, date: new Date(row.date) })),
    })),
  }
}

function toMovimentacaoLines(lines: SerializableMovimentacaoLine[]): MovimentacaoReviewLine[] {
  return lines.map((line) => ({
    ...line,
    date: new Date(line.date),
    normalized: {
      ...line.normalized,
      date: line.normalized.date ? new Date(line.normalized.date) : null,
    },
  }))
}

/**
 * Importa planilha de negociacao da B3.
 */
export async function importNegociacao(formData: FormData): Promise<ImportResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { imported: 0, skipped: 0, errors: ['Usuario nao autenticado'] }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRows(workbook, 'Negociação')
    const parsedRows = parseNegociacao(rows)

    return importNegociacaoRows(session.user.id, parsedRows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { imported: 0, skipped: 0, errors: [message] }
  }
}

/**
 * Importa planilha de movimentacao da B3.
 */
export async function importMovimentacao(formData: FormData): Promise<ImportResult> {
  void formData
  return {
    imported: 0,
    skipped: 0,
    errors: ['Fluxo direto desabilitado: use análise, revisão e confirmação de movimentação.'],
  }
}

/**
 * Importa planilha de posicao da B3 para sincronizar o catalogo de ativos.
 */
export async function importPosicao(formData: FormData): Promise<ImportResult> {
  void formData
  return {
    upserted: 0,
    errors: ['Fluxo direto desabilitado: use análise, revisão e confirmação de posição.'],
  }
}

/**
 * Analisa planilha de movimentação da B3 sem persistir dados.
 */
export async function analyzeMovimentacaoFile(formData: FormData): Promise<AnalyzeMovimentacaoResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      lines: [],
      institutionAccountMappings: [],
      institutionAccountSummary: {
        institutionsWithAutoFill: 0,
        institutionsRequiringSelection: 0,
        totalRowsPendingAccountSelection: 0,
      },
      exportArtifacts: {
        mainFile: [],
        reviewFile: [],
        decisionLog: JSON.stringify({ generatedAt: new Date().toISOString(), totalRows: 0, decisions: [] }),
      },
      summary: { totalRows: 0, importableRows: 0, reviewRows: 0 },
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRows(workbook, 'Movimentação')
    const parsedLines = parseMovimentacaoForReview(rows)
    const result = await analyzeMovimentacaoRows(parsedLines, session.user.id)

    const serializeLine = (line: AnalyzeMovimentacaoResult['lines'][number]): SerializableMovimentacaoLine => ({
      ...line,
      date: line.date.toISOString(),
      normalized: {
        ...line.normalized,
        date: line.normalized.date?.toISOString() ?? null,
      },
    })

    return {
      ...result,
      lines: result.lines.map(serializeLine),
      exportArtifacts: {
        mainFile: result.exportArtifacts.mainFile.map(serializeLine),
        reviewFile: result.exportArtifacts.reviewFile.map(serializeLine),
        decisionLog: result.exportArtifacts.decisionLog,
      },
    }
  } catch (error) {
    return {
      lines: [],
      institutionAccountMappings: [],
      institutionAccountSummary: {
        institutionsWithAutoFill: 0,
        institutionsRequiringSelection: 0,
        totalRowsPendingAccountSelection: 0,
      },
      exportArtifacts: {
        mainFile: [],
        reviewFile: [],
        decisionLog: JSON.stringify({ generatedAt: new Date().toISOString(), totalRows: 0, decisions: [] }),
      },
      summary: { totalRows: 0, importableRows: 0, reviewRows: 0 },
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Confirma e persiste movimentações após revisão manual.
 */
export async function confirmAndImportMovimentacao(
  payload: ConfirmMovimentacaoPayload,
): Promise<ConfirmMovimentacaoResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      imported: 0,
      skipped: 0,
      reviewed: 0,
      errors: [],
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const result = await confirmAndImportMovimentacaoForUser(session.user.id, toMovimentacaoLines(payload.lines))
    return result
  } catch (error) {
    return {
      imported: 0,
      skipped: 0,
      reviewed: 0,
      errors: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Analisa planilha de posição da B3 sem persistir dados.
 */
export async function analyzePosicaoFile(formData: FormData): Promise<AnalyzePosicaoResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      lines: [],
      exportArtifacts: {
        divergenceFile: [],
        syncLog: JSON.stringify({ generatedAt: new Date().toISOString(), totalRows: 0, divergences: [] }),
      },
      summary: { totalRows: 0, importableRows: 0, reviewRows: 0 },
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const sheets = await sheetsFromMultipleFiles(formData)
    const parsedLines = parsePosicaoForReview(sheets)
    return await analyzePosicaoRows(parsedLines)
  } catch (error) {
    return {
      lines: [],
      exportArtifacts: {
        divergenceFile: [],
        syncLog: JSON.stringify({ generatedAt: new Date().toISOString(), totalRows: 0, divergences: [] }),
      },
      summary: { totalRows: 0, importableRows: 0, reviewRows: 0 },
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Confirma e persiste posições após revisão manual.
 */
export async function confirmAndImportPosicao(payload: ConfirmPosicaoPayload): Promise<ConfirmPosicaoResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      upserted: 0,
      skipped: 0,
      reviewed: 0,
      errors: [],
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const result = await confirmAndImportPosicaoForUser(session.user.id, payload.lines)
    return result
  } catch (error) {
    return {
      upserted: 0,
      skipped: 0,
      reviewed: 0,
      errors: [],
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Analisa planilha de negociação da B3 sem persistir transações.
 */
export async function analyzeNegociacaoFile(formData: FormData): Promise<AnalyzeNegociacaoResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      ready: [],
      unresolvedAssets: [],
      missingClasses: [],
      availableClasses: [],
      existingAssets: [],
      institutionPreviews: [],
      institutionAccountMappings: [],
      institutionAccountSummary: {
        institutionsWithAutoFill: 0,
        institutionsRequiringSelection: 0,
        totalRowsPendingAccountSelection: 0,
      },
      summary: { totalRows: 0, readyCount: 0, unresolvedCount: 0, uniqueUnresolvedTickers: [] },
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRowsForNegociacao(workbook)
    const parsedRows = parseNegociacao(rows)
    const analysis = await analyzeNegociacaoRows(parsedRows, session.user.id)

    return serializeAnalyzeResult(analysis)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      ready: [],
      unresolvedAssets: [],
      missingClasses: [],
      availableClasses: [],
      existingAssets: [],
      institutionPreviews: [],
      institutionAccountMappings: [],
      institutionAccountSummary: {
        institutionsWithAutoFill: 0,
        institutionsRequiringSelection: 0,
        totalRowsPendingAccountSelection: 0,
      },
      summary: { totalRows: 0, readyCount: 0, unresolvedCount: 0, uniqueUnresolvedTickers: [] },
      error: message,
    }
  }
}

/**
 * Confirma resoluções e importa transações de negociação.
 */
export async function confirmAndImportNegociacao(payload: ConfirmImportPayload): Promise<ConfirmImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      assetsCreated: 0,
      institutionsCreated: 0,
      accountsCreated: 0,
      transactionsImported: 0,
      transactionsSkipped: 0,
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const result = await confirmAndImportNegociacaoForUser(session.user.id, toImportPayload(payload))
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return {
      assetsCreated: 0,
      institutionsCreated: 0,
      accountsCreated: 0,
      transactionsImported: 0,
      transactionsSkipped: 0,
      error: message,
    }
  }
}

/**
 * Limpa os dados de importacao em ambiente de desenvolvimento/teste.
 */
export async function resetImportDataAction(): Promise<ResetImportResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      success: false,
      error: 'Usuario nao autenticado',
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: 'Limpeza global indisponivel em producao',
    }
  }

  try {
    const summary = await resetImportData()

    revalidatePath('/import')
    revalidatePath('/transactions')
    revalidatePath('/income')
    revalidatePath('/positions')
    revalidatePath('/accounts')
    revalidatePath('/dashboard')
    revalidatePath('/performance')

    return {
      success: true,
      summary,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao limpar a base',
    }
  }
}
