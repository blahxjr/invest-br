'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type PatrimonyChartPoint = {
  date: string
  totalCost: string
  assetCount: number
}

type Props = {
  snapshots: PatrimonyChartPoint[]
}

type ChartRow = {
  date: string
  totalCost: number
  assetCount: number
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatShortCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`
  return formatCurrency(value)
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export default function PatrimonyChart({ snapshots }: Props) {
  const chartData: ChartRow[] = snapshots.map((snapshot) => ({
    date: snapshot.date,
    totalCost: parseFloat(snapshot.totalCost),
    assetCount: snapshot.assetCount,
  }))

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
        Sem histórico suficiente para exibir o gráfico.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Patrimônio (custo total ao longo do tempo)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="patrimonyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            minTickGap={18}
          />
          <YAxis
            tickFormatter={formatShortCurrency}
            tick={{ fill: '#6b7280', fontSize: 12 }}
            width={72}
          />
          <Tooltip
            formatter={(value) => {
              const numericValue = typeof value === 'number' ? value : Number(value ?? 0)
              return [formatCurrency(numericValue), 'Patrimônio']
            }}
            labelFormatter={(label) =>
              new Date(label).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
              })
            }
          />
          <Area type="monotone" dataKey="totalCost" stroke="none" fill="url(#patrimonyFill)" />
          <Line
            type="monotone"
            dataKey="totalCost"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
