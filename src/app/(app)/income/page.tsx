import { Suspense } from 'react'
import { TrendingUp } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IncomePageClient } from './page-client'

const typeLabels: Record<string, string> = {
  DIVIDEND: 'Dividendo',
  JCP: 'JCP',
  FII_RENT: 'Rendimento FII',
  COUPON: 'Cupom',
  RENTAL: 'Aluguel',
}

async function IncomeContent() {
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

  const incomeEvents = await prisma.incomeEvent.findMany({
    where: { 
      accountId: { in: accountIds },
      deletedAt: null,
    },
    include: {
      asset: { select: { ticker: true } },
      account: { select: { name: true } },
    },
    orderBy: { paymentDate: 'desc' },
    take: 50,
  })

  return <IncomePageClient incomeEvents={incomeEvents} typeLabels={typeLabels} />
}

function IncomeSkeleton() {
  return (
    <div className="bg-gray-200 rounded-xl h-64 animate-pulse" />
  )
}

export default function IncomePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proventos</h1>
          <p className="text-sm text-gray-500 mt-1">Dividendos, rendimentos e cupons recebidos</p>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <TrendingUp size={16} />
          <span className="text-sm">Renda</span>
        </div>
      </div>
      <Suspense fallback={<IncomeSkeleton />}>
        <IncomeContent />
      </Suspense>
    </div>
  )
}