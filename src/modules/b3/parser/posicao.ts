import type { PosicaoRow, RawSheet } from './index'

type RawRow = Array<string | number | null | undefined>

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = value.trim()
  if (!cleaned || cleaned === '-') return 0

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : 0
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const n = Number(cleaned.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

function parseCategory(sheetName: string, tipoColuna: string): PosicaoRow['category'] | null {
  const sheet = sheetName.trim().toLowerCase()
  const tipo = tipoColuna.trim().toUpperCase()

  if (sheet === 'bdr') return 'BDR'
  if (sheet === 'etf') return 'ETF'
  if (sheet === 'fundo de investimento') return 'FII'

  if (sheet === 'acoes') {
    if (['ON', 'PN', 'UNIT'].includes(tipo)) return 'STOCK'
    return 'STOCK'
  }

  return null
}

function extractName(produto: string, ticker: string): string {
  const parts = produto.split(' - ').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return ticker
  return parts.slice(1).join(' - ')
}

/**
 * Parseia uma linha da planilha de posicao da B3.
 */
export function parsePosicaoRow(row: RawRow, sheetName: string): PosicaoRow | null {
  const produto = String(row[0] ?? '').trim()
  const instituicao = String(row[1] ?? '').trim()
  const conta = String(row[2] ?? '').trim()
  const ticker = String(row[3] ?? '').trim().toUpperCase()
  const tipoColuna = String(row[6] ?? '').trim()

  if (!ticker) return null

  const category = parseCategory(sheetName, tipoColuna)
  if (!category) return null

  const quantity = parseNumber(row[8])
  const closePrice = parseNumber(row[12])
  const updatedValue = parseNumber(row[13])

  return {
    ticker,
    name: extractName(produto, ticker),
    category,
    quantity,
    closePrice,
    updatedValue,
    instituicao,
    conta,
  }
}

/**
 * Parseia todas as sheets suportadas da planilha de posicao.
 */
export function parsePosicao(sheets: RawSheet[]): PosicaoRow[] {
  const accepted = new Set(['Acoes', 'BDR', 'ETF', 'Fundo de Investimento'])

  return sheets
    .filter((sheet) => accepted.has(sheet.name))
    .flatMap((sheet) =>
      sheet.rows
        .filter((row) => String(row[3] ?? '').trim() !== 'Código de Negociação')
        .map((row) => parsePosicaoRow(row, sheet.name))
        .filter((row): row is PosicaoRow => row !== null),
    )
}
