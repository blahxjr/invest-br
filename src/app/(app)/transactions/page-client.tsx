// @vitest-environment jsdom
'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { TransactionFilters, type TransactionFilter } from '@/components/TransactionFilters'

type Transaction = {
  id: string
  type: string
  date: string
  quantity: string | null
  price: string | null
  totalAmount: string
  asset?: {
    id: string
    ticker: string | null
    name: string
  } | null
  account: {
    name: string
  }
}

type Asset = {
  id: string
  ticker: string | null
  name: string
}

type Props = {
  transactions: Transaction[]
  assets: Asset[]
  typeLabels: Record<string, string>
  typeColors: Record<string, string>
}

const transactionTypesList = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'INCOME', 'RENT']

function formatCurrency(value: string | null) {
  if (!value) return '—'
  return parseFloat(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(dateString: string) {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function filterTransactions(transactions: Transaction[], filter: TransactionFilter): Transaction[] {
  return transactions.filter((tx) => {
    // Data De
    if (filter.dateFrom) {
      const txDate = new Date(tx.date)
      const fromDate = new Date(filter.dateFrom)
      if (txDate < fromDate) return false
    }

    // Data Até
    if (filter.dateTo) {
      const txDate = new Date(tx.date)
      const toDate = new Date(filter.dateTo)
      toDate.setHours(23, 59, 59, 999)
      if (txDate > toDate) return false
    }

    // Ativo
    if (filter.assetId && tx.asset?.id !== filter.assetId) {
      return false
    }

    // Tipo
    if (filter.type && tx.type !== filter.type) {
      return false
    }

    return true
  })
}

export function TransactionsPageClient({
  transactions,
  assets,
  typeLabels,
  typeColors,
}: Props) {
  const [filter, setFilter] = useState<TransactionFilter>({})

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filter),
    [transactions, filter]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Movimentações</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredTransactions.length} de {transactions.length} movimentação(ões)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-500">
            <ArrowLeftRight size={16} />
            <span className="text-sm">Ledger</span>
          </div>
          <Link
            href="/transactions/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nova Transação
          </Link>
        </div>
      </div>

      <TransactionFilters
        filter={filter}
        onFilterChange={setFilter}
        assets={assets}
        transactionTypes={transactionTypesList}
      />

      {filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          {transactions.length === 0 ? 'Nenhuma movimentação encontrada.' : 'Nenhuma movimentação corresponde aos filtros selecionados.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Ativo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Conta
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Qtd
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Preço
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          typeColors[tx.type] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {typeLabels[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {tx.asset?.ticker ?? '—'}
                      {tx.asset?.name && (
                        <span className="block text-xs text-gray-400 font-normal">{tx.asset.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tx.account.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {tx.quantity ? parseFloat(tx.quantity).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(tx.price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
