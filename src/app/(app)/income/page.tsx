import { Suspense } from 'react'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IncomePageClient } from './page-client'

export const metadata: Metadata = {
  title: 'Proventos | Invest BR',
}

const typeLabels: Record<string, string> = {
  DIVIDEND: 'Dividendo',
  JCP: 'JCP',
  FII_RENT: 'Rendimento FII',
  COUPON: 'Cupom',
  RENTAL: 'Aluguel',
}

async function IncomeContent() {
  try {
    const session = await auth()
    const userId = session?.user?.id

    const portfolio = await prisma.portfolio.findFirst({
      where: userId ? { userId } : undefined,
      include: { accounts: true },
    })

    if (!portfolio) {
      return <IncomePageClient incomeEvents={[]} typeLabels={typeLabels} />
    }

    const accountIds = portfolio.accounts.map((account) => account.id)

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
  } catch {
    return <IncomePageClient incomeEvents={[]} typeLabels={typeLabels} />
  }
}

function IncomeSkeleton() {
  return (
    <div className="bg-gray-200 rounded-xl h-64 animate-pulse" />
  )
}

export default function IncomePage() {
  return (
    <div>
      <Suspense fallback={<IncomeSkeleton />}>
        <IncomeContent />
      </Suspense>
    </div>
  )
}