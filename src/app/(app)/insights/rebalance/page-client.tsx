/**
 * Cliente para página de Rebalanceamento
 */

'use client'

import { useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
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

  const hasTargets = rebalanceResult.allocations.some((allocation) => allocation.targetPct !== null)
  const hasPositions = rebalanceResult.totalPortfolioValue.gt(0)

  const outOfTargetCount = rebalanceResult.allocations.filter((allocation) => allocation.status && allocation.status !== 'OK').length

  if (!hasPositions) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon="📈"
          title="Sem ativos para analisar"
          description="Adicione transações para ver sua análise de rebalanceamento."
        />
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 italic">
          ⚠️ Esta é uma análise automatizada, não uma recomendação de investimento.
        </div>
      </div>
    )
  }

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
                <span className="text-yellow-600">{outOfTargetCount} classes fora do alvo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {!hasTargets ? (
        <EmptyState
          icon="🎯"
          title="Configure sua alocação alvo"
          description="Defina o percentual ideal por classe de ativo para receber sugestões de rebalanceamento."
          action={{ label: 'Configurar agora', href: '/insights/rebalance/config' }}
        />
      ) : null}

      {/* Seção B: Tabela de alocação */}
      {rebalanceResult.allocations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Alocação por Classe</h2>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600">Classe</th>
                  <th className="px-2 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600">Valor Atual</th>
                  <th className="px-2 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600">% Atual</th>
                  {hasTargets && (
                    <>
                      <th className="px-2 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600" title="Percentual configurado em Configurar alocação alvo">Alvo %</th>
                      <th className="px-2 sm:px-6 py-3 text-right text-xs font-semibold text-gray-600" title="Diferença entre alocação atual e alvo. Status OK se dentro de ±5pp">Desvio</th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-2 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600">Sugestão</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rebalanceResult.allocations.map((alloc) => (
                  <tr key={alloc.assetClass} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-6 py-4 text-sm font-medium text-gray-900">{alloc.label}</td>
                    <td className="px-2 sm:px-6 py-4 text-sm text-right text-gray-900">
                      R$ {parseFloat(alloc.currentValue.toString()).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 sm:px-6 py-4 text-sm text-right text-gray-900">
                      {alloc.currentPct.toFixed(1)}%
                    </td>
                    {hasTargets && (
                      <>
                        <td className="px-2 sm:px-6 py-4 text-sm text-right text-gray-900">
                          {alloc.targetPct !== null ? `${alloc.targetPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-sm text-right">
                          {alloc.deviationPct !== null ? (
                            alloc.deviationPct.gt(0) ? (
                              <span className="font-semibold text-red-600">▲ {alloc.deviationPct.toFixed(1)}pp</span>
                            ) : alloc.deviationPct.lt(0) ? (
                              <span className="font-semibold text-amber-600">▼ {alloc.deviationPct.abs().toFixed(1)}pp</span>
                            ) : (
                              <span className="font-semibold text-green-600">✓ 0.0pp</span>
                            )
                          ) : '—'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-sm" title="Critério: status OK quando desvio está dentro de ±5pp.">
                          {alloc.status === 'OK' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              ✅ Balanceado
                            </span>
                          )}
                          {alloc.status === 'ACIMA' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              alloc.deviationPct && alloc.deviationPct.abs().gt(15)
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              ⬆️ Acima
                            </span>
                          )}
                          {alloc.status === 'ABAIXO' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              alloc.deviationPct && alloc.deviationPct.abs().gt(15)
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              ⬇️ Abaixo
                            </span>
                          )}
                          {alloc.status === null && <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-2 sm:px-6 py-4 text-sm text-gray-900">
                          {alloc.suggestionValue !== null ? (
                            <span className={`font-semibold ${alloc.suggestionValue.gt(0) ? 'text-green-600' : 'text-red-600'}`}>
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
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                      <p className="font-semibold text-red-900">{alert.title}</p>
                    </div>
                  </summary>
                  <p className="pl-7 text-sm text-red-800 mt-2 whitespace-pre-wrap">{alert.description}</p>
                </details>
              </div>
            ))}
            {alertsBySeverity.warning.map((alert) => (
              <div key={alert.id} className="p-4 bg-yellow-50 border-l-4 border-yellow-500">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
                      <p className="font-semibold text-yellow-900">{alert.title}</p>
                    </div>
                  </summary>
                  <p className="pl-7 text-sm text-yellow-800 mt-2 whitespace-pre-wrap">{alert.description}</p>
                </details>
              </div>
            ))}
            {alertsBySeverity.info.map((alert) => (
              <div key={alert.id} className="p-4 bg-blue-50 border-l-4 border-blue-500">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                      <p className="font-semibold text-blue-900">{alert.title}</p>
                    </div>
                  </summary>
                  <p className="pl-7 text-sm text-blue-800 mt-2 whitespace-pre-wrap">{alert.description}</p>
                </details>
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
