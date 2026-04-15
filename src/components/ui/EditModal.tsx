// @vitest-environment jsdom
'use client'

import { X } from 'lucide-react'
import { ReactNode } from 'react'

type EditModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Modal genérico para edição de entidades.
 * Envolve um formulário com suporte a save/cancel.
 */
export function EditModal({ open, title, onClose, children }: EditModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
