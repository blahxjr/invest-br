import type { PosicaoParsedLine, PosicaoRow, RawSheet } from './index'

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

function rawFromRow(row: RawRow) {
  return {
    produto: String(row[0] ?? '').trim(),
    instituicao: String(row[1] ?? '').trim(),
    conta: String(row[2] ?? '').trim(),
    codigoNegociacao: String(row[3] ?? '').trim(),
    tipo: String(row[6] ?? '').trim(),
    quantidade: String(row[8] ?? '').trim(),
    precoFechamento: String(row[12] ?? '').trim(),
    valorAtualizado: String(row[13] ?? '').trim(),
  }
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
  return parsePosicaoForReview(sheets)
    .filter((line) => line.status === 'OK' && line.normalized.category)
    .map((line) => ({
      ticker: line.normalized.ticker,
      name: line.normalized.name,
      category: line.normalized.category!,
      quantity: line.normalized.quantity,
      closePrice: line.normalized.closePrice,
      updatedValue: line.normalized.updatedValue,
      instituicao: line.normalized.instituicao,
      conta: line.normalized.conta,
    }))
}

/**
 * Parseia todas as linhas das sheets de posição preservando status para revisão.
 */
export function parsePosicaoForReview(sheets: RawSheet[]): PosicaoParsedLine[] {
  const accepted = new Set(['Acoes', 'BDR', 'ETF', 'Fundo de Investimento'])

  return sheets
    .filter((sheet) => accepted.has(sheet.name))
    .flatMap((sheet) =>
      sheet.rows
        .map((row, index) => ({ row, lineNumber: index + 1 }))
        .filter(({ row }) => String(row[3] ?? '').trim() !== 'Código de Negociação')
        .map(({ row, lineNumber }) => {
          const raw = rawFromRow(row)
          const ticker = raw.codigoNegociacao.trim().toUpperCase()
          const category = parseCategory(sheet.name, raw.tipo)
          const quantity = parseNumber(row[8])
          const closePrice = parseNumber(row[12])
          const updatedValue = parseNumber(row[13])

          const normalized: PosicaoParsedLine['normalized'] = {
            ticker,
            name: extractName(raw.produto, ticker),
            category,
            quantity,
            closePrice,
            updatedValue,
            instituicao: raw.instituicao.trim().toUpperCase(),
            conta: raw.conta.trim(),
          }

          if (!ticker) {
            return {
              lineNumber,
              sheetName: sheet.name,
              status: 'IGNORAR' as const,
              classification: 'IGNORAR' as const,
              reason: 'ticker_ausente',
              raw,
              normalized,
            }
          }

          if (!category) {
            return {
              lineNumber,
              sheetName: sheet.name,
              status: 'REVISAR' as const,
              classification: 'DADO_INCONSISTENTE' as const,
              reason: 'categoria_indefinida',
              raw,
              normalized,
            }
          }

          if (!normalized.instituicao) {
            return {
              lineNumber,
              sheetName: sheet.name,
              status: 'REVISAR' as const,
              classification: 'DADO_INCONSISTENTE' as const,
              reason: 'instituicao_ausente',
              raw,
              normalized,
            }
          }

          return {
            lineNumber,
            sheetName: sheet.name,
            status: 'OK' as const,
            classification: 'CATALOGO_EXISTENTE' as const,
            reason: 'linha_posicao_valida',
            raw,
            normalized,
          }
        }),
    )
}
