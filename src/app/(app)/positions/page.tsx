import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPositions } from '@/modules/positions/service'
import { getQuotes } from '@/lib/quotes'
import { enrichWithQuotes } from '@/modules/positions/types'
import PositionsPageClient from './positions-page-client'

export default async function PositionsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const positions = await getPositions(session.user.id)
  const quotes = await getQuotes(positions.map((position) => position.ticker))
  const enriched = enrichWithQuotes(positions, quotes)

  const serializedWithQuotes = enriched.map((position) => ({
    ...position,
    quantity: position.quantity.toString(),
    avgCost: position.avgCost.toString(),
    totalCost: position.totalCost.toString(),
    allocationPct: position.allocationPct.toString(),
    currentValue: position.currentValue?.toString() ?? null,
    gainLoss: position.gainLoss?.toString() ?? null,
    gainLossPercent: position.gainLossPercent?.toString() ?? null,
    quotedAt: position.quotedAt?.toISOString() ?? null,
  }))

  return (
    <div>
      <PositionsPageClient positions={serializedWithQuotes} />
    </div>
  )
}
