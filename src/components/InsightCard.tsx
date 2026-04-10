/**
 * Componente InsightCard — Exibe um insight individual com info de severidade, tipo e métricas
 */

import { Insight, InsightType } from '@/modules/insights/types'

interface InsightCardProps {
  insight: Insight
}

export function InsightCard({ insight }: InsightCardProps) {
  // Mapear cor de severidade
  const severityColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    critical: 'bg-red-50 border-red-200 text-red-900',
  }

  const severityBadgeColors = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  }

  // Mapear ícone por tipo de insight
  const typeIcons: Record<InsightType, string> = {
    [InsightType.CONCENTRACAO_ATIVO]: '📊',
    [InsightType.CONCENTRACAO_CLASSE]: '🏗️',
    [InsightType.CONCENTRACAO_MOEDA_PAIS]: '🌍',
    [InsightType.HORIZONTE_DESALINHADO]: '⏰',
  }

  return (
    <div className={`border rounded-lg p-4 ${severityColors[insight.severity]}`}>
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcons[insight.type]}</span>
          <div>
            <h3 className="font-semibold text-sm">{insight.title}</h3>
            <p className="text-xs opacity-75">{insight.type.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${severityBadgeColors[insight.severity]}`}>
          {insight.severity.toUpperCase()}
        </span>
      </div>

      {/* Descrição */}
      <p className="text-sm mb-3 leading-relaxed">{insight.message}</p>

      {/* Métricas */}
      <div className="bg-white bg-opacity-50 rounded p-2.5 mb-3 text-xs">
        <div className="flex justify-between items-center">
          <span>Percentual atual:</span>
          <strong>{(insight.metrics.currentPercentage * 100).toFixed(1)}%</strong>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span>Threshold:</span>
          <strong>{(insight.metrics.threshold * 100).toFixed(1)}%</strong>
        </div>
        <div className="flex justify-between items-center mt-1 text-red-600">
          <span>Acima do limite:</span>
          <strong>+{(insight.metrics.excessPercentage * 100).toFixed(1)}%</strong>
        </div>
      </div>

      {/* Ativos afetados */}
      {insight.affectedAssets.length > 0 && (
        <div className="bg-white bg-opacity-50 rounded p-2.5 text-xs">
          <h4 className="font-semibold mb-2">Ativos/Classes afetados:</h4>
          <ul className="space-y-1">
            {insight.affectedAssets.map((asset) => (
              <li key={asset.assetId} className="flex justify-between">
                <span>{asset.assetName}</span>
                <span className="font-medium">{(asset.percentage * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
