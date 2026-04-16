import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Wallet, DollarSign, BarChart3, Calendar } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import DashboardClient from './dashboard-client'
import { getPortfolioSummary } from '@/modules/positions/service'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Dashboard | Invest BR',
}

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

async function DashboardContent() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  let summary
  try {
    summary = await getPortfolioSummary(session.user.id)
  } catch {
    summary = {
      totalCost: { toString: () => '0' },
      totalValue: { toString: () => '0' },
      totalGainLoss: { toString: () => '0' },
      totalGainLossPct: 0,
      assetCount: 0,
      monthlyIncome: { toString: () => '0' },
      topPositions: [],
      allocationByClass: [],
    }
  }

  // Se não há posições, mostra EmptyState
  if (summary.assetCount === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Sua carteira está vazia"
        description="Importe sua planilha de negociações B3 para começar"
        action={{ label: 'Importar B3', href: '/import' }}
      />
    )
  }

  // Serializa Decimal → number/string
  const totalCostNum = parseFloat(summary.totalCost.toString())
  const totalValueNum = parseFloat(summary.totalValue.toString())
  const totalGainLossNum = parseFloat(summary.totalGainLoss.toString())
  const monthlyIncomeNum = parseFloat(summary.monthlyIncome.toString())

  // Monta array de alocação para o gráfico
  const allocationForClient = summary.allocationByClass.map((item) => ({
    category: item.className,
    value: item.value.toFixed(2),
    percentage: item.pct.toFixed(1),
  }))

  // 4 KPIs principais
  const stats = [
    {
      label: 'Patrimônio Total',
      value: formatCurrency(totalValueNum),
      subtitle: `Custo total: ${formatCurrency(totalCostNum)}`,
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Rendimento Total',
      value: formatCurrency(totalGainLossNum),
      subtitle: `${summary.totalGainLossPct.toFixed(2)}%`,
      icon: totalGainLossNum >= 0 ? TrendingUp : TrendingDown,
      color: totalGainLossNum >= 0 ? 'text-green-600' : 'text-red-600',
      bg: totalGainLossNum >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      label: 'Ativos',
      value: `${summary.assetCount}`,
      subtitle: 'ativos na carteira',
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Proventos no Mês',
      value: formatCurrency(monthlyIncomeNum),
      subtitle: `Mês de ${formatDate(new Date())}`,
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <>
      {/* 1. KPIs — 4 cards em grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, subtitle, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon size={18} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 5. TOP 5 POSIÇÕES */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Posições</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Ticker</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Nome</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Classe</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Qtd</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Valor Atual</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">% Carteira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summary.topPositions.map((pos) => {
                    const value = pos.currentValue ? parseFloat(pos.currentValue) : parseFloat(pos.totalCost)
                    const alloc = parseFloat(pos.allocationPct)
                    return (
                      <tr key={pos.ticker} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-mono font-semibold text-gray-900">{pos.ticker}</td>
                        <td className="px-6 py-3 text-gray-700 max-w-xs truncate">{pos.name}</td>
                        <td className="px-6 py-3 text-gray-700">{pos.assetClassCode}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{parseFloat(pos.quantity).toFixed(2)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(value)}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{alloc.toFixed(2)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Link
            href="/positions"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todas as posições →
          </Link>
        </div>

        {/* 6. GRÁFICO DE ALOCAÇÃO */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alocação por Classe</h2>
          <DashboardClient items={allocationForClient} />
          <div className="mt-4 space-y-2">
            {summary.allocationByClass.map((item) => (
              <div key={item.className} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{item.className}</span>
                <span className="font-semibold text-gray-900">{item.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-200 rounded-xl h-80" />
        <div className="bg-gray-200 rounded-xl h-80" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral da sua carteira de investimentos</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
