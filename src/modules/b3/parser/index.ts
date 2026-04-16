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
export { parseMovimentacao, parseMovimentacaoRow } from './movimentacao'
export { parsePosicao, parsePosicaoRow } from './posicao'
