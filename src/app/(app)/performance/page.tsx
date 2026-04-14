import Decimal from 'decimal.js'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getPositions } from '@/modules/positions/service'
import { calcPatrimonyHistory } from '@/modules/positions/history'
import PerformancePageClient from './performance-page-client'

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
  })
}

function getBestMonthLabel(
  snapshots: { date: Date; totalCost: Decimal }[],
): string {
  if (snapshots.length < 2) return 'N/A'

  let bestDelta = new Decimal('-Infinity')
  let bestDate = snapshots[1].date

  for (let i = 1; i < snapshots.length; i++) {
    const delta = snapshots[i].totalCost.minus(snapshots[i - 1].totalCost)
    if (delta.gt(bestDelta)) {
      bestDelta = delta
      bestDate = snapshots[i].date
    }
  }

  return formatMonthYear(bestDate)
}

export default async function PerformancePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const allSnapshots = await calcPatrimonyHistory(session.user.id, 'ALL')
  const positions = await getPositions(session.user.id)

  const firstSnapshot = allSnapshots.find((snapshot) => snapshot.totalCost.gt(0))
  const lastSnapshot = allSnapshots.length > 0
    ? allSnapshots[allSnapshots.length - 1]
    : { date: new Date(), totalCost: new Decimal(0), assetCount: 0 }

  const firstTotal = firstSnapshot?.totalCost ?? new Decimal(0)
  const totalGainCost = lastSnapshot.totalCost.minus(firstTotal)
  const totalGainPct = firstTotal.isZero()
    ? new Decimal(0)
    : totalGainCost.div(firstTotal).times(100)

  const serializedSnapshots = allSnapshots.map((snapshot) => ({
    date: snapshot.date.toISOString(),
    totalCost: snapshot.totalCost.toString(),
    assetCount: snapshot.assetCount,
  }))

  const stats = {
    totalGainCost: totalGainCost.toString(),
    totalGainPct: totalGainPct.toString(),
    bestMonth: getBestMonthLabel(allSnapshots),
    biggestPosition: positions[0]?.ticker ?? 'N/A',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rentabilidade</h1>
        <p className="text-sm text-gray-500 mt-1">Evolução do patrimônio com base no custo histórico da carteira.</p>
      </div>

      <PerformancePageClient allSnapshots={serializedSnapshots} stats={stats} />
    </div>
  )
}
