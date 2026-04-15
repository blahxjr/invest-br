import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { TransactionsPageClient } from './page-client'

const typeLabels: Record<string, string> = {
  BUY: 'Compra',
  SELL: 'Venda',
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Retirada',
  DIVIDEND: 'Dividendo',
  INCOME: 'Rendimento',
  RENT: 'Aluguel',
}

const typeColors: Record<string, string> = {
  BUY: 'bg-blue-50 text-blue-700',
  SELL: 'bg-purple-50 text-purple-700',
  DEPOSIT: 'bg-green-50 text-green-700',
  WITHDRAWAL: 'bg-red-50 text-red-700',
  DIVIDEND: 'bg-yellow-50 text-yellow-700',
  INCOME: 'bg-teal-50 text-teal-700',
  RENT: 'bg-orange-50 text-orange-700',
}

async function TransactionsContent() {
  const session = await auth()
  const userId = session?.user?.id

  const portfolio = await prisma.portfolio.findFirst({
    where: userId ? { userId } : undefined,
    include: { accounts: true },
  })

  if (!portfolio) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        Nenhum portfólio encontrado.
      </div>
    )
  }

  const accountIds = portfolio.accounts.map((a) => a.id)

  // Buscar 500 transações para filtro client-side
  const transactions = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds } },
    include: {
      asset: { select: { id: true, ticker: true, name: true } },
      account: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 500,
  })

  // Extrair ativos únicos
  const uniqueAssets = Array.from(
    new Map(
      transactions
        .filter((tx) => tx.asset)
        .map((tx) => [tx.asset!.id, tx.asset!])
    ).values()
  )

  // Serializar Decimal → string (DEC-016)
  const serializedTransactions = transactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    date: tx.date.toISOString(),
    quantity: tx.quantity ? tx.quantity.toString() : null,
    price: tx.price ? tx.price.toString() : null,
    totalAmount: tx.totalAmount.toString(),
    asset: tx.asset,
    account: tx.account,
  }))

  return (
    <TransactionsPageClient
      transactions={serializedTransactions}
      assets={uniqueAssets}
      typeLabels={typeLabels}
      typeColors={typeColors}
    />
  )
}

function TransactionsSkeleton() {
  return <div className="bg-gray-200 rounded-xl h-64 animate-pulse" />
}

export default function TransactionsPage() {
  return (
    <div>
      <Suspense fallback={<TransactionsSkeleton />}>
        <TransactionsContent />
      </Suspense>
    </div>
  )
}
