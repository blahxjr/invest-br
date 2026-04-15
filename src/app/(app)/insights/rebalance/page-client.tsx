/**
 * Cliente para página de Rebalanceamento
 */

'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import type { RebalanceResult, Alert } from '@/modules/insights/rebalance-types'

type Props = {
  rebalanceResult: RebalanceResult
  alerts: Alert[]
}

export default function RebalancePageClient({ rebalanceResult, alerts }: Props) {
  const alertsBySeverity = useMemo(() => {
    return {
      critical: alerts.filter((a) => a.severity === 'CRITICAL'),
      warning: alerts.filter((a) => a.severity === 'WARNING'),
      info: alerts.filter((a) => a.severity === 'INFO'),
    }
  }, [alerts])

  const hasAlertTargets = rebalanceResult.allocations.some((a) => a.targetPct !== null)

  return (
    <div className="space-y-6">
      {/* Seção A: Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total da Carteira */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total da Carteira</h3>
          <p className="text-3xl font-bold text-gray-900">
            R$ {parseFloat(rebalanceResult.totalPortfolioValue.toString()).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Card 2: Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Status</h3>
          <div className="flex items-center gap-2 text-lg font-bold">
            {rebalanceResult.isBalanced ? (
              <>
                <CheckCircle size={20} className="text-green-600" />
                <span className="text-green-600">Carteira Balanceada</span>
              </>
            ) : (
              <>
                <AlertTriangle size={20} className="text-yellow-600" />
                <span className="text-yellow-600">Fora do Alvo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Seção B: Tabela de alocação */}
      {rebalanceResult.allocations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Alocação por Classe</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Classe</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Valor Atual</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">% Atual</th>
                  {hasAlertTargets && (
                    <>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">% Alvo</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Desvio</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Sugestão</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rebalanceResult.allocations.map((alloc) => (
                  <tr key={alloc.assetClass} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{alloc.label}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      R$ {parseFloat(alloc.currentValue.toString()).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {alloc.currentPct.toFixed(1)}%
                    </td>
                    {hasAlertTargets && (
                      <>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          {alloc.targetPct !== null ? `${alloc.targetPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          {alloc.deviationPct !== null
                            ? `${alloc.deviationPct.toFixed(1)}pp`
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {alloc.status === 'OK' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              <CheckCircle size={14} /> OK
                            </span>
                          )}
                          {alloc.status === 'ACIMA' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              <TrendingUp size={14} /> Acima
                            </span>
                          )}
                          {alloc.status === 'ABAIXO' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                              <TrendingDown size={14} /> Abaixo
                            </span>
                          )}
                          {alloc.status === null && <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {alloc.suggestionValue !== null ? (
                            <span className={alloc.suggestionValue.gt(0) ? 'text-green-600' : 'text-red-600'}>
                              {alloc.suggestionLabel}
                            </span>
                          ) : (
                            <span className="text-gray-500">{alloc.suggestionLabel}</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seção C: Alertas */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={20} />
              Alertas ({alerts.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {alertsBySeverity.critical.map((alert) => (
              <div key={alert.id} className="p-4 bg-red-50 border-l-4 border-red-500">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-red-900">{alert.title}</p>
                    <p className="text-sm text-red-800 mt-1 whitespace-pre-wrap">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {alertsBySeverity.warning.map((alert) => (
              <div key={alert.id} className="p-4 bg-yellow-50 border-l-4 border-yellow-500">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-yellow-900">{alert.title}</p>
                    <p className="text-sm text-yellow-800 mt-1 whitespace-pre-wrap">{alert.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Sem alertas */}
      {alerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-start gap-2">
          <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Nenhum alerta</p>
            <p className="text-sm mt-1">Sua carteira está em boa situação!</p>
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 italic">
        ⚠️ Essa análise é informativa e não constitui recomendação de investimento.
      </div>
    </div>
  )
}
