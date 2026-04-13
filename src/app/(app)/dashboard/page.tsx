import { Suspense } from 'react'
import { TrendingUp, Wallet, DollarSign, BarChart3 } from 'lucide-react'
import PositionCard from '@/components/PositionCard'
import IncomeCard from '@/components/IncomeCard'
import { getDashboardData } from './data'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function DashboardContent() {
  const data = await getDashboardData()

  const stats = [
    {
      label: 'Custo Total da Carteira',
      value: formatCurrency(data.totalCost),
      icon: Wallet,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Posições em carteira',
      value: `${data.positions.length} ativos`,
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Rendimentos do mês',
      value: formatCurrency(data.totalIncomeMonth),
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Contas cadastradas',
      value: `${data.accountCount}`,
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ]

  return (
    <>
      {/* KPI Cards */}
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
        {/* Top posições */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Top 5 Posições</h2>
          {data.positions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
              Nenhuma posição encontrada. Execute o seed para popular o banco.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.positions.map((pos) => (
                <PositionCard
                  key={pos.ticker}
                  ticker={pos.ticker}
                  name={pos.name}
                  quantity={pos.quantity}
                  averageCost={pos.averageCost}
                  category={pos.category}
                />
              ))}
            </div>
          )}
        </div>

        {/* Rendimentos recentes */}
        <div>
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral da sua carteira de investimentos</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
