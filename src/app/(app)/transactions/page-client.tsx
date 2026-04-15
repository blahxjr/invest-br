// @vitest-environment jsdom
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight, Plus, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { TransactionType } from '@prisma/client'
import { TransactionFilters, type TransactionFilter } from '@/components/TransactionFilters'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EditModal } from '@/components/ui/EditModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { updateTransaction, deleteTransaction } from './actions'

type Transaction = {
  id: string
  referenceId?: string
  type: string
  date: string
  quantity: string | null
  price: string | null
  totalAmount: string
  notes?: string | null
  asset?: {
    id: string
    ticker: string | null
    name: string
  } | null
  account: {
    name: string
  }
}

type TransactionRow = Transaction

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

const transactionTypesList: TransactionType[] = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND', 'INCOME', 'RENT']

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
  const router = useRouter()
  const [filter, setFilter] = useState<TransactionFilter>({})
  const [editingTransaction, setEditingTransaction] = useState<TransactionRow | null>(null)
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    date: string
    type: string
    quantity: string
    price: string
    notes: string
  } | null>(null)
  const [formErrors, setFormErrors] = useState<{
    quantity?: string
    price?: string
  }>({})

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filter),
    [transactions, filter]
  )

  // Handlers
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleEditClick = (tx: TransactionRow) => {
    setFormErrors({})
    setEditingTransaction(tx)
    setEditFormData({
      date: tx.date.split('T')[0], // converte ISO para YYYY-MM-DD
      type: tx.type,
      quantity: tx.quantity || '',
      price: tx.price || '',
      notes: tx.notes || '',
    })
  }

  const handleDeleteClick = (tx: TransactionRow) => {
    setDeletingTransaction(tx)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTransaction || !editFormData) return

    const nextErrors: { quantity?: string; price?: string } = {}
    if (editFormData.quantity && parseFloat(editFormData.quantity) < 0) {
      nextErrors.quantity = 'Quantidade não pode ser negativa.'
    }
    if (editFormData.price && parseFloat(editFormData.price) < 0) {
      nextErrors.price = 'Preço não pode ser negativo.'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)
    try {
      const result = await updateTransaction(editingTransaction.id, {
        date: new Date(editFormData.date),
        type: editFormData.type as TransactionType,
        quantity: editFormData.quantity ? parseFloat(editFormData.quantity) : undefined,
        price: editFormData.price ? parseFloat(editFormData.price) : undefined,
        notes: editFormData.notes || undefined,
      })

      if (result.success) {
        setEditingTransaction(null)
        setEditFormData(null)
        showToast('Transação atualizada com sucesso')
        router.refresh()
      } else {
        showToast(`Erro: ${result.error || 'Falha ao atualizar'}`)
      }
    } catch (error) {
      showToast(`Erro: ${error instanceof Error ? error.message : 'Falha ao atualizar'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTransaction) return

    setIsLoading(true)
    try {
      const result = await deleteTransaction(deletingTransaction.id)

      if (result.success) {
        setDeletingTransaction(null)
        showToast('Transação excluída')
        router.refresh()
      } else {
        showToast(`Erro: ${result.error || 'Falha ao excluir'}`)
      }
    } catch (error) {
      showToast(`Erro: ${error instanceof Error ? error.message : 'Falha ao excluir'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Movimentações</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredTransactions.length} de {transactions.length} movimentação(ões)
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-gray-500">
            <ArrowLeftRight size={16} />
            <span className="text-sm">Ledger</span>
          </div>
          <Link
            href="/transactions/new"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors sm:w-auto"
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
        <EmptyState
          icon="📋"
          title="Nenhuma transação encontrada"
          description="Tente ajustar os filtros ou adicione uma nova transação."
          action={{ label: 'Limpar filtros', onClick: () => setFilter({}) }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Ativo
                  </th>
                  <th className="text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Conta
                  </th>
                  <th className="text-right px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Qtd
                  </th>
                  <th className="text-right px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Preço
                  </th>
                  <th className="text-right px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="hidden sm:table-cell text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Referência
                  </th>
                  <th className="hidden sm:table-cell text-left px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Observações
                  </th>
                  <th className="text-center px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 sm:px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          typeColors[tx.type] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {typeLabels[tx.type] ?? tx.type}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 font-medium text-gray-900">
                      {tx.asset?.ticker ?? '—'}
                      {tx.asset?.name && (
                        <span className="block text-xs text-gray-400 font-normal">{tx.asset.name}</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-gray-600">{tx.account.name}</td>
                    <td className="px-2 sm:px-4 py-3 text-right text-gray-600">
                      {tx.quantity ? parseFloat(tx.quantity).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right text-gray-600">{formatCurrency(tx.price)}</td>
                    <td className="px-2 sm:px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-gray-500 max-w-40 truncate" title={tx.referenceId || '—'}>
                      {tx.referenceId || '—'}
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-gray-500 max-w-56 truncate" title={tx.notes || '—'}>
                      {tx.notes || '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(tx)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(tx)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-md">
          {toastMessage}
        </div>
      )}

      {/* Edit Modal */}
      <EditModal
        open={editingTransaction !== null && editFormData !== null}
        title="Editar Transação"
        onClose={() => {
          setEditingTransaction(null)
          setEditFormData(null)
        }}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              required
              value={editFormData?.date || ''}
              onChange={(e) =>
                setEditFormData((prev) => prev ? { ...prev, date: e.target.value } : null)
              }
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              required
              value={editFormData?.type || ''}
              onChange={(e) =>
                setEditFormData((prev) => prev ? { ...prev, type: e.target.value } : null)
              }
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Selecione um tipo</option>
              {transactionTypesList.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
              <input
                type="number"
                step="0.000001"
                value={editFormData?.quantity || ''}
                onChange={(e) =>
                  setEditFormData((prev) => prev ? { ...prev, quantity: e.target.value } : null)
                }
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 disabled:bg-gray-100 ${
                  formErrors.quantity ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {formErrors.quantity ? <p className="mt-1 text-sm text-red-600">{formErrors.quantity}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço Unitário</label>
              <input
                type="number"
                step="0.01"
                value={editFormData?.price || ''}
                onChange={(e) =>
                  setEditFormData((prev) => prev ? { ...prev, price: e.target.value } : null)
                }
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 disabled:bg-gray-100 ${
                  formErrors.price ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {formErrors.price ? <p className="mt-1 text-sm text-red-600">{formErrors.price}</p> : null}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={editFormData?.notes || ''}
              onChange={(e) =>
                setEditFormData((prev) => prev ? { ...prev, notes: e.target.value } : null)
              }
              disabled={isLoading}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setEditingTransaction(null)
                setEditFormData(null)
              }}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? <span className="inline-block animate-spin">⟳</span> : 'Salvar'}
            </button>
          </div>
        </form>
      </EditModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deletingTransaction !== null}
        title="Excluir Transação"
        description={
          deletingTransaction ? (
            `Tem certeza que deseja excluir a ${typeLabels[deletingTransaction.type] || deletingTransaction.type
              } de ${deletingTransaction.asset?.ticker || '—'} em ${formatDate(deletingTransaction.date)} no valor de ${formatCurrency(deletingTransaction.totalAmount)}?`
          ) : ''
        }
        variant="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        isLoading={isLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTransaction(null)}
      />
    </div>
  )
}
