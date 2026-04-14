'use client'

import Decimal from 'decimal.js'
import type { PositionSummary } from '@/modules/positions/types'

function formatCurrency(value: Decimal) {
  return value.toNumber().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQuantity(value: Decimal) {
  return value.toNumber().toLocaleString('pt-BR')
}

export default function PositionsSummary({ summary }: { summary: PositionSummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Custo Total da Carteira</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.totalCost)}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ativos Distintos</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{summary.assetCount}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de Cotas</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{formatQuantity(summary.totalQuantity)}</p>
      </div>
    </div>
  )
}
