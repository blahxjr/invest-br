'use client'

import { useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import PositionCard from './position-card'
import PositionsSummary from './positions-summary'
import type { AssetCategory } from '@prisma/client'
import type { PositionSummary, SerializedPositionWithQuote } from '@/modules/positions/types'

type FilterCategory = AssetCategory | 'all'

type Props = {
  positions: SerializedPositionWithQuote[]
}

function summarize(positions: SerializedPositionWithQuote[]): PositionSummary {
  return positions.reduce(
    (summary, position) => ({
      totalCost: summary.totalCost.plus(position.totalCost),
      assetCount: summary.assetCount + 1,
      totalQuantity: summary.totalQuantity.plus(position.quantity),
    }),
    {
      totalCost: new Decimal(0),
      assetCount: 0,
      totalQuantity: new Decimal(0),
    },
  )
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export default function PositionsPageClient({ positions }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all')
  const [classFilter, setClassFilter] = useState<string>('all')

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.category)))],
    [positions],
  )

  const classes = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.assetClassCode).filter(Boolean)))],
    [positions],
  )

  const filteredPositions = useMemo(
    () => positions.filter((position) => {
      const categoryMatch = categoryFilter === 'all' || position.category === categoryFilter
      const classMatch = classFilter === 'all' || position.assetClassCode === classFilter
      return categoryMatch && classMatch
    }),
    [positions, categoryFilter, classFilter],
  )

  const summary = useMemo(() => summarize(filteredPositions), [filteredPositions])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posições da Carteira</h1>
        <p className="mt-1 text-sm text-gray-500">
          Posições abertas calculadas em memória a partir das movimentações BUY e SELL.
        </p>
      </div>

      <PositionsSummary summary={summary} />

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Categoria</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((category) => (
              <FilterButton
                key={category}
                active={categoryFilter === category}
                label={category === 'all' ? 'Todas' : category}
                onClick={() => setCategoryFilter(category as FilterCategory)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Classe do Ativo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {classes.map((assetClassCode) => (
              <FilterButton
                key={assetClassCode}
                active={classFilter === assetClassCode}
                label={assetClassCode === 'all' ? 'Todas as classes' : assetClassCode}
                onClick={() => setClassFilter(assetClassCode)}
              />
            ))}
          </div>
        </div>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Nenhuma posição encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPositions.map((position) => (
            <PositionCard key={position.assetId} position={position} />
          ))}
        </div>
      )}
    </div>
  )
}
