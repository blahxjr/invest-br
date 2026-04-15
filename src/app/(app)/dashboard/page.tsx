import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, Wallet, DollarSign, BarChart3 } from 'lucide-react'
import PositionCard from '@/components/PositionCard'
import IncomeCard from '@/components/IncomeCard'
import { EmptyState } from '@/components/ui/EmptyState'
import DashboardClient from './dashboard-client'
import { getDashboardData } from './data'

export const metadata: Metadata = {
  title: 'Dashboard | Invest BR',
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function DashboardContent() {
  let data
  try {
    data = await getDashboardData()
  } catch {
    data = {
      totalPortfolioCost: { toString: () => '0' },
      totalCurrentValue: { toString: () => '0' },
      assetCount: 0,
      totalQuantity: { toString: () => '0' },
      totalIncomeMonth: { toString: () => '0' },
      top5Positions: [],
      allocationByCategory: [],
      recentIncome: [],
      alertsSummary: { total: 0, critical: 0, warning: 0, info: 0 },
    }
  }

  // Serializa Decimal → number para KPIs
  const totalCost = parseFloat(data.totalPortfolioCost.toString())
  const totalCurrentValue = parseFloat(data.totalCurrentValue.toString())
  const totalIncomeMonth = parseFloat(data.totalIncomeMonth.toString())

  // Serializa Decimal → string para o Client Component (não serializável pelo Next.js)
  const allocationForClient = data.allocationByCategory.map((item) => ({
    category: item.category,
    value: item.value.toFixed(2),
    percentage: item.percentage.toFixed(1),
  }))

  const stats = [
    {
      label: 'Patrimônio (Custo Total)',
      value: formatCurrency(totalCost),
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Valor de Mercado',
      value: formatCurrency(totalCurrentValue),
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Ativos em carteira',
      value: `${data.assetCount} ativos`,
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Rendimentos do mês',
      value: formatCurrency(totalIncomeMonth),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`${bg} p-2 rounded-lg`}>
                <Icon size={18} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-full lg:col-span-2">
          <DashboardClient items={allocationForClient} />
        </div>

        {/* Top 5 posições */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Top 5 Posições</h2>
          {data.top5Positions.length === 0 ? (
            <EmptyState
              icon="📊"
              title="Sua carteira está vazia"
              description="Importe um extrato da B3 ou adicione transações manualmente."
              action={{ label: 'Importar da B3', href: '/import' }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.top5Positions.map((pos) => (
                <PositionCard
                  key={pos.ticker}
                  ticker={pos.ticker}
                  name={pos.name}
                  quantity={parseFloat(pos.quantity.toString())}
                  averageCost={parseFloat(pos.avgCost.toString())}
                  totalCost={parseFloat(pos.totalCost.toString())}
                  currentPrice={pos.currentPrice}
                  currentValue={pos.currentValue ? parseFloat(pos.currentValue.toString()) : null}
                  gainLoss={pos.gainLoss ? parseFloat(pos.gainLoss.toString()) : null}
                  gainLossPercent={pos.gainLossPercent ? parseFloat(pos.gainLossPercent.toString()) : null}
                  quoteChangePct={pos.quoteChangePct}
                  category={pos.category}
                />
              ))}
            </div>
          )}
        </div>

        {/* Rendimentos recentes */}
        <div className="col-span-full lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Últimos Rendimentos</h2>
          {data.recentIncome.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              Nenhum rendimento registrado.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.recentIncome.map((income) => (
                <IncomeCard
                  key={income.id}
                  type={income.type}
                  ticker={income.ticker}
                  grossAmount={income.grossAmount}
                  netAmount={income.netAmount}
                  paymentDate={income.paymentDate}
                />
              ))}
            </div>
          )}

          <div className="col-span-full mt-6 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Alertas</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                Total: <span className="font-semibold">{data.alertsSummary.total}</span>
              </p>
              <p className="text-red-700">
                Críticos: <span className="font-semibold">{data.alertsSummary.critical}</span>
              </p>
              <p className="text-amber-700">
                Avisos: <span className="font-semibold">{data.alertsSummary.warning}</span>
              </p>
              <p className="text-blue-700">
                Informativos: <span className="font-semibold">{data.alertsSummary.info}</span>
              </p>
            </div>
            <Link
              href="/insights/rebalance"
              className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver análise completa →
            </Link>
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
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-36" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-24" />
          ))}
        </div>
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
