import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getQuotes as getQuotesFromService } from '@/modules/quotes/service/get-quotes'
import type { QuoteResult } from '@/modules/quotes/domain/types'
export type { QuoteResult } from '@/modules/quotes/domain/types'

function toDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

async function persistAssetPrices(quotes: Map<string, QuoteResult>) {
  if (quotes.size === 0 || process.env.NODE_ENV === 'test') {
    return
  }

  const tickers = Array.from(quotes.keys())
  const assets = await prisma.asset.findMany({
    where: { ticker: { in: tickers } },
    select: { id: true, ticker: true },
  })

  for (const asset of assets) {
    if (!asset.ticker) continue
    const quote = quotes.get(asset.ticker)
    if (!quote) continue

    await prisma.assetPrice.upsert({
      where: {
        assetId_date: {
          assetId: asset.id,
          date: toDateOnly(quote.changedAt),
        },
      },
      update: {
        price: new Prisma.Decimal(quote.price.toString()),
        source: 'API_QUOTES',
      },
      create: {
        assetId: asset.id,
        price: new Prisma.Decimal(quote.price.toString()),
        date: toDateOnly(quote.changedAt),
        source: 'API_QUOTES',
      },
    })
  }
}

/**
 * Fachada de compatibilidade para busca de cotações.
 */
export async function getQuotes(tickers: string[]) {
  const quotes = await getQuotesFromService(tickers)
  await persistAssetPrices(quotes)
  return quotes
}
