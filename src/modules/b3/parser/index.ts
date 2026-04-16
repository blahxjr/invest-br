export type NegociacaoRow = {
  date: Date
  type: 'BUY' | 'SELL'
  ticker: string
  mercado: string
  instituicao: string
  quantity: number
  price: number
  total: number
  referenceId: string
}

export type MovimentacaoRow = {
  date: Date
  type: 'BUY' | 'DIVIDEND'
  ticker: string
  instituicao: string
  quantity: number
  price: number | null
  total: number | null
  referenceId: string
}

export type MovimentacaoReviewRow = {
  lineNumber: number
  reason: string
  raw: {
    entradaSaida: string
    data: string
    movimentacao: string
    produto: string
    instituicao: string
    quantidade: string
    precoUnitario: string
    valorOperacao: string
  }
}

export type ParseMovimentacaoResult = {
  readyRows: MovimentacaoRow[]
  reviewRows: MovimentacaoReviewRow[]
}

export type MovimentacaoParserClassification =
  | 'LIQUIDACAO'
  | 'PROVENTO'
  | 'EVENTO_CORPORATIVO'
  | 'IGNORAR'
  | 'REVISAR'

export type MovimentacaoParserStatus = 'OK' | 'REVISAR' | 'IGNORAR'

export type MovimentacaoParsedLine = {
  lineNumber: number
  status: MovimentacaoParserStatus
  classification: MovimentacaoParserClassification
  reason: string
  raw: {
    entradaSaida: string
    data: string
    movimentacao: string
    produto: string
    instituicao: string
    quantidade: string
    precoUnitario: string
    valorOperacao: string
  }
  normalized: {
    date: Date | null
    type: 'BUY' | 'DIVIDEND' | null
    ticker: string
    instituicao: string
    quantity: number
    price: number | null
    total: number | null
    referenceId: string
  }
}

export type PosicaoRow = {
  ticker: string
  name: string
  category: 'STOCK' | 'FII' | 'ETF' | 'BDR'
  quantity: number
  closePrice: number
  updatedValue: number
  instituicao: string
  conta: string
}

export type RawSheet = {
  name: string
  rows: Array<Array<string | number | null | undefined>>
}

export { inferAssetClass, parseNegociacao, parseNegociacaoRow, type InferredAssetClass } from './negociacao'
export { parseMovimentacao, parseMovimentacaoDetailed, parseMovimentacaoForReview, parseMovimentacaoRow } from './movimentacao'
export { parsePosicao, parsePosicaoRow } from './posicao'
