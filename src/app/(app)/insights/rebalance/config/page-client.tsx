/**
 * Cliente para formulário de Alocação Alvo
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle } from 'lucide-react'
import { saveAllocationTargets } from '../actions'
import { AssetClassForRebalance } from '@/modules/insights/rebalance-types'

type AllocationTarget = {
  assetClass: AssetClassForRebalance
  targetPct: number
}

type Props = {
  userId: string
  defaultTargets: AllocationTarget[]
}

const CLASS_LABELS: Record<AssetClassForRebalance, string> = {
  [AssetClassForRebalance.RENDA_FIXA]: 'Renda Fixa',
  [AssetClassForRebalance.ACOES]: 'Ações',
  [AssetClassForRebalance.FIIS]: 'Fundos Imobiliários',
  [AssetClassForRebalance.CRYPTO]: 'Criptoativos',
  [AssetClassForRebalance.EXTERIOR]: 'Exterior',
  [AssetClassForRebalance.OUTROS]: 'Outros',
}

export default function ConfigPageClient({ userId, defaultTargets }: Props) {
  const router = useRouter()
  const [targets, setTargets] = useState<AllocationTarget[]>(defaultTargets)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleTargetChange = useCallback((assetClass: AssetClassForRebalance, newPct: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.assetClass === assetClass ? { ...t, targetPct: newPct } : t))
    )
  }, [])

  const totalPct = targets.reduce((sum, t) => sum + t.targetPct, 0)
  const isValidSum = Math.abs(totalPct - 100) <= 0.01
  const isSumOk = isValidSum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isSumOk) {
      setErrorMessage(`Soma deve ser 100%. Atual: ${totalPct.toFixed(2)}%`)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const result = await saveAllocationTargets(userId, targets)

      if (result.success) {
        setSuccessMessage('Configuração salva com sucesso!')
        setTimeout(() => {
          router.push('/insights/rebalance')
        }, 1500)
      } else {
        setErrorMessage(result.error || 'Erro ao salvar')
      }
    } catch (err) {
      setErrorMessage('Erro na solicitação')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Card do formulário */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          {targets.map((target) => (
            <div key={target.assetClass} className="flex items-center gap-4">
              <label htmlFor={target.assetClass} className="w-48 text-sm font-medium text-gray-700">
                {CLASS_LABELS[target.assetClass]}
              </label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  id={target.assetClass}
                  min="0"
                  max="100"
                  step="0.1"
                  value={target.targetPct}
                  onChange={(e) => handleTargetChange(target.assetClass, parseFloat(e.target.value) || 0)}
                  disabled={isLoading}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <span className="text-sm text-gray-600 w-8">%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Linha de total */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex items-center gap-4">
          <label className="w-48 text-sm font-semibold text-gray-900">Total</label>
          <div className="flex-1 flex items-center gap-2">
            <div
              className={`w-24 px-3 py-2 text-sm font-semibold rounded-lg ${
                isSumOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {totalPct.toFixed(2)}%
            </div>
            {isSumOk ? (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Check size={16} /> Correto
              </span>
            ) : (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={16} /> Deve ser 100%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mensagens */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 flex items-start gap-2">
          <Check size={18} className="flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!isSumOk || isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block animate-spin">⟳</span>
              Salvando...
            </>
          ) : (
            <>
              <Check size={18} />
              Salvar Configuração
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
