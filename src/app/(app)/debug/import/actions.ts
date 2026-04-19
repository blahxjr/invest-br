'use server'

import { auth } from '@/lib/auth'
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