import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import AccountCard from '@/components/AccountCard'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

function toNumber(d: { toString(): string } | null | undefined): number {
  if (!d) return 0
  return parseFloat(d.toString())
}

async function AccountsContent() {
  const session = await auth()
  const userId = session?.user?.id

  const portfolio = await prisma.portfolio.findFirst({
    where: userId ? { userId } : undefined,
    include: {
      accounts: {
        include: { institution: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  const accounts = portfolio?.accounts ?? []

  // Busca saldo e contagem de transações para cada conta
  const accountsWithData = await Promise.all(
    accounts.map(async (acc) => {
      const last = await prisma.ledgerEntry.findFirst({
        where: { accountId: acc.id },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      })
      const txCount = await prisma.transaction.count({ where: { accountId: acc.id } })
      return {
        ...acc,
        balance: toNumber(last?.balanceAfter),
        transactionCount: txCount,
      }
    })
  )

  return (
    <>
      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-2">Nenhuma conta encontrada.</p>
          <p className="text-sm text-gray-400">Execute o seed para popular o banco de dados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accountsWithData.map((acc) => (
            <AccountCard
              key={acc.id}
              name={acc.name}
              type={acc.type}
              institutionName={acc.institution?.name}
              balance={acc.balance}
              transactionCount={acc.transactionCount}
            />
          ))}
        </div>
      )}
    </>
  )
}

function AccountsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-gray-200 rounded-xl h-40" />
      ))}
    </div>
  )
}

export default function AccountsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerenciar contas de investimento</p>
        </div>
        <Link
          href="/accounts/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Nova Conta
        </Link>
      </div>
      <Suspense fallback={<AccountsSkeleton />}>
        <AccountsContent />
      </Suspense>
    </div>
  )
}
