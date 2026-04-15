/**
 * Serviço de Rebalanceamento de Carteira
 * 
 * Calcula alocação atual vs alvo, gera sugestões de rebalanceamento
 */

import Decimal from 'decimal.js'
import { prisma } from '@/lib/prisma'
import { getPositions } from '@/modules/positions/service'
import { getQuotes } from '@/lib/quotes'
import { enrichWithQuotes } from '@/modules/positions/types'
import type {
  RebalanceResult,
  AssetClassAllocation,
  AssetClassForRebalance,
} from './rebalance-types'
import { AssetClassForRebalance as AssetClassEnum } from './rebalance-types'

/**
 * Mapeia AssetCategory para AssetClassForRebalance
 */
function mapCategoryToRebalanceClass(category: string): AssetClassForRebalance {
  switch (category) {
    case 'FIXED_INCOME':
      return AssetClassEnum.RENDA_FIXA
    case 'STOCK':
    case 'BDR':
      return AssetClassEnum.ACOES
    case 'FII':
      return AssetClassEnum.FIIS
    case 'CRYPTO':
      return AssetClassEnum.CRYPTO
    case 'FUND':
      return AssetClassEnum.EXTERIOR
    default:
      return AssetClassEnum.OUTROS
  }
}

/**
 * Label em português para cada classe de rebalanceamento
 */
function getClassLabel(assetClass: AssetClassForRebalance): string {
  switch (assetClass) {
    case AssetClassEnum.RENDA_FIXA:
      return 'Renda Fixa'
    case AssetClassEnum.ACOES:
      return 'Ações'
    case AssetClassEnum.FIIS:
      return 'Fundos Imobiliários'
    case AssetClassEnum.CRYPTO:
      return 'Criptoativos'
    case AssetClassEnum.EXTERIOR:
      return 'Exterior'
    case AssetClassEnum.OUTROS:
      return 'Outros'
    default:
      return assetClass
  }
}

/**
 * Calcula a alocação de rebalanceamento para um usuário
 * 
 * @param userId ID do usuário
 * @returns RebalanceResult com alocações calculadas e sugestões
 */
export async function calculateRebalance(userId: string): Promise<RebalanceResult> {
  // 1. Buscar posições e enriquecer com cotações
  const positions = await getPositions(userId)
  const quotes = await getQuotes(positions.map((position) => position.ticker))
  const allPositions = enrichWithQuotes(positions, quotes)

  // Se não há posições, retornar vazio
  if (allPositions.length === 0) {
    return {
      totalPortfolioValue: new Decimal(0),
      allocations: [],
      isBalanced: true,
      lastUpdated: new Date(),
    }
  }

  // 4. Calcular total da carteira
  const totalPortfolioValue = allPositions.reduce(
    (sum, pos) => sum.plus(pos.currentValue ?? pos.totalCost ?? new Decimal(0)),
    new Decimal(0)
  )

  if (totalPortfolioValue.lte(0)) {
    return {
      totalPortfolioValue,
      allocations: [],
      isBalanced: true,
      lastUpdated: new Date(),
    }
  }

  // 5. Agrupar posições por classe de rebalanceamento e calcular totais
  const classMap = new Map<AssetClassForRebalance, Decimal>()

  for (const pos of allPositions) {
    const rebalanceClass = mapCategoryToRebalanceClass(pos.category)
    const currentValue = classMap.get(rebalanceClass) ?? new Decimal(0)
    classMap.set(rebalanceClass, currentValue.plus(pos.currentValue ?? pos.totalCost ?? new Decimal(0)))
  }

  // 6. Buscar configuração de alocação alvo
  const allocationTargets = await prisma.allocationTarget.findMany({
    where: { userId },
  })

  const targetMap = new Map<AssetClassForRebalance, Decimal>()
  for (const target of allocationTargets) {
    targetMap.set(target.assetClass as AssetClassForRebalance, new Decimal(target.targetPct.toString()))
  }

  // 7. Calcular alocações e status
  const allocations: AssetClassAllocation[] = []
  let isBalanced = true

  // Incluir todas as classes de rebalanceamento
  const allClasses = Object.values(AssetClassEnum)

  for (const assetClass of allClasses) {
    const currentValue = classMap.get(assetClass) ?? new Decimal(0)
    const currentPct = currentValue.isZero()
      ? new Decimal(0)
      : currentValue.div(totalPortfolioValue).times(100)

    const targetPct = targetMap.get(assetClass) ?? null
    let deviationPct: Decimal | null = null
    let status: 'OK' | 'ACIMA' | 'ABAIXO' | null = null
    let suggestionValue: Decimal | null = null
    let suggestionLabel = 'Sem sugestão'

    if (targetPct !== null) {
      deviationPct = currentPct.minus(targetPct)
      const absDev = deviationPct.abs()

      if (absDev.lte(5)) {
        status = 'OK'
      } else if (deviationPct.gt(5)) {
        status = 'ACIMA'
        isBalanced = false
        // Valor a reduzir
        suggestionValue = deviationPct.div(100).times(totalPortfolioValue).negated()
        suggestionLabel = `Reduzir R$ ${Math.abs(parseFloat(suggestionValue.toFixed(2))).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      } else if (deviationPct.lt(-5)) {
        status = 'ABAIXO'
        isBalanced = false
        // Valor a aportar
        suggestionValue = deviationPct.negated().div(100).times(totalPortfolioValue)
        suggestionLabel = `Aportar R$ ${parseFloat(suggestionValue.toFixed(2)).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      }
    } else if (currentValue.gt(0)) {
      // Sem target, apenas exibir alocação atual
      suggestionLabel = 'Sem alvo configurado'
    }

    if (status === 'OK') {
      suggestionLabel = 'Balanceado'
    }

    allocations.push({
      assetClass,
      label: getClassLabel(assetClass),
      currentValue,
      currentPct,
      targetPct,
      deviationPct,
      status,
      suggestionValue,
      suggestionLabel,
    })
  }

  return {
    totalPortfolioValue,
    allocations: allocations.filter((a) => a.currentValue.gt(0) || a.targetPct !== null),
    isBalanced,
    lastUpdated: new Date(),
  }
}
