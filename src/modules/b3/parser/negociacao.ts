import type { NegociacaoRow } from './index'

type RawRow = Array<string | number | null | undefined>

function parseDate(value: string): Date | null {
  const cleaned = value.trim()
  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return Number.isNaN(date.getTime()) ? null : date
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = value.trim()
  if (!cleaned || cleaned === '-') return null

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }

  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const n = Number(cleaned.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function normalizeTicker(ticker: string, mercado: string): string {
  const upper = ticker.trim().toUpperCase()
  const isFracionario = mercado.toLowerCase().includes('fracion')
  if (isFracionario && upper.endsWith('F')) {
    return upper.slice(0, -1)
  }
  return upper
}

function buildReferenceId(dateRaw: string, ticker: string, quantity: number, price: number): string {
  const dateKey = dateRaw.replaceAll('/', '-')
  return `negociacao-${dateKey}-${ticker}-${quantity}-${price}`
}

/**
 * Parseia uma linha do extrato de negociacao da B3.
 */
export function parseNegociacaoRow(row: RawRow): NegociacaoRow | null {
  const dateRaw = String(row[0] ?? '').trim()
  const tipo = String(row[1] ?? '').trim().toLowerCase()
  const mercado = String(row[2] ?? '').trim()
  const instituicao = String(row[4] ?? '').trim()
  const codigo = String(row[5] ?? '').trim()
  const quantity = parseNumber(row[6])
  const price = parseNumber(row[7])
  const total = parseNumber(row[8])

  if (!dateRaw || !tipo || !mercado || !codigo) return null

  const date = parseDate(dateRaw)
  if (!date || quantity == null || price == null || total == null) return null

  const type = tipo === 'compra' ? 'BUY' : tipo === 'venda' ? 'SELL' : null
  if (!type) return null

  const ticker = normalizeTicker(codigo, mercado)

  return {
    date,
    type,
    ticker,
    mercado,
    instituicao,
    quantity,
    price,
    total,
    referenceId: buildReferenceId(dateRaw, ticker, quantity, price),
  }
}

/**
 * Parseia todas as linhas de negociacao ignorando cabecalho e linhas invalidas.
 */
export function parseNegociacao(rows: RawRow[]): NegociacaoRow[] {
  return rows
    .filter((row) => String(row[0] ?? '').trim() !== 'Data do Negócio')
    .map(parseNegociacaoRow)
    .filter((row): row is NegociacaoRow => row !== null)
}
