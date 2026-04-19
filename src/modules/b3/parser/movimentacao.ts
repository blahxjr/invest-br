import type { TransactionType } from '@prisma/client'
import type {
  MovimentacaoParsedLine,
  MovimentacaoReviewRow,
  MovimentacaoRow,
  ParseMovimentacaoResult,
} from './index'

type RawRow = Array<string | number | null | undefined>
export type AssetClass = 'RENDA_FIXA' | 'ACAO' | 'FII' | 'ETF' | 'OUTRO'

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

  // Remove símbolo monetário (R$), espaços extras e caracteres não numéricos de prefixo
  const cleaned = value.trim().replace(/^R\$\s*/, '').replace(/\s+/g, '')
  if (!cleaned || cleaned === '-' || cleaned === ' - ' || cleaned === '–') return null

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

function inferIsFiiTicker(ticker: string): boolean {
  return /^[A-Z]{4}11$/.test(ticker)
}

export function resolveAssetClass(produto: string, ticker?: string): AssetClass {
  const normalizedTicker = String(ticker ?? '').trim().toUpperCase()
  const normalizedProduto = normalizeMovement(produto)
  const combined = normalizeMovement(`${normalizedTicker} ${produto}`)

  const fixedIncomeTokens = ['cdb', 'lci', 'lca', 'cri', 'cra', 'tesouro', 'debenture', 'debentur']
  if (fixedIncomeTokens.some((token) => combined.includes(token))) {
    return 'RENDA_FIXA'
  }

  if (normalizedProduto.includes('etf')) {
    return 'ETF'
  }

  if (/^[A-Z]{4}11$/.test(normalizedTicker) || normalizedTicker.endsWith('11')) {
    return 'FII'
  }

  if (/^[A-Z]{4}[3-6]$/.test(normalizedTicker) || /[3-6]$/.test(normalizedTicker)) {
    return 'ACAO'
  }

  if (normalizedTicker || normalizedProduto) {
    return 'OUTRO'
  }

  throw new Error('Asset class não identificada — bloquear ingestão')
}

function inferFixedIncomeProfile(input: { ticker: string; produto: string }): {
  isFixedIncome: boolean
  isTaxExempt: boolean
} {
  const normalized = normalizeMovement(`${input.ticker} ${input.produto}`)
  const exemptTokens = ['lca', 'lci', 'cri', 'cra']
  const taxableTokens = ['cdb', 'debenture', 'debentur']
  const fixedIncomeTokens = [...exemptTokens, ...taxableTokens]
  const isFixedIncome = fixedIncomeTokens.some((token) => normalized.includes(token))
  const isTaxExempt = exemptTokens.some((token) => normalized.includes(token))

  return {
    isFixedIncome,
    isTaxExempt,
  }
}

function normalizeEntryDirection(value: string): 'IN' | 'OUT' | 'UNKNOWN' {
  const normalized = normalizeMovement(value)

  if (normalized === 'credito' || normalized === 'entrada') return 'IN'
  if (normalized === 'debito' || normalized === 'saida') return 'OUT'
  return 'UNKNOWN'
}

