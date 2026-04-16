'use client'

import clsx from 'clsx'
import Decimal from 'decimal.js'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { SerializedPositionWithQuote } from '@/modules/positions/types'

export type SortField = 'ticker' | 'assetClassCode' | 'category' | 'accountName' | 'institutionName' | 'quantity' | 'avgCost' | 'totalCost' | 'currentValue' | 'gainLoss' | 'allocationPct'
export type SortDir = 'asc' | 'desc' | null

function formatCurrency(value: string | null): string {
  if (!value) return '—'
  const n = new Decimal(value).toNumber()
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQuantity(value: string): string {
  const n = new Decimal(value).toNumber()
  return n.toLocaleString('pt-BR')
}

function formatPercent(value: string | null): string {
  if (!value) return '—'
  const n = new Decimal(value).toNumber()
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function getInstitutionShort(name: string | null): string {
  if (!name) return '—'
  return name.split(' ').slice(0, 2).join(' ')
}

function compareValues(a: any, b: any, field: SortField, dir: SortDir): number {
  if (field === 'quantity' || field === 'avgCost' || field === 'totalCost' || field === 'currentValue' || field === 'gainLoss' || field === 'allocationPct') {
    const aVal = new Decimal(a ?? 0)
    const bVal = new Decimal(b ?? 0)
    return dir === 'asc' ? aVal.comparedTo(bVal) : bVal.comparedTo(aVal)
  }

  const aVal = (a ?? '').toString().toLowerCase()
  const bVal = (b ?? '').toString().toLowerCase()
  if (dir === 'asc') return aVal.localeCompare(bVal)
  return bVal.localeCompare(aVal)
}

export default function PositionsTable({
  positions,
  sortField,
  sortDir,
  onSort,
}: {
  positions: SerializedPositionWithQuote[]
  sortField: SortField | null
  sortDir: SortDir
  onSort: (field: SortField, dir: SortDir) => void
}) {
  const handleHeaderClick = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') onSort(field, 'desc')
      else if (sortDir === 'desc') onSort(field, null)
      else onSort(field, 'asc')
    } else {
      onSort(field, 'asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    if (sortDir === 'asc') return <ArrowUp size={14} />
    if (sortDir === 'desc') return <ArrowDown size={14} />
    return null
  }

  const TableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      onClick={() => handleHeaderClick(field)}
      className="cursor-pointer border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon field={field} />
      </div>
    </th>
  )

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <TableHeader field="ticker" label="Ativo" />
            <TableHeader field="assetClassCode" label="Classe" />
            <TableHeader field="category" label="Categoria" />
            <TableHeader field="accountName" label="Conta" />
            <TableHeader field="institutionName" label="Instituição" />
            <TableHeader field="quantity" label="Qtd" />
            <TableHeader field="avgCost" label="P.Médio" />
            <TableHeader field="totalCost" label="Custo Total" />
            <TableHeader field="currentValue" label="Valor Atual" />
            <TableHeader field="gainLoss" label="Gain/Loss" />
            <TableHeader field="allocationPct" label="% Carteira" />
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <tr key={position.assetId} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-semibold text-gray-900">{position.ticker}</td>
              <td className="px-4 py-3 text-gray-700">{position.assetClassCode || '—'}</td>
              <td className="px-4 py-3 text-gray-700">{position.category}</td>
              <td className="px-4 py-3 text-gray-700">{position.accountName}</td>
              <td className="px-4 py-3 text-gray-700">{getInstitutionShort(position.institutionName)}</td>
              <td className="px-4 py-3 text-gray-700">{formatQuantity(position.quantity)}</td>
              <td className="px-4 py-3 text-gray-700">{formatCurrency(position.avgCost)}</td>
              <td className="px-4 py-3 text-gray-700">{formatCurrency(position.totalCost)}</td>
              <td className="px-4 py-3 text-gray-700">{formatCurrency(position.currentValue)}</td>
              <td className="px-4 py-3">
                {position.gainLoss ? (
                  <span className={new Decimal(position.gainLoss).gte(0) ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {formatCurrency(position.gainLoss)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3 font-semibold text-blue-600">{new Decimal(position.allocationPct).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
