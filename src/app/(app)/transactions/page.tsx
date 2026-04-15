import { Suspense } from 'react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { TransactionsPageClient } from './page-client'

export const metadata: Metadata = {
  title: 'Transações | Invest BR',
}

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
  try {
    const session = await auth()
    const userId = session?.user?.id

    const portfolio = await prisma.portfolio.findFirst({
      where: userId ? { userId } : undefined,
      include: { accounts: true },
    })

    if (!portfolio) {
      return (
        <TransactionsPageClient
          transactions={[]}
          assets={[]}
          typeLabels={typeLabels}
          typeColors={typeColors}
        />
      )
    }

    const accountIds = portfolio.accounts.map((account) => account.id)

    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        deletedAt: null,
      },
      include: {
        asset: { select: { id: true, ticker: true, name: true } },
        account: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 500,
    })

    const uniqueAssets = Array.from(
      new Map(
        transactions
          .filter((transaction) => transaction.asset)
          .map((transaction) => [transaction.asset!.id, transaction.asset!])
      ).values()
    )

    const serializedTransactions = transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      date: transaction.date.toISOString(),
      quantity: transaction.quantity ? transaction.quantity.toString() : null,
      price: transaction.price ? transaction.price.toString() : null,
      totalAmount: transaction.totalAmount.toString(),
      notes: transaction.notes,
      referenceId: transaction.referenceId,
      asset: transaction.asset,
      account: transaction.account,
    }))

    return (
      <TransactionsPageClient
        transactions={serializedTransactions}
        assets={uniqueAssets}
        typeLabels={typeLabels}
        typeColors={typeColors}
      />
    )
  } catch {
    return (
      <TransactionsPageClient
        transactions={[]}
        assets={[]}
        typeLabels={typeLabels}
        typeColors={typeColors}
      />
    )
  }
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
