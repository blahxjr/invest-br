// @vitest-environment jsdom
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { IncomeType } from '@prisma/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EditModal } from '@/components/ui/EditModal'
import { EmptyState } from '@/components/ui/EmptyState'
import { updateIncomeEvent, deleteIncomeEvent } from '../transactions/actions'

type IncomeEvent = {
  id: string
  type: string
  paymentDate: Date | string
  grossAmount: { toString(): string }
  taxAmount: { toString(): string } | null
  netAmount: { toString(): string }
  asset?: {
    ticker: string | null
  } | null
  account: {
    name: string
  }
  notes?: string | null
}

type IncomeEventRow = IncomeEvent

type Props = {
  incomeEvents: IncomeEvent[]
  typeLabels: Record<string, string>
}

const incomeTypesList = ['DIVIDEND', 'JCP', 'FII_RENT', 'COUPON', 'RENTAL']

function formatCurrency(value: { toString(): string } | string | null) {
  if (!value) return '—'
  const strValue = typeof value === 'string' ? value : value.toString()
  return parseFloat(strValue).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(dateValue: Date | string) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function IncomePageClient({ incomeEvents, typeLabels }: Props) {
  const router = useRouter()
  const [editingEvent, setEditingEvent] = useState<IncomeEventRow | null>(null)
  const [deletingEvent, setDeletingEvent] = useState<IncomeEventRow | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<{
    paymentDate: string
    type: string
    grossAmount: string
    taxAmount: string
    netAmount: string
    notes: string
  } | null>(null)
  const [formErrors, setFormErrors] = useState<{
    grossAmount?: string
    taxAmount?: string
    netAmount?: string
  }>({})

  // Handlers
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleEditClick = (event: IncomeEventRow) => {
    setFormErrors({})
    setEditingEvent(event)
    const paymentDateValue = typeof event.paymentDate === 'string'
      ? event.paymentDate.split('T')[0]
      : event.paymentDate.toISOString().split('T')[0]
    setEditFormData({
      paymentDate: paymentDateValue,
      type: event.type,
      grossAmount: event.grossAmount.toString(),
      taxAmount: event.taxAmount?.toString() || '',
      netAmount: event.netAmount.toString(),
      notes: event.notes || '',
    })
  }

  const handleDeleteClick = (event: IncomeEventRow) => {
    setDeletingEvent(event)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent || !editFormData) return

    const nextErrors: { grossAmount?: string; taxAmount?: string; netAmount?: string } = {}
    if (parseFloat(editFormData.grossAmount) < 0) {
      nextErrors.grossAmount = 'Valor bruto não pode ser negativo.'
    }
    if (editFormData.taxAmount && parseFloat(editFormData.taxAmount) < 0) {
      nextErrors.taxAmount = 'IR não pode ser negativo.'
    }
    if (parseFloat(editFormData.netAmount) < 0) {
      nextErrors.netAmount = 'Valor líquido não pode ser negativo.'
    }
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)
    try {
      const result = await updateIncomeEvent(editingEvent.id, {
        paymentDate: new Date(editFormData.paymentDate),
        type: editFormData.type as IncomeType,
        grossAmount: parseFloat(editFormData.grossAmount),
        taxAmount: editFormData.taxAmount ? parseFloat(editFormData.taxAmount) : null,
        netAmount: parseFloat(editFormData.netAmount),
        notes: editFormData.notes || undefined,
      })

      if (result.success) {
        setEditingEvent(null)
        setEditFormData(null)
        showToast('Provento atualizado com sucesso')
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
    if (!deletingEvent) return

    setIsLoading(true)
    try {
      const result = await deleteIncomeEvent(deletingEvent.id)

      if (result.success) {
        setDeletingEvent(null)
        showToast('Provento excluído')
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Proventos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {incomeEvents.length} provento(s) registrado(s)
          </p>
        </div>
        <Link
          href="/income/new"
          className="flex w-full sm:w-auto items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Novo Provento
        </Link>
      </div>

      {incomeEvents.length === 0 ? (
        <EmptyState
          icon="💰"
          title="Nenhum provento registrado"
          description="Registre dividendos, JCP ou rendimentos recebidos."
          action={{ label: 'Adicionar provento', onClick: () => router.push('/income/new') }}
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
                    Bruto
                  </th>
                  <th className="text-right px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    IR
                  </th>
                  <th className="text-right px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    Líquido
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
                {incomeEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 sm:px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(event.paymentDate)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-gray-700 font-medium">
                      {typeLabels[event.type] ?? event.type}
                    </td>
                    <td className="px-2 sm:px-4 py-3 font-medium text-gray-900">
                      {event.asset?.ticker ?? '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-gray-600">{event.account.name}</td>
                    <td className="px-2 sm:px-4 py-3 text-right text-gray-700">
                      {formatCurrency(event.grossAmount)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right text-gray-600">
                      {formatCurrency(event.taxAmount)}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right font-semibold text-green-700">
                      {formatCurrency(event.netAmount)}
                    </td>
                    <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-gray-500 max-w-56 truncate" title={event.notes || '—'}>
                      {event.notes || '—'}
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(event)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(event)}
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
        open={editingEvent !== null && editFormData !== null}
        title="Editar Provento"
        onClose={() => {
          setEditingEvent(null)
          setEditFormData(null)
        }}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              required
              value={editFormData?.paymentDate || ''}
              onChange={(e) =>
                setEditFormData((prev) => prev ? { ...prev, paymentDate: e.target.value } : null)
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
              {incomeTypesList.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bruto (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={editFormData?.grossAmount || ''}
                onChange={(e) =>
                  setEditFormData((prev) => prev ? { ...prev, grossAmount: e.target.value } : null)
                }
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 disabled:bg-gray-100 ${
                  formErrors.grossAmount ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {formErrors.grossAmount ? <p className="mt-1 text-sm text-red-600">{formErrors.grossAmount}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IR (R$)</label>
              <input
                type="number"
                step="0.01"
                value={editFormData?.taxAmount || ''}
                onChange={(e) =>
                  setEditFormData((prev) => prev ? { ...prev, taxAmount: e.target.value } : null)
                }
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 disabled:bg-gray-100 ${
                  formErrors.taxAmount ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {formErrors.taxAmount ? <p className="mt-1 text-sm text-red-600">{formErrors.taxAmount}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Líquido (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={editFormData?.netAmount || ''}
                onChange={(e) =>
                  setEditFormData((prev) => prev ? { ...prev, netAmount: e.target.value } : null)
                }
                disabled={isLoading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 disabled:bg-gray-100 ${
                  formErrors.netAmount ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {formErrors.netAmount ? <p className="mt-1 text-sm text-red-600">{formErrors.netAmount}</p> : null}
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
                setEditingEvent(null)
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
        open={deletingEvent !== null}
        title="Excluir Provento"
        description={
          deletingEvent
            ? `Tem certeza que deseja excluir o ${typeLabels[deletingEvent.type] || deletingEvent.type
            } de ${deletingEvent.asset?.ticker || '—'} em ${formatDate(deletingEvent.paymentDate)} no valor de ${formatCurrency(deletingEvent.netAmount)}?`
            : ''
        }
        variant="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        isLoading={isLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingEvent(null)}
      />
    </div>
  )
}
