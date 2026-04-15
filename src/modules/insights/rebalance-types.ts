/**
 * Tipos para módulo de Rebalanceamento
 * 
 * Análise de alocação alvo vs alocação atual, com sugestões de rebalanceamento
 */

import type { Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

/**
 * Enumeração de classes de ativos para rebalanceamento
 */
export enum AssetClassForRebalance {
  RENDA_FIXA = 'RENDA_FIXA',
  ACOES = 'ACOES',
  FIIS = 'FIIS',
  CRYPTO = 'CRYPTO',
  EXTERIOR = 'EXTERIOR',
  OUTROS = 'OUTROS',
}

/**
 * Status de uma alocação (OK, acima ou abaixo do alvo)
 */
export type AllocationStatus = 'OK' | 'ACIMA' | 'ABAIXO'

/**
 * Alocação de uma classe de ativo
 */
export type AssetClassAllocation = {
  /** Código da classe (ex: 'RENDA_FIXA') */
  assetClass: AssetClassForRebalance
  
  /** Label em português (ex: 'Renda Fixa') */
  label: string
  
  /** Valor atual consolidado dessa classe */
  currentValue: Decimal
  
  /** Percentual atual sobre total da carteira */
  currentPct: Decimal
  
  /** Percentual alvo configurado pelo usuário (null se sem configuração) */
  targetPct: Decimal | null
  
  /** Desvio: currentPct - targetPct (null se sem targetPct) */
  deviationPct: Decimal | null
  
  /** Status: OK se |desvio| <= 5%, ACIMA se > +5%, ABAIXO se < -5% */
  status: 'OK' | 'ACIMA' | 'ABAIXO' | null
  
  /**
   * Valor sugerido para aportar (+) ou reduzir (-) para rebalancear
   * null se sem targetPct configurado ou já OK
   */
  suggestionValue: Decimal | null
  
  /** Label legível para sugestão (ex: "Aportar R$ 500", "Reduzir R$ 300", "Balanceado") */
  suggestionLabel: string
}

/**
 * Resultado completo da análise de rebalanceamento
 */
export type RebalanceResult = {
  /** Valor total consolidado da carteira */
  totalPortfolioValue: Decimal
  
  /** Alocações por classe de ativo */
  allocations: AssetClassAllocation[]
  
  /** True se todas as alocações estão OK */
  isBalanced: boolean
  
  /** Data/hora do cálculo */
  lastUpdated: Date
}

/**
 * Alerta do sistema de rebalanceamento
 */
export type Alert = {
  /** ID único do alerta */
  id: string
  
  /** Tipo de alerta */
  type: 'CONCENTRACAO' | 'CONCENTRACAO_CLASSE' | 'REBALANCEAMENTO'
  
  /** Severidade do alerta */
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  
  /** Título do alerta */
  title: string
  
  /** Descrição detalhada */
  description: string
  
  /** ID do ativo afetado (opcional) */
  affectedAsset?: string
  
  /** Valor relacionado (opcional) */
  value?: Decimal
}

/**
 * Resultado da API de rebalanceamento
 */
export type RebalanceApiResponse = {
  rebalance: RebalanceResult
  alerts: Alert[]
  disclaimer: string
}
