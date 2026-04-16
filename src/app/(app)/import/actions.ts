'use server'

import { auth } from '@/lib/auth'
import { resetImportData } from '@/modules/b3/reset-service'
import {
  analyzeNegociacaoRows,
  confirmAndImportNegociacaoForUser,
  type AssetClassOption,
  type AnalyzeNegociacaoResult,
  type ConfirmImportResult,
  type ExistingAssetOption,
  type ImportPayload,
  type InstitutionPreview,
  type MissingClass,
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
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

export type SerializableParsedRow = {
  date: string
  type: 'BUY' | 'SELL'
  ticker: string
  mercado: string
  instituicao: string
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
  const session = await auth()
  if (!session?.user?.id) {
    return { imported: 0, skipped: 0, errors: ['Usuario nao autenticado'] }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRows(workbook, 'Movimentação')
    const parsedRows = parseMovimentacao(rows)

    return importMovimentacaoRows(session.user.id, parsedRows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { imported: 0, skipped: 0, errors: [message] }
  }
}

/**
 * Importa planilha de posicao da B3 para sincronizar o catalogo de ativos.
 */
export async function importPosicao(formData: FormData): Promise<ImportResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { upserted: 0, errors: ['Usuario nao autenticado'] }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const parsedRows = parsePosicao(allSheets(workbook))

    return importPosicaoRows(parsedRows)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return { upserted: 0, errors: [message] }
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
      summary: { totalRows: 0, readyCount: 0, unresolvedCount: 0, uniqueUnresolvedTickers: [] },
      error: 'Usuario nao autenticado',
    }
  }

  try {
    const file = await getUploadedFile(formData)
    const workbook = workbookFromArrayBuffer(await file.arrayBuffer())
    const rows = sheetRowsForNegociacao(workbook)
    const parsedRows = parseNegociacao(rows)
    const analysis = await analyzeNegociacaoRows(parsedRows)

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