export function classifyMovement(input: {
  entradaSaida: string
  movimentacao: string
  ticker: string
  produto: string
}): {
  type: TransactionType | null
  status: 'OK' | 'REVISAR' | 'IGNORAR'
  classification: 'LIQUIDACAO' | 'PROVENTO' | 'EVENTO_CORPORATIVO' | 'IGNORAR' | 'REVISAR'
  reason: string
  isIncoming: boolean | null
  isTaxExempt: boolean
} {
  const normalized = normalizeMovement(input.movimentacao)
  const direction = normalizeEntryDirection(input.entradaSaida)
  const isFii = inferIsFiiTicker(input.ticker)
  const assetClass = resolveAssetClass(input.produto, input.ticker)
  const fixedIncomeProfile = inferFixedIncomeProfile({
    ticker: input.ticker,
    produto: input.produto,
  })

  if (normalized === 'compra / venda' || normalized === 'compra/venda' || normalized === 'compra venda') {
    if (!fixedIncomeProfile.isFixedIncome) {
      return {
        type: null,
        status: 'REVISAR',
        classification: 'REVISAR',
        reason: 'compra_venda_sem_contexto_renda_fixa',
        isIncoming: null,
        isTaxExempt: false,
      }
    }

    if (direction === 'OUT') {
      return {
        type: 'BUY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'compra_renda_fixa',
        isIncoming: false,
        isTaxExempt: fixedIncomeProfile.isTaxExempt,
      }
    }

    if (direction === 'IN') {
      return {
        type: 'MATURITY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'resgate_renda_fixa_compra_venda',
        isIncoming: true,
        isTaxExempt: fixedIncomeProfile.isTaxExempt,
      }
    }

    return {
      type: null,
      status: 'REVISAR',
      classification: 'REVISAR',
      reason: 'direcao_compra_venda_renda_fixa_ambigua',
      isIncoming: null,
      isTaxExempt: fixedIncomeProfile.isTaxExempt,
    }
  }

  if (normalized === 'compra' || normalized === 'aplicacao') {
    return {
      type: 'BUY',
      status: 'OK',
      classification: 'LIQUIDACAO',
      reason:
        normalized === 'aplicacao'
          ? 'aplicacao_renda_fixa'
          : assetClass === 'RENDA_FIXA'
            ? 'compra_renda_fixa'
            : 'compra_outros_ativos',
      isIncoming: false,
      isTaxExempt: assetClass === 'RENDA_FIXA' ? fixedIncomeProfile.isTaxExempt : false,
    }
  }

  if (normalized === 'transferencia - liquidacao') {
    if (direction === 'OUT') {
      return {
        type: 'BUY',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'liquidacao_compra',
        isIncoming: false,
        isTaxExempt: false,
      }
    }

    if (direction === 'IN') {
      return {
        type: 'SELL',
        status: 'OK',
        classification: 'LIQUIDACAO',
        reason: 'liquidacao_venda',
        isIncoming: true,
        isTaxExempt: false,
      }
    }

    return {
      type: null,
      status: 'REVISAR',
      classification: 'REVISAR',
      reason: 'direcao_liquidacao_ambigua',
      isIncoming: null,
      isTaxExempt: false,
    }
  }

  // Desconto de IRRF (retencao de imposto) — nao gera movimento de ativo, deve ser ignorado
  if (
    normalized.startsWith('irrf') ||
    normalized.includes('imposto retido') ||
    normalized.includes('retencao') ||
    normalized === 'imposto de renda'
  ) {
    return {
      type: null,
      status: 'IGNORAR',
      classification: 'IGNORAR',
      reason: 'retencao_irrf_ignorada',
      isIncoming: null,
      isTaxExempt: false,
    }
  }

  if (normalized === 'rendimento' || normalized === 'juros sobre capital proprio' || normalized === 'dividendo') {
    return {
      type: 'DIVIDEND',
      status: 'OK',
      classification: 'PROVENTO',
      reason: 'provento_elegivel',
      isIncoming: true,
      isTaxExempt: normalized === 'rendimento' && isFii,
    }
  }

  if (normalized === 'juros') {
    return {
      type: 'DIVIDEND',
      status: 'OK',
      classification: 'PROVENTO',
      reason: 'juros_creditados',
      isIncoming: true,
      isTaxExempt: false,
    }
  }

  if (normalized === 'transferencia') {
    return {
      type: 'CUSTODY_TRANSFER',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'transferencia_generica',
      isIncoming: direction === 'IN',
      isTaxExempt: false,
    }
  }

  if (normalized.includes('transferencia de custodia')) {
    return {
      type: 'CUSTODY_TRANSFER',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'transferencia_custodia',
      isIncoming: direction === 'IN',
      isTaxExempt: false,
    }
  }

  // Subscrição não exercida / expirada (várias nomenclaturas da B3)
  if (
    normalized.includes('subscricao nao exercida') ||
    normalized.includes('subscricao não exercida') ||
    normalized.includes('direito de subscricao expirado') ||
    (normalized.includes('subscricao') && normalized.includes('nao exercid')) ||
    (normalized.includes('subscricao') && normalized.includes('não exercid'))
  ) {
    return {
      type: 'SUBSCRIPTION_EXPIRED',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'subscricao_expirada',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized.includes('direito de subscricao') || normalized.includes('direitos de subscricao') || normalized.includes('direitos de subscrição') || normalized.includes('subscricao')) {
    return {
      type: 'SUBSCRIPTION_RIGHT',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'direito_subscricao_creditado',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized.includes('cessao de direitos') || normalized.includes('cessão de direitos')) {
    return {
      type: 'RIGHTS_TRANSFER',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'cessao_direitos',
      isIncoming: direction === 'IN',
      isTaxExempt: false,
    }
  }

  if (normalized === 'atualizacao' || normalized.includes('atualizacao de preco') || normalized.includes('correcao monetaria')) {
    return {
      type: 'CORPORATE_UPDATE',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'atualizacao_cadastral_ativo',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized.includes('bonificacao')) {
    return {
      type: 'BONUS_SHARES',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'bonificacao_em_ativos',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized === 'desdobro') {
    return {
      type: 'SPLIT',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'desdobro',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized === 'fracao em ativos') {
    return {
      type: 'FRACTIONAL_DEBIT',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'debito_fracionario',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  if (normalized === 'leilao de fracao' || normalized === 'leilao') {
    return {
      type: 'FRACTIONAL_AUCTION',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'leilao_fracionario',
      isIncoming: true,
      isTaxExempt: false,
    }
  }

  if (normalized.includes('fracao') || normalized.includes('fração')) {
    return {
      type: direction === 'IN' ? 'FRACTIONAL_AUCTION' : 'FRACTIONAL_DEBIT',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: direction === 'IN' ? 'credito_fracionario' : 'debito_fracionario',
      isIncoming: direction === 'IN',
      isTaxExempt: false,
    }
  }

  if (normalized.includes('leilao') || normalized.includes('leilão')) {
    return {
      type: 'FRACTIONAL_AUCTION',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'leilao_fracionario',
      isIncoming: true,
      isTaxExempt: false,
    }
  }

  if (normalized.includes('resgate') || normalized.includes('vencimento')) {
    return {
      type: 'MATURITY',
      status: 'OK',
      classification: 'LIQUIDACAO',
      reason: normalized === 'resgate antecipado' ? 'resgate_antecipado' : 'liquidacao_vencimento',
      isIncoming: true,
      isTaxExempt: fixedIncomeProfile.isTaxExempt,
    }
  }

  // Amortizacao de cotas (FIIs, CRIs, debentures) — retorno parcial de capital
  if (normalized.includes('amortizacao') || normalized === 'reembolso') {
    return {
      type: 'MATURITY',
      status: 'OK',
      classification: 'LIQUIDACAO',
      reason: 'amortizacao_capital',
      isIncoming: true,
      isTaxExempt: fixedIncomeProfile.isTaxExempt,
    }
  }

  // Grupamento (reverse split) — usa SPLIT como tipo universal de reagrupamento de cotas
  if (normalized === 'grupamento' || normalized.includes('grupamento')) {
    return {
      type: 'SPLIT',
      status: 'OK',
      classification: 'EVENTO_CORPORATIVO',
      reason: 'grupamento_acoes',
      isIncoming: false,
      isTaxExempt: false,
    }
  }

  return {
    type: null,
    status: 'REVISAR',
    classification: 'REVISAR',
    reason: 'tipo_movimentacao_desconhecido',
    isIncoming: null,
    isTaxExempt: false,
  }
}

function extractTicker(produto: string): string {
  const [ticker] = produto.split(' - ')
  return (ticker ?? '').trim().toUpperCase()
}

function buildReferenceId(dateRaw: string, ticker: string, type: TransactionType, total: number | null): string {
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
  const date = parseDate(raw.data)
  const ticker = extractTicker(raw.produto)
  const parsedType = classifyMovement({
    entradaSaida: raw.entradaSaida,
    movimentacao: raw.movimentacao,
    ticker,
    produto: raw.produto,
  })
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
    referenceId: buildReferenceId(raw.data, ticker, parsedType.type ?? 'CORPORATE_UPDATE', total),
    sourceMovementType: raw.movimentacao,
    isIncoming: parsedType.isIncoming,
    isTaxExempt: parsedType.isTaxExempt,
    subscriptionDeadline: null,
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
      sourceMovementType: raw.movimentacao,
      isIncoming: parsedType.isIncoming ?? false,
      isTaxExempt: parsedType.isTaxExempt,
      subscriptionDeadline: null,
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
        sourceMovementType: line.normalized.sourceMovementType,
        isIncoming: line.normalized.isIncoming ?? false,
        isTaxExempt: line.normalized.isTaxExempt,
        subscriptionDeadline: line.normalized.subscriptionDeadline,
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
