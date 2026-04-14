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
