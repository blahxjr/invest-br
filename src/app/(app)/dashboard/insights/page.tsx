/**
 * Página de Insights do Dashboard
 *
 * Exibe insights de rebalanceamento e concentração para o cliente
 */

'use client'

import { useEffect, useState } from 'react'
import { InsightsList } from '@/components/InsightsList'
import { Insight } from '@/modules/insights/types'
import { getInsightsAction } from './actions'

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadInsights() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getInsightsAction()

        if (result.success && result.data) {
          setInsights(result.data)
        } else {
          setError(result.error || 'Erro ao carregar insights')
        }
      } catch (err) {
        setError('Erro ao processar solicitação')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInsights()
  }, [])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Insights de Rebalanceamento</h1>
        <p className="text-gray-600 mt-2">
          Análise automática da sua carteira para detectar concentração e desalinhamentos
        </p>
      </div>

      {/* Card de atualização/informação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900">ℹ️ Análise V1</h2>
        <p className="text-sm text-blue-800 mt-1">
          Insights calculados em tempo real com base nas suas transações. Thresholds: 25% (ativo), 50% (classe), 70% (moeda/país).
        </p>
      </div>

      {/* Lista de insights */}
      <InsightsList insights={insights} isLoading={isLoading} error={error} />
    </div>
  )
}
