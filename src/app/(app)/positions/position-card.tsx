'use client'

import clsx from 'clsx'
import Decimal from 'decimal.js'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { SerializedPositionWithQuote } from '@/modules/positions/types'

function formatCurrency(value: Decimal) {
  return value.toNumber().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQuantity(value: Decimal) {
  return value.toNumber().toLocaleString('pt-BR')
}

const badgeColors: Record<string, string> = {
  STOCK: 'bg-blue-50 text-blue-700',
  FII: 'bg-green-50 text-green-700',
  ETF: 'bg-yellow-50 text-yellow-800',
  BDR: 'bg-purple-50 text-purple-700',
  CRYPTO: 'bg-orange-50 text-orange-700',
}

function formatPercent(value: Decimal): string {
  const n = value.toNumber()
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export default function PositionCard({ position }: { position: SerializedPositionWithQuote }) {
  const quantity = new Decimal(position.quantity)
  const avgCost = new Decimal(position.avgCost)
  const totalCost = new Decimal(position.totalCost)
  const currentValue = position.currentValue ? new Decimal(position.currentValue) : null
  const gainLoss = position.gainLoss ? new Decimal(position.gainLoss) : null
  const gainLossPercent = position.gainLossPercent ? new Decimal(position.gainLossPercent) : null
  const hasQuote = position.currentPrice != null && currentValue != null
  const isPositive = gainLoss != null && gainLoss.gte(0)
  const badgeClass = badgeColors[position.category] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-gray-900">{position.ticker}</p>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{position.name}</p>
        </div>
        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', badgeClass)}>
          {position.category}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-sm text-gray-700">
        <div className="flex items-center justify-between">
          <span>Qtd cotas</span>
          <span className="font-semibold text-gray-900">{formatQuantity(quantity)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Custo medio</span>
          <span className="font-semibold text-gray-900">{formatCurrency(avgCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Custo total</span>
          <span className="font-semibold text-gray-900">{formatCurrency(totalCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Classe</span>
          <span className="font-semibold text-gray-900">{position.assetClassCode || '—'}</span>
        </div>
        {hasQuote && (
          <>
            <div className="flex items-center justify-between">
              <span>Valor atual</span>
              <span className="font-semibold text-gray-900">{formatCurrency(currentValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>P&L</span>
              <span className={clsx('font-semibold flex items-center gap-1', isPositive ? 'text-green-600' : 'text-red-600')}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {gainLoss ? formatCurrency(gainLoss) : '—'}
                {gainLossPercent ? ` (${formatPercent(gainLossPercent)})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Var. dia</span>
              <span className={clsx('font-semibold', (position.quoteChangePct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                {position.quoteChangePct != null
                  ? `${position.quoteChangePct >= 0 ? '+' : ''}${position.quoteChangePct.toFixed(2)}%`
                  : '—'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
