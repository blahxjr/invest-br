/**
 * Componente InsightsList — Exibe lista de insights com filtros
 */

'use client'

import { Insight, InsightType } from '@/modules/insights/types'
import { InsightCard } from './InsightCard'
import { useState } from 'react'

interface InsightsListProps {
  insights: Insight[]
  isLoading?: boolean
  error?: string | null
}

export function InsightsList({ insights, isLoading = false, error = null }: InsightsListProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Filtrar insights por severidade e tipo
  const filteredInsights = insights.filter((insight) => {
    const severityMatch = selectedSeverity === 'all' || insight.severity === selectedSeverity
    const typeMatch = selectedType === 'all' || insight.type === selectedType
    return severityMatch && typeMatch
  })

  // Buscar tipos únicos nos insights
  const availableTypes = Array.from(new Set(insights.map((i) => i.type)))

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Carregando insights...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Erro ao carregar insights: {error}</div>
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum insight detectado. Sua carteira está bem balanceada! 🎉
      </div>
    )
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-6 flex gap-4 flex-wrap">
        {/* Filtro de severidade */}
        <div>
          <label className="text-sm font-medium text-gray-700">Severidade:</label>
          <div className="flex gap-2 mt-2">
            {['all', 'info', 'warning', 'critical'].map((severity) => (
              <button
                key={severity}
                onClick={() => setSelectedSeverity(severity)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  selectedSeverity === severity
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {severity === 'all' ? 'Todas' : severity.charAt(0).toUpperCase() + severity.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de tipo */}
        <div>
          <label className="text-sm font-medium text-gray-700">Tipo:</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                selectedType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todos
            </button>
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded text-sm font-medium transition whitespace-nowrap ${
                  selectedType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contador */}
      <p className="text-sm text-gray-600 mb-4">
        {filteredInsights.length} de {insights.length} insight(s)
      </p>

      {/* Lista de insights */}
      <div className="grid gap-4">
        {filteredInsights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
