import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import PositionCard from '@/components/PositionCard'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type PositionItem = {
  assetId: string
  ticker: string | null
  name: string
  category: string
  quantity: number
  averageCost: number
  totalCost: number
}

async function PositionsContent() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const portfolio = await prisma.portfolio.findFirst({
    where: { userId: session.user.id },
    include: { accounts: true },
  })

  if (!portfolio) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        Nenhuma posição encontrada. Registre movimentações de compra para ver sua carteira.
      </div>
    )
  }

  const accountIds = portfolio.accounts.map((a) => a.id)

  if (accountIds.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        Nenhuma posição encontrada. Registre movimentações de compra para ver sua carteira.
      </div>
    )
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: accountIds },
      type: { in: ['BUY', 'SELL'] },
      assetId: { not: null },
    },
    include: {
      asset: { select: { id: true, ticker: true, name: true, category: true } },
    },
    orderBy: { date: 'asc' },
  })

  const positionMap = new Map<string, PositionItem>()

  for (const tx of transactions) {
    if (!tx.assetId) continue

    const key = tx.assetId
    const qty = parseFloat(tx.quantity?.toString() ?? '0')
    const price = tx.price
      ? parseFloat(tx.price.toString())
      : qty > 0
        ? parseFloat(tx.totalAmount.toString()) / qty
        : 0

    const existing =
      positionMap.get(key) ?? {
        assetId: key,
        ticker: tx.asset?.ticker ?? null,
        name: tx.asset?.name ?? key,
        category: tx.asset?.category ?? 'STOCK',
        quantity: 0,
        averageCost: 0,
        totalCost: 0,
      }

    if (tx.type === 'BUY') {
      const newTotalCost = existing.totalCost + qty * price
      const newQty = existing.quantity + qty
      existing.averageCost = newQty > 0 ? newTotalCost / newQty : 0
      existing.quantity = newQty
      existing.totalCost = newTotalCost
    } else if (tx.type === 'SELL') {
      existing.quantity = existing.quantity - qty
      existing.totalCost = existing.quantity > 0 ? existing.averageCost * existing.quantity : 0
    }

    positionMap.set(key, existing)
  }

  const positions = Array.from(positionMap.values())
    .filter((p) => p.quantity > 0)
    .sort((a, b) => b.totalCost - a.totalCost)

  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0)

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        Nenhuma posição encontrada. Registre movimentações de compra para ver sua carteira.
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-6 mb-6 p-4 bg-white rounded-xl border border-gray-200">
        <div>
          <p className="text-xs text-gray-500">Posições abertas</p>
          <p className="text-xl font-bold text-gray-900">{positions.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Custo total</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalCost)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map((pos) => (
          <PositionCard
            key={pos.assetId}
            ticker={pos.ticker ?? pos.assetId}
            name={pos.name}
            quantity={pos.quantity}
            averageCost={pos.averageCost}
            category={pos.category}
          />
        ))}
      </div>
    </>
  )
}

function PositionsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-xl h-40" />
      ))}
    </div>
  )
}

export default function PositionsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Posições</h1>
        <p className="text-sm text-gray-500 mt-1">
          Carteira atual - posições abertas ordenadas por custo total
        </p>
      </div>
      <Suspense fallback={<PositionsSkeleton />}>
        <PositionsContent />
      </Suspense>
    </div>
  )
}
