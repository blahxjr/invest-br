'use client'

import { useState } from 'react'
import { Edit2, Trash2, X } from 'lucide-react'
import type { AssetCategory } from '@prisma/client'

type AssetData = {
  id: string
  ticker: string | null
  name: string
  category: AssetCategory
  assetClassId: string
}

type AssetEditDialogProps = {
  asset: AssetData
  onUpdate: (asset: AssetData) => Promise<void>
  onDelete: (assetId: string) => Promise<void>
}

export function AssetEditDialog({ asset, onUpdate, onDelete }: AssetEditDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState(asset)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await onUpdate(data)
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover este ativo?')) return
    setIsLoading(true)
    try {
      await onDelete(asset.id)
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
        title="Editar ativo"
      >
        <Edit2 size={14} className="text-gray-500" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Editar Ativo</h3>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {asset.ticker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticker</label>
              <input
                type="text"
                value={data.ticker || ''}
                onChange={(e) => setData({ ...data, ticker: e.target.value })}
                disabled={true}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Ticker não pode ser alterado</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value as AssetCategory })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="STOCK">Ação</option>
              <option value="FII">FII</option>
              <option value="ETF">ETF</option>
              <option value="FIXED_INCOME">Renda Fixa</option>
              <option value="FUND">Fundo</option>
              <option value="CRYPTO">Cripto</option>
              <option value="METAL">Metal</option>
              <option value="REAL_ESTATE">Imóvel</option>
              <option value="CASH">Caixa</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 gap-2">
          <button
            onClick={handleDelete}
            disabled={isLoading}
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
