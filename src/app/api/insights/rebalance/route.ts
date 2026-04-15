/**
 * API endpoint para análise de rebalanceamento
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { calculateRebalance } from '@/modules/insights/rebalance-service'
import { generateAlerts } from '@/modules/insights/alerts-service'

const DISCLAIMER = 'Esta análise é informativa e não constitui recomendação de investimento.'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const [rebalance, alerts] = await Promise.all([
      calculateRebalance(session.user.id),
      generateAlerts(session.user.id),
    ])

    return NextResponse.json({
      rebalance: {
        totalPortfolioValue: rebalance.totalPortfolioValue.toString(),
        allocations: rebalance.allocations.map((allocation) => ({
          assetClass: allocation.assetClass,
          label: allocation.label,
          currentValue: allocation.currentValue.toString(),
          currentPct: allocation.currentPct.toString(),
          targetPct: allocation.targetPct?.toString() ?? null,
          deviationPct: allocation.deviationPct?.toString() ?? null,
          status: allocation.status,
          suggestionValue: allocation.suggestionValue?.toString() ?? null,
          suggestionLabel: allocation.suggestionLabel,
        })),
        isBalanced: rebalance.isBalanced,
        lastUpdated: rebalance.lastUpdated.toISOString(),
      },
      alerts: alerts.map((alert) => ({
        ...alert,
        value: alert.value?.toString(),
      })),
      disclaimer: DISCLAIMER,
    })
  } catch (error) {
    console.error('Erro ao obter análise de rebalanceamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
