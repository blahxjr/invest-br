import type { PosicaoParsedLine, PosicaoRow, RawSheet } from './index'

type RawRow = Array<string | number | null | undefined>

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const cleaned = value.trim()
  if (!cleaned || cleaned === '-') return 0

  // Remove símbolo de moeda e espaços
  const noSymbol = cleaned.replace(/R\$\s*/g, '').trim()

  if (noSymbol.includes(',') && noSymbol.includes('.')) {
    const normalized = noSymbol.replace(/\./g, '').replace(',', '.')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : 0
  }

  if (noSymbol.includes(',') && !noSymbol.includes('.')) {
    const n = Number(noSymbol.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  const n = Number(noSymbol)
  return Number.isFinite(n) ? n : 0
}

/**
 * Retorna o nome normalizado da sheet para lookup interno a partir do nome bruto (case-insensitive).
 */
function normalizeSheetName(raw: string): string {
  const lower = raw.trim().toLowerCase()
  if (lower === 'acoes' || lower === 'ações') return 'acoes'
  if (lower === 'bdr') return 'bdr'
  if (lower === 'etf') return 'etf'
  if (lower === 'fundo de investimento') return 'fundos'
  if (lower === 'renda fixa') return 'rendafixa'
  if (lower === 'tesouro direto') return 'tesourodireto'
  return lower
}

/**
 * Deriva a categoria do ativo a partir do nome normalizado da sheet e do campo Tipo.
 */
function parseCategory(sheetNorm: string, tipoColuna: string): PosicaoRow['category'] | null {
  const tipo = tipoColuna.trim().toUpperCase()

  switch (sheetNorm) {
    case 'bdr': return 'BDR'
    case 'etf': return 'ETF'
    case 'fundos': return 'FII'
    case 'rendafixa': return 'FIXED_INCOME'
    case 'tesourodireto': return 'FIXED_INCOME'
    case 'acoes':
      if (['ON', 'PN', 'UNIT'].includes(tipo)) return 'STOCK'
      return 'STOCK'
    default:
      return null
  }
}

function extractName(produto: string, ticker: string): string {
  const parts = produto.split(' - ').map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return ticker
  return parts.slice(1).join(' - ')
}

/**
 * Deriva um ticker identificador para títulos do Tesouro Direto a partir do nome do produto.
 * Ex: "Tesouro Prefixado com Juros Semestrais 2031" → "TNFS2031"
 * Ex: "Tesouro Selic 2029" → "TESOURO_SELIC_2029"
 */
export function deriveTesouroDiretoTicker(produto: string): string {
  const text = produto.trim()
  const yearMatch = text.match(/\d{4}/)
  const year = yearMatch ? yearMatch[0] : ''
  const lower = text.toLowerCase()

  if (lower.includes('selic')) return `TESOURO_SELIC${year ? '_' + year : ''}`
  if (lower.includes('ipca') && lower.includes('juros semestrais')) return `NTNB${year}`
  if (lower.includes('ipca')) return `NTNB_PRINC${year}`
  if (lower.includes('prefixado') && lower.includes('juros semestrais')) return `TNFS${year}`
  if (lower.includes('prefixado')) return `TNLF${year}`

  // Fallback: normaliza o nome completo em uppercase com underscore
  return text.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 30)
}

type RawExtracted = {
  produto: string
  instituicao: string
  conta: string
  codigoNegociacao: string
  tipo: string
  quantidade: string
  precoFechamento: string
  valorAtualizado: string
}

/**
 * Extrai os campos relevantes de uma linha bruta conforme o tipo de sheet.
 * Cada tipo de exportação da B3 possui colunas em posições distintas:
 * - acoes/fundos: ticker[3], tipo[6], qty[8], price[12], value[13]
 * - bdr: ticker[3], tipo[5], qty[7], price[11], value[12]
 * - etf: ticker[3], tipo[6], qty[7], price[11], value[12]
 * - rendafixa: ticker=Código[3], qty[8], price=FECHAMENTO>CURVA>MTM, value=idem
 * - tesourodireto: ticker derivado do produto[0], qty[5], price=0, value[12]
 */
