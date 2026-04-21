export type QuoteProviderId = 'brapi' | 'yahoo'

export type QuoteResult = {
  ticker: string
  price: number
  changedAt: Date
  changePercent: number
}

export type ProviderQuote = QuoteResult

export type ProviderResult = {
  providerId: QuoteProviderId
  quotes: Map<string, ProviderQuote>
  requestedTickers: number
  receivedTickers: number
  durationMs: number
  error?: string
}

export interface QuoteProvider {
  id: QuoteProviderId
  isEnabled(): boolean
  getQuotes(tickers: string[]): Promise<Map<string, ProviderQuote>>
}
