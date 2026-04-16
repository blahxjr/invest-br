'use client'

import { useEffect, useMemo, useState } from 'react'
import Decimal from 'decimal.js'
import PositionCard from './position-card'
import PositionsTable from './positions-table'
import PositionsSummary from './positions-summary'
import type { AssetCategory } from '@prisma/client'
import type { PositionSummary, SerializedPositionWithQuote } from '@/modules/positions/types'

type FilterCategory = AssetCategory | 'all'
type ViewMode = 'cards' | 'table'
type SortField = 'ticker' | 'assetClassCode' | 'category' | 'accountName' | 'institutionName' | 'quantity' | 'avgCost' | 'totalCost' | 'currentValue' | 'gainLoss' | 'allocationPct'
type SortDir = 'asc' | 'desc' | null

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

function sortPositions(
  positions: SerializedPositionWithQuote[],
  field: SortField | null,
  dir: SortDir,
): SerializedPositionWithQuote[] {
  if (!field || !dir) return positions

  return [...positions].sort((a, b) => {
    const aVal = (a as any)[field]
    const bVal = (b as any)[field]

    if (field === 'quantity' || field === 'avgCost' || field === 'totalCost' || field === 'currentValue' || field === 'gainLoss' || field === 'allocationPct') {
      const aNum = new Decimal(aVal ?? 0)
      const bNum = new Decimal(bVal ?? 0)
      return dir === 'asc' ? aNum.comparedTo(bNum) : bNum.comparedTo(aNum)
    }

    const aStr = (aVal ?? '').toString().toLowerCase()
    const bStr = (bVal ?? '').toString().toLowerCase()
    return dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
  })
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

function clsx(...classes: any[]): string {
  return classes.filter(Boolean).join(' ')
}

export default function PositionsPageClient({ positions }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all')
  const [classFilter, setClassFilter] = useState<string>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [institutionFilter, setInstitutionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  // Load view mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('positions-view-mode')
    if (saved === 'table' || saved === 'cards') {
      setViewMode(saved)
    }
  }, [])

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('positions-view-mode', viewMode)
  }, [viewMode])

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.category)))],
    [positions],
  )

  const classes = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.assetClassCode).filter(Boolean)))],
    [positions],
  )

  const accounts = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.accountName).filter(Boolean)))],
    [positions],
  )

  const institutions = useMemo(
    () => ['all', ...Array.from(new Set(positions.map((position) => position.institutionName).filter(Boolean)))],
    [positions],
  )

  const filteredPositions = useMemo(() => {
    let filtered = positions.filter((position) => {
      const categoryMatch = categoryFilter === 'all' || position.category === categoryFilter
      const classMatch = classFilter === 'all' || position.assetClassCode === classFilter
      const accountMatch = accountFilter === 'all' || position.accountName === accountFilter
      const institutionMatch = institutionFilter === 'all' || position.institutionName === institutionFilter
      const searchMatch =
        !searchQuery ||
        position.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        position.name.toLowerCase().includes(searchQuery.toLowerCase())
      return categoryMatch && classMatch && accountMatch && institutionMatch && searchMatch
    })

    return sortPositions(filtered, sortField, sortDir)
  }, [positions, categoryFilter, classFilter, accountFilter, institutionFilter, searchQuery, sortField, sortDir])

  const summary = useMemo(() => summarize(filteredPositions), [filteredPositions])

  const handleSort = (field: SortField, dir: SortDir) => {
    setSortField(field)
    setSortDir(dir)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posições da Carteira</h1>
        <p className="mt-1 text-sm text-gray-500">
          Posições abertas calculadas em memória a partir das movimentações BUY e SELL.
        </p>
      </div>

      <PositionsSummary summary={summary} />

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode('cards')}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
            viewMode === 'cards'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          ■ Cards
        </button>
        <button
          onClick={() => setViewMode('table')}
          className={clsx(
            'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors',
            viewMode === 'table'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          ≡ Tabela
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        {/* Search */}
        <div>
          <label className="text-sm font-medium text-gray-700">Buscar ativo</label>
          <input
            type="text"
            placeholder="Buscar por ticker ou nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-50"
          />
        </div>

        {/* Account Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700">Conta</label>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          >
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account === 'all' ? 'Todas as contas' : account}
              </option>
            ))}
          </select>
        </div>

        {/* Institution Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700">Instituição</label>
          <select
            value={institutionFilter}
            onChange={(e) => setInstitutionFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          >
            {institutions.map((institution) => (
              <option key={institution || 'no-institution'} value={institution || 'all'}>
                {institution === 'all' ? 'Todas as instituições' : institution || 'Sem instituição'}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
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

        {/* Class Filter */}
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

      {/* Content */}
      {filteredPositions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          Nenhuma posição encontrada para os filtros selecionados.
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPositions.map((position) => (
            <PositionCard key={position.assetId} position={position} />
          ))}
        </div>
      ) : (
        <PositionsTable positions={filteredPositions} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
      )}
    </div>
  )
}
