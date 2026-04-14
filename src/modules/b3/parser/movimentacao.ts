import type { MovimentacaoRow } from './index'

type RawRow = Array<string | number | null | undefined>

function parseDate(value: string): Date | null {
  const cleaned = value.trim()
  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return Number.isNaN(date.getTime()) ? null : date
}

function parseNumberNullable(value: string | number | null | undefined): number | null {
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

function normalizeMovement(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getTypeFromMovement(movimentacao: string): 'BUY' | 'DIVIDEND' | null {
  const normalized = normalizeMovement(movimentacao)

  if (normalized === 'transferencia - liquidacao') return 'BUY'
  if (normalized === 'rendimento') return 'DIVIDEND'
  if (normalized === 'juros sobre capital proprio') return 'DIVIDEND'
  if (normalized === 'dividendo') return 'DIVIDEND'

  return null
}

function extractTicker(produto: string): string {
  const [ticker] = produto.split(' - ')
  return (ticker ?? '').trim().toUpperCase()
}

function buildReferenceId(dateRaw: string, ticker: string, type: 'BUY' | 'DIVIDEND', total: number | null): string {
  const dateKey = dateRaw.replaceAll('/', '-')
  const totalKey = total ?? 0
  return `movimentacao-${dateKey}-${ticker}-${type}-${totalKey}`
}

/**
 * Parseia uma linha do extrato de movimentacao da B3.
 */
export function parseMovimentacaoRow(row: RawRow): MovimentacaoRow | null {
  const dateRaw = String(row[1] ?? '').trim()
  const movimentacao = String(row[2] ?? '').trim()
  const produto = String(row[3] ?? '').trim()
  const instituicao = String(row[4] ?? '').trim()
  const quantity = parseNumberNullable(row[5]) ?? 0
  const price = parseNumberNullable(row[6])
  const total = parseNumberNullable(row[7])

  if (!dateRaw || !movimentacao || !produto) return null

  const date = parseDate(dateRaw)
  if (!date) return null

  const type = getTypeFromMovement(movimentacao)
  if (!type) return null

  const ticker = extractTicker(produto)
  if (!ticker) return null

  return {
    date,
    type,
    ticker,
    instituicao,
    quantity,
    price,
    total,
    referenceId: buildReferenceId(dateRaw, ticker, type, total),
  }
}

/**
 * Parseia todas as linhas de movimentacao ignorando cabecalho e linhas nao suportadas.
 */
export function parseMovimentacao(rows: RawRow[]): MovimentacaoRow[] {
  return rows
    .filter((row) => String(row[0] ?? '').trim() !== 'Entrada/Saída')
    .map(parseMovimentacaoRow)
    .filter((row): row is MovimentacaoRow => row !== null)
}
