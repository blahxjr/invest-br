import { Suspense } from 'react'
import { Plus, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const typeLabels: Record<string, string> = {
  DIVIDEND: 'Dividendo',
  JCP: 'JCP',
  FII_RENT: 'Rendimento FII',
  COUPON: 'Cupom',
  RENTAL: 'Aluguel',
}

function formatCurrency(value: { toString(): string } | null) {
  if (!value) return '—'
  return parseFloat(value.toString()).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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

  return (
    <>
      {incomeEvents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Nenhum provento registrado.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ativo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Conta</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Bruto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">IR</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incomeEvents.map((incomeEvent) => (
                  <tr key={incomeEvent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(incomeEvent.paymentDate)}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {typeLabels[incomeEvent.type] ?? incomeEvent.type}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{incomeEvent.asset?.ticker ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{incomeEvent.account.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(incomeEvent.grossAmount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(incomeEvent.taxAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(incomeEvent.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
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
          <p className="text-sm text-gray-500 mt-1">Dividendos, rendimentos e cupons recebidos (últimos 50)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500">
            <TrendingUp size={16} />
            <span className="text-sm">Renda</span>
          </div>
          <Link
            href="/income/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Novo Provento
          </Link>
        </div>
      </div>
      <Suspense fallback={<IncomeSkeleton />}>
        <IncomeContent />
      </Suspense>
    </div>
  )
}