// @vitest-environment jsdom
'use client'

import { X } from 'lucide-react'

export type TransactionFilter = {
  dateFrom?: string
  dateTo?: string
  assetId?: string
  type?: string
}

type Props = {
  filter: TransactionFilter
  onFilterChange: (filter: TransactionFilter) => void
  assets: Array<{ id: string; ticker: string | null; name: string }>
  transactionTypes: string[]
}

export function TransactionFilters({
  filter,
  onFilterChange,
  assets,
  transactionTypes,
}: Props) {
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, dateFrom: e.target.value })
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filter, dateTo: e.target.value })
  }

  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filter, assetId: e.target.value || undefined })
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filter, type: e.target.value || undefined })
  }

  const handleReset = () => {
    onFilterChange({})
  }

  const hasActiveFilters = filter.dateFrom || filter.dateTo || filter.assetId || filter.type

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={14} />
              Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Data De */}
          <div>
            <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-600 mb-1">
              De
            </label>
            <input
              id="dateFrom"
              type="date"
              value={filter.dateFrom || ''}
              onChange={handleDateFromChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors"
            />
          </div>

          {/* Data Até */}
          <div>
            <label htmlFor="dateTo" className="block text-xs font-medium text-gray-600 mb-1">
              Até
            </label>
            <input
              id="dateTo"
              type="date"
              value={filter.dateTo || ''}
              onChange={handleDateToChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors"
            />
          </div>

          {/* Ativo */}
          <div>
            <label htmlFor="asset" className="block text-xs font-medium text-gray-600 mb-1">
              Ativo
            </label>
            <select
              id="asset"
              value={filter.assetId || ''}
              onChange={handleAssetChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors bg-white"
            >
              <option value="">Todos</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.ticker || asset.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label htmlFor="type" className="block text-xs font-medium text-gray-600 mb-1">
              Tipo
            </label>
            <select
              id="type"
              value={filter.type || ''}
              onChange={handleTypeChange}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-colors bg-white"
            >
              <option value="">Todos</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
