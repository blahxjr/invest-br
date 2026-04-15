/**
 * Serviço de Alertas Automáticos
 * 
 * Gera alertas baseados em análise de concentração, rebalanceamento, etc.
 */

import { v4 as uuidv4 } from 'uuid'
import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getPositions } from '@/modules/positions/service'
import { getQuotes } from '@/lib/quotes'
import { enrichWithQuotes } from '@/modules/positions/types'
import { calculateRebalance } from './rebalance-service'
import type { Alert, RebalanceResult } from './rebalance-types'

const DISCLAIMER = '⚠️ Esta é uma análise automatizada, não uma recomendação de investimento.'

/**
 * Gera alertas para um usuário
 * 
 * @param userId ID do usuário
 * @returns Array de alertas relevantes
 */
export async function generateAlerts(userId: string): Promise<Alert[]> {
  const alerts: Alert[] = []

  // 1. Buscar posições e enriquecer com cotações
  const positions = await getPositions(userId)
  const quotes = await getQuotes(positions.map((position) => position.ticker))
  const allPositions = enrichWithQuotes(positions, quotes)

  if (allPositions.length === 0) {
    return []
  }

  // 2. Calcular total da carteira
  const totalPortfolioValue = allPositions.reduce(
    (sum, pos) => sum.plus(pos.currentValue ?? pos.totalCost ?? new Decimal(0)),
    new Decimal(0)
  )

  if (totalPortfolioValue.lte(0)) {
    return []
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ALERTA 1: CONCENTRACAO (ativo único > 20% é WARNING, > 35% é CRITICAL)
  // ────────────────────────────────────────────────────────────────────────────
  
  for (const pos of allPositions) {
    const positionValue = pos.currentValue ?? pos.totalCost ?? new Decimal(0)
    const positionPct = positionValue.div(totalPortfolioValue).times(100)

    if (positionPct.gt(35)) {
      alerts.push({
        id: uuidv4(),
        type: 'CONCENTRACAO',
        severity: 'CRITICAL',
        title: `Concentração Crítica em ${pos.ticker}`,
        description: `${pos.ticker} representa ${positionPct.toFixed(1)}% da carteira. Considere diversificar para reduzir risco. ${DISCLAIMER}`,
        affectedAsset: pos.ticker,
        value: positionPct,
      })
    } else if (positionPct.gt(20)) {
      alerts.push({
        id: uuidv4(),
        type: 'CONCENTRACAO',
        severity: 'WARNING',
        title: `Concentração em ${pos.ticker}`,
        description: `${pos.ticker} representa ${positionPct.toFixed(1)}% da carteira. Acima do nível recomendado (20%). ${DISCLAIMER}`,
        affectedAsset: pos.ticker,
        value: positionPct,
      })
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ALERTA 2: CONCENTRACAO_CLASSE (classe > 70% é WARNING)
  // ────────────────────────────────────────────────────────────────────────────

  const classMap = new Map<string, Decimal>()
  const classLabelMap = new Map<string, string>()

  for (const pos of allPositions) {
    const classCode = pos.assetClassCode
    const currentValue = classMap.get(classCode) ?? new Decimal(0)
    classMap.set(classCode, currentValue.plus(pos.currentValue ?? pos.totalCost ?? new Decimal(0)))

    if (!classLabelMap.has(classCode)) {
      classLabelMap.set(classCode, classCode) // Usar código como fallback
    }
  }

  for (const [classCode, classValue] of classMap) {
    const classPct = classValue.div(totalPortfolioValue).times(100)

    if (classPct.gt(70)) {
      const classLabel = classLabelMap.get(classCode) ?? classCode
      alerts.push({
        id: uuidv4(),
        type: 'CONCENTRACAO_CLASSE',
        severity: 'WARNING',
        title: `Concentração em ${classLabel}`,
        description: `${classLabel} representa ${classPct.toFixed(1)}% da carteira. Carteira pouco diversificada. ${DISCLAIMER}`,
        value: classPct,
      })
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ALERTA 3: REBALANCEAMENTO (se desbalanceado e tem alvo configurado)
  // ────────────────────────────────────────────────────────────────────────────

  const rebalanceResult = await calculateRebalance(userId)

  if (!rebalanceResult.isBalanced) {
    // Verificar se tem algum alvo configurado
    const hasTargets = await prisma.allocationTarget.count({
      where: { userId },
    })

    if (hasTargets > 0) {
      const deviations = rebalanceResult.allocations
        .filter((a) => a.status === 'ACIMA' || a.status === 'ABAIXO')
        .map((a) => {
          const prefix = a.status === 'ACIMA' ? '↑' : '↓'
          return `${prefix} ${a.label}: ${Math.abs(parseFloat(a.deviationPct?.toFixed(1) ?? '0'))}pp`
        })

      alerts.push({
        id: uuidv4(),
        type: 'REBALANCEAMENTO',
        severity: 'WARNING',
        title: 'Carteira desbalanceada',
        description: `Alocação fora do alvo:\n${deviations.join('\n')}\n\nConsidere rebalancear. ${DISCLAIMER}`,
      })
    }
  }

  return alerts
}
