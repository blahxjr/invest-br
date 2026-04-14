'use client'

import { useMemo, useState } from 'react'
import type { PeriodOption } from '@/modules/positions/history'
import PerformancePatrimonyChart from './patrimony-chart'
import type { PatrimonyChartPoint } from '@/components/PatrimonyChart'

type PerformanceStats = {
  totalGainCost: string
  totalGainPct: string
  bestMonth: string
  biggestPosition: string
}

type Props = {
  allSnapshots: PatrimonyChartPoint[]
  stats: PerformanceStats
}

const periods: PeriodOption[] = ['1M', '3M', '6M', '1Y', 'ALL']

function toDateStart(dateIso: string): Date {
  const date = new Date(dateIso)
  date.setHours(0, 0, 0, 0)
  return date
}

function filterByPeriod(points: PatrimonyChartPoint[], period: PeriodOption): PatrimonyChartPoint[] {
  if (period === 'ALL') return points

  const days = period === '1M' ? 30 : period === '3M' ? 90 : period === '6M' ? 180 : 365
  const threshold = new Date()
  threshold.setHours(0, 0, 0, 0)
  threshold.setDate(threshold.getDate() - (days - 1))

  const filtered = points.filter((point) => toDateStart(point.date) >= threshold)
  if (filtered.length > 0) return filtered

  return points.slice(-1)
}

function formatCurrencyFromString(value: string): string {
  const num = parseFloat(value)
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatPercentFromString(value: string): string {
  const num = parseFloat(value)
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

export default function PerformancePageClient({ allSnapshots, stats }: Props) {
  const [period, setPeriod] = useState<PeriodOption>('1Y')

  const visibleSnapshots = useMemo(() => filterByPeriod(allSnapshots, period), [allSnapshots, period])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {periods.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                period === option
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
              ].join(' ')}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <PerformancePatrimonyChart snapshots={visibleSnapshots} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">P&L Total</p>
          <p className="text-xl font-bold text-gray-900 mt-2">{formatCurrencyFromString(stats.totalGainCost)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Variação Total</p>
          <p className="text-xl font-bold text-gray-900 mt-2">{formatPercentFromString(stats.totalGainPct)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Melhor mês</p>
          <p className="text-xl font-bold text-gray-900 mt-2">{stats.bestMonth}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Maior posição</p>
          <p className="text-xl font-bold text-gray-900 mt-2">{stats.biggestPosition}</p>
        </div>
      </div>
    </div>
  )
}
