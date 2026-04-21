'use client'

import { useState } from 'react'
import { Edit2, Trash2, X } from 'lucide-react'

type AssetClassData = {
  id: string
  name: string
  description: string | null
  assetCount: number
}

type AssetClassEditDialogProps = {
  assetClass: AssetClassData
  onUpdate: (data: { id: string; name: string; description: string | null }) => Promise<void>
  onDelete: (classId: string) => Promise<void>
}

export function AssetClassEditDialog({
  assetClass,
  onUpdate,
  onDelete,
}: AssetClassEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(assetClass.name)
  const [description, setDescription] = useState(assetClass.description ?? '')

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      alert('Nome da classe é obrigatório')
      return
    }

    setIsLoading(true)
    try {
      await onUpdate({
        id: assetClass.id,
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
      })
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (assetClass.assetCount > 0) {
      alert('Não é possível remover uma classe que possui ativos associados.')
      return
    }

    if (!confirm('Tem certeza que deseja remover esta classe de ativo?')) {
      return
    }

    setIsLoading(true)
    try {
      await onDelete(assetClass.id)
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-1 hover:bg-gray-200 rounded transition-colors"
        title="Editar classe"
      >
        <Edit2 size={14} className="text-gray-500" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar Classe</h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <p className="text-xs text-gray-500">Ativos vinculados: {assetClass.assetCount}</p>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 gap-2">
          <button
            onClick={handleDelete}
            disabled={isLoading || assetClass.assetCount > 0}
            className="flex items-center gap-1 text-red-600 hover:text-red-700 px-3 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            <Trash2 size={16} />
            Remover
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
