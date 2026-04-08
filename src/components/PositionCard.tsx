import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface PositionCardProps {
  ticker: string
  name: string
  quantity: number
  averageCost: number
  currentValue?: number
  category: string
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatVariation(pct: number) {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export default function PositionCard({
  ticker,
  name,
  quantity,
  averageCost,
  currentValue,
  category,
}: PositionCardProps) {
  const totalCost = quantity * averageCost
  const hasCurrentValue = currentValue != null && currentValue > 0
  const totalCurrent = hasCurrentValue ? currentValue * quantity : totalCost
  const gainLoss = totalCurrent - totalCost
  const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
  const isPositive = gainLoss >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-bold text-gray-900 text-base">{ticker}</span>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{name}</p>
        </div>
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          {category}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Quantidade</p>
          <p className="font-semibold text-gray-900">{quantity.toLocaleString('pt-BR')}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Custo médio</p>
          <p className="font-semibold text-gray-900">{formatCurrency(averageCost)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Custo total</p>
          <p className="font-semibold text-gray-900">{formatCurrency(totalCost)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Valor atual</p>
          <p className="font-semibold text-gray-900">{formatCurrency(totalCurrent)}</p>
        </div>
      </div>

      <div
        className={clsx(
          'mt-3 flex items-center gap-1 text-sm font-semibold',
          isPositive ? 'text-green-600' : 'text-red-600'
        )}
      >
        {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        <span>{formatCurrency(gainLoss)}</span>
        <span className="text-xs font-normal">({formatVariation(gainLossPct)})</span>
      </div>
    </div>
  )
}