function rawFromRowBySheet(row: RawRow, sheetNorm: string): RawExtracted {
  const s = (idx: number) => String(row[idx] ?? '').trim()

  switch (sheetNorm) {
    case 'acoes':
    case 'fundos':
      return {
        produto: s(0),
        instituicao: s(1),
        conta: s(2),
        codigoNegociacao: s(3),
        tipo: s(6),
        quantidade: s(8),
        precoFechamento: s(12),
        valorAtualizado: s(13),
      }

    case 'bdr':
      return {
        produto: s(0),
        instituicao: s(1),
        conta: s(2),
        codigoNegociacao: s(3),
        tipo: s(5),
        quantidade: s(7),
        precoFechamento: s(11),
        valorAtualizado: s(12),
      }

    case 'etf':
      return {
        produto: s(0),
        instituicao: s(1),
        conta: s(2),
        codigoNegociacao: s(3),
        tipo: s(6),
        quantidade: s(7),
        precoFechamento: s(11),
        valorAtualizado: s(12),
      }

    case 'rendafixa': {
      // price: FECHAMENTO[17] > CURVA[15] > MTM[13]
      // value: FECHAMENTO[18] > CURVA[16] > MTM[14]
      const pFechamento = s(17)
      const pCurva = s(15)
      const pMtm = s(13)
      const vFechamento = s(18)
      const vCurva = s(16)
      const vMtm = s(14)

      const precoFechamento =
        parseNumber(pFechamento) > 0 ? pFechamento
        : parseNumber(pCurva) > 0 ? pCurva
        : pMtm

      const valorAtualizado =
        parseNumber(vFechamento) > 0 ? vFechamento
        : parseNumber(vCurva) > 0 ? vCurva
        : vMtm

      let codigoNegociacao = s(3)
      if (!codigoNegociacao || codigoNegociacao === '-') {
        codigoNegociacao = s(0).split(' - ')[0].trim().toUpperCase()
      }

      return {
        produto: s(0),
        instituicao: s(1),
        conta: '',
        codigoNegociacao,
        tipo: 'RENDA_FIXA',
        quantidade: s(8),
        precoFechamento,
        valorAtualizado,
      }
    }

    case 'tesourodireto': {
      const produto = s(0)
      const codigoNegociacao = deriveTesouroDiretoTicker(produto)

      return {
        produto,
        instituicao: s(1),
        conta: '',
        codigoNegociacao,
        tipo: 'TESOURO',
        quantidade: s(5),
        precoFechamento: '0',
        valorAtualizado: s(12),
      }
    }

    default:
      return {
        produto: s(0),
        instituicao: s(1),
        conta: s(2),
        codigoNegociacao: s(3),
        tipo: s(6),
        quantidade: s(8),
        precoFechamento: s(12),
        valorAtualizado: s(13),
      }
  }
}

/**
 * Verifica se uma linha é o cabeçalho do CSV/XLSX e deve ser ignorada.
 * Todos os formatos da B3 têm "Produto" na primeira coluna do cabeçalho.
 */
function isHeaderRow(row: RawRow): boolean {
  const col0 = String(row[0] ?? '').trim().toLowerCase()
  const col3 = String(row[3] ?? '').trim()
  return col0 === 'produto' || col3 === 'Código de Negociação'
}

/**
 * Parseia uma linha individual da planilha de posição da B3.
 */
export function parsePosicaoRow(row: RawRow, sheetName: string): PosicaoRow | null {
  const sheetNorm = normalizeSheetName(sheetName)
  const raw = rawFromRowBySheet(row, sheetNorm)
  const ticker = raw.codigoNegociacao.toUpperCase()

  if (!ticker) return null

  const category = parseCategory(sheetNorm, raw.tipo)
  if (!category) return null

  const quantity = parseNumber(raw.quantidade)
  const closePrice = parseNumber(raw.precoFechamento)
  const updatedValue = parseNumber(raw.valorAtualizado)

  return {
    ticker,
    name: extractName(raw.produto, ticker),
    category,
    quantity,
    closePrice,
    updatedValue,
    instituicao: raw.instituicao,
    conta: raw.conta,
  }
}

/**
 * Parseia todas as sheets suportadas da planilha de posição retornando apenas linhas válidas.
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

const ACCEPTED_SHEETS = new Set([
  'acoes',
  'bdr',
  'etf',
  'fundos',
  'rendafixa',
  'tesourodireto',
])

/**
 * Parseia todas as linhas das sheets de posição preservando status para revisão.
 * Suporta os 6 tipos de exportação CSV da B3:
 * acoes, bdr, etf, fundos (fundo de investimento), rendafixa e tesourodireto.
 */
export function parsePosicaoForReview(sheets: RawSheet[]): PosicaoParsedLine[] {
  return sheets
    .filter((sheet) => ACCEPTED_SHEETS.has(normalizeSheetName(sheet.name)))
    .flatMap((sheet) => {
      const sheetNorm = normalizeSheetName(sheet.name)

      return sheet.rows
        .map((row, index) => ({ row, lineNumber: index + 1 }))
        .filter(({ row }) => !isHeaderRow(row))
        .map(({ row, lineNumber }) => {
          const raw = rawFromRowBySheet(row, sheetNorm)
          const ticker = raw.codigoNegociacao.trim().toUpperCase()
          const category = parseCategory(sheetNorm, raw.tipo)
          const quantity = parseNumber(raw.quantidade)
          const closePrice = parseNumber(raw.precoFechamento)
          const updatedValue = parseNumber(raw.valorAtualizado)

          const normalized: PosicaoParsedLine['normalized'] = {
            ticker,
            name: sheetNorm === 'tesourodireto'
              ? raw.produto || ticker
              : extractName(raw.produto, ticker),
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
        })
    })
}
