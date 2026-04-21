import { getQuotes as getQuotesFromService } from '@/modules/quotes/service/get-quotes'
export type { QuoteResult } from '@/modules/quotes/domain/types'

/**
 * Fachada de compatibilidade para busca de cotações.
 */
export async function getQuotes(tickers: string[]) {
  return getQuotesFromService(tickers)
}
