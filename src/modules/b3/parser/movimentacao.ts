import type {
  MovimentacaoParsedLine,
  MovimentacaoReviewRow,
  MovimentacaoRow,
  ParseMovimentacaoResult,
} from './index'

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

function getTypeFromMovement(movimentacao: string): {
  type: 'BUY' | 'DIVIDEND' | null
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  classification: 'LIQUIDACAO' | 'PROVENTO' | 'EVENTO_CORPORATIVO' | 'IGNORAR' | 'REVISAR'
  reason: string
} {
  const normalized = normalizeMovement(movimentacao)

  if (normalized === 'transferencia - liquidacao') {
    return {
      type: 'BUY',
      status: 'OK',
      classification: 'LIQUIDACAO',
      reason: 'liquidacao_elegivel',
    }
  }

  if (normalized === 'rendimento' || normalized === 'juros sobre capital proprio' || normalized === 'dividendo') {
    return {
      type: 'DIVIDEND',
      status: 'OK',
      classification: 'PROVENTO',
      reason: 'provento_elegivel',
    }
  }

  if (
    normalized.includes('subscricao')
    || normalized.includes('cessao de direitos')
    || normalized === 'atualizacao'
    || normalized.includes('fracao')
    || normalized.includes('resgate')
    || normalized.includes('leilao')
  ) {
    return {
      type: null,
      status: 'REVISAR',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'evento_corporativo_requer_revisao',
    }
  }

  return {
    type: null,
    status: 'REVISAR',
    classification: 'REVISAR',
    reason: 'tipo_movimentacao_desconhecido',
  }
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

function rawFromRow(row: RawRow) {
  return {
    entradaSaida: String(row[0] ?? '').trim(),
    data: String(row[1] ?? '').trim(),
    movimentacao: String(row[2] ?? '').trim(),
    produto: String(row[3] ?? '').trim(),
    instituicao: String(row[4] ?? '').trim(),
    quantidade: String(row[5] ?? '').trim(),
    precoUnitario: String(row[6] ?? '').trim(),
    valorOperacao: String(row[7] ?? '').trim(),
  }
}

function parseMovimentacaoRowWithReason(row: RawRow): {
  row: MovimentacaoRow | null
  reason: string
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  classification: 'LIQUIDACAO' | 'PROVENTO' | 'EVENTO_CORPORATIVO' | 'IGNORAR' | 'REVISAR'
  normalized: MovimentacaoParsedLine['normalized']
} {
  const raw = rawFromRow(row)
  const parsedType = getTypeFromMovement(raw.movimentacao)
  const date = parseDate(raw.data)
  const ticker = extractTicker(raw.produto)
  const quantity = parseNumberNullable(row[5]) ?? 0
  const price = parseNumberNullable(row[6])
  const total = parseNumberNullable(row[7])
  const normalized: MovimentacaoParsedLine['normalized'] = {
    date,
    type: parsedType.type,
    ticker,
    instituicao: raw.instituicao.trim().toUpperCase(),
    quantity,
    price,
    total,
    referenceId: buildReferenceId(raw.data, ticker, parsedType.type ?? 'DIVIDEND', total),
  }

  if (!raw.data || !raw.movimentacao || !raw.produto) {
    return {
      row: null,
      reason: 'campos_obrigatorios_ausentes',
      status: 'IGNORAR',
      classification: 'IGNORAR',
      normalized,
    }
  }

  if (!date) {
    return {
      row: null,
      reason: 'data_invalida',
      status: 'REVISAR',
      classification: 'REVISAR',
      normalized,
    }
  }

  if (!parsedType.type) {
    return {
      row: null,
      reason: parsedType.reason,
      status: parsedType.status,
      classification: parsedType.classification,
      normalized,
    }
  }

  if (!ticker) {
    return {
      row: null,
      reason: 'ticker_ausente',
      status: 'REVISAR',
      classification: 'REVISAR',
      normalized,
    }
  }

  return {
    row: {
      date,
      type: parsedType.type,
      ticker,
      instituicao: raw.instituicao,
      quantity,
      price,
      total,
      referenceId: buildReferenceId(raw.data, ticker, parsedType.type, total),
    },
    reason: parsedType.reason,
    status: parsedType.status,
    classification: parsedType.classification,
    normalized,
  }
}

/**
 * Parseia uma linha do extrato de movimentacao da B3.
 */
export function parseMovimentacaoRow(row: RawRow): MovimentacaoRow | null {
  return parseMovimentacaoRowWithReason(row).row
}

/**
 * Parseia todas as linhas de movimentacao ignorando cabecalho e linhas nao suportadas.
 */
export function parseMovimentacao(rows: RawRow[]): MovimentacaoRow[] {
  return parseMovimentacaoDetailed(rows).readyRows
}

/**
 * Parseia movimentacao retornando linhas prontas e linhas a revisar.
 */
export function parseMovimentacaoDetailed(rows: RawRow[]): ParseMovimentacaoResult {
  const parsedLines = parseMovimentacaoForReview(rows)
  const readyRows: MovimentacaoRow[] = []
  const reviewRows: MovimentacaoReviewRow[] = []

  parsedLines.forEach((line) => {
    if (line.status === 'OK' && line.normalized.type) {
      readyRows.push({
        date: line.normalized.date ?? new Date(),
        type: line.normalized.type,
        ticker: line.normalized.ticker,
        instituicao: line.normalized.instituicao,
        quantity: line.normalized.quantity,
        price: line.normalized.price,
        total: line.normalized.total,
        referenceId: line.normalized.referenceId,
      })
      return
    }

    reviewRows.push({
      lineNumber: line.lineNumber,
      reason: line.reason,
      raw: line.raw,
    })
  })

  return { readyRows, reviewRows }
}

/**
 * Parseia movimentação preservando todas as linhas para revisão.
 */
export function parseMovimentacaoForReview(rows: RawRow[]): MovimentacaoParsedLine[] {
  return rows
    .map((row, index) => ({ row, lineNumber: index + 1 }))
    .filter(({ row }) => String(row[0] ?? '').trim() !== 'Entrada/Saída')
    .map(({ row, lineNumber }) => {
      const parsed = parseMovimentacaoRowWithReason(row)
      return {
        lineNumber: lineNumber + 1,
        status: parsed.status,
        classification: parsed.classification,
        reason: parsed.reason,
        raw: rawFromRow(row),
        normalized: parsed.normalized,
      }
    })
}
