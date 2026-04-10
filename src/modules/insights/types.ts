/**
 * Tipos do módulo Insights/Rebalanceamento (V1 — on-the-fly, sem persistência)
 *
 * Este módulo detecta anomalias em carteiras do cliente:
 * - Concentração excessiva (ativo, classe, moeda/país)
 * - Desalinhamento entre horizonte do ativo e objetivo da carteira
 *
 * Versão: V1 (on-the-fly, sem tabela Insight persistida)
 * Referência: docs/modules/insights.md, DEC-015
 */

import type { Prisma } from '@prisma/client'

type Decimal = Prisma.Decimal

/**
 * Enum dos tipos de insight detectáveis.
 *
 * Cada tipo mapeia a uma anomalia específica com threshold fixo (DEC-015).
 */
export enum InsightType {
  /** Um ativo representa > 25% do patrimônio do cliente/carteira */
  CONCENTRACAO_ATIVO = 'CONCENTRACAO_ATIVO',

  /** Uma classe de ativo representa > 50% do patrimônio */
  CONCENTRACAO_CLASSE = 'CONCENTRACAO_CLASSE',

  /** Uma moeda ou país representa > 70% do patrimônio */
  CONCENTRACAO_MOEDA_PAIS = 'CONCENTRACAO_MOEDA_PAIS',

  /** Um ativo com horizonte recomendado SHORT/MEDIUM está em carteira com objetivo LONG (discrepância > 30%) */
  HORIZONTE_DESALINHADO = 'HORIZONTE_DESALINHADO',
}

/**
 * Escopo de perfil de configuração.
 */
export type InsightProfileScope = 'GLOBAL' | 'USER' | 'CLIENT' | 'PORTFOLIO'

/**
 * Severidade configurável na regra.
 */
export type InsightSeverity = 'info' | 'warning' | 'critical'

/**
 * Códigos de insight suportados no catálogo (persistência).
 */
export const INSIGHT_TYPE_CODES = {
  [InsightType.CONCENTRACAO_ATIVO]: 'CONCENTRACAO_ATIVO',
  [InsightType.CONCENTRACAO_CLASSE]: 'CONCENTRACAO_CLASSE',
  [InsightType.CONCENTRACAO_MOEDA_PAIS]: 'CONCENTRACAO_MOEDA_PAIS',
  [InsightType.HORIZONTE_DESALINHADO]: 'HORIZONTE_DESALINHADO',
} as const

/**
 * Entrada para obter insights de um cliente ou carteira.
 */
export type GetInsightsInput = {
  /** ID obrigatório do cliente */
  clientId: string

  /** ID opcional da carteira (se omitido, agrega todas as carteiras do cliente) */
  portfolioId?: string | null

  /** Data de cálculo (default: today) */
  date?: Date | null
}

/**
 * Posição consolidada (virtual) de um ativo em uma carteira.
 *
 * Agregada on-the-fly a partir de todas as Transaction do cliente/carteira.
 */
export type ConsolidatedPosition = {
  /** ID do ativo */
  assetId: string

  /** Nome do ativo */
  assetName: string

  /** Ticker do ativo (opcional) */
  ticker?: string | null

  /** ID da classe de ativo */
  assetClassId: string

  /** Nome da classe de ativo */
  assetClassName: string

  /** Quantidade total do ativo (BUY - SELL) */
  quantity: Decimal

  /** Preço médio ponderado das transações */
  avgCost: Decimal

  /** Valor total do ativo (quantidade × avgCost) */
  totalCost: Decimal

  /** Moeda do ativo (de Asset.currency, default BRL) */
  currency: string

  /** País de origem (de Asset.country, opcional) */
  country?: string | null

  /** Horizonte recomendado do ativo (de Asset.recommendedHorizon, opcional) */
  recommendedHorizon?: string | null

  /** Horizonte base da classe (de AssetClass.recommendedHorizonBase, opcional) */
  classRecommendedHorizonBase?: string | null

  /** Breakdown da posição por conta */
  accounts: Array<{
    accountId: string
    accountName: string
    quantity: Decimal
    totalCost: Decimal
  }>
}

/**
 * Métrica de um insight detectado.
 */
export type InsightMetrics = {
  /** Percentual atual (ex: 0.28 = 28%) */
  currentPercentage: number

  /** Threshold de alerta (ex: 0.25 = 25%) */
  threshold: number

  /** Quanto acima do threshold (currentPercentage - threshold) */
  excessPercentage: number
}

/**
 * Escopo em que o insight se aplica.
 */
export type InsightScope = {
  /** ID do cliente */
  clientId: string

  /** ID da carteira (opcional — se null, aplica a todas) */
  portfolioId?: string | null

  /** ID do ativo afetado (opcional — se null, aplica a classe/moeda/país) */
  assetId?: string | null

  /** ID da classe afetada (opcional) */
  assetClassId?: string | null

  /** Moeda afetada (opcional) */
  currency?: string | null

  /** País afetado (opcional) */
  country?: string | null
}

/**
 * Um insight detectado (não persistido em V1).
 */
export type Insight = {
  /** ID único do insight (UUID, gerado on-the-fly) */
  id: string

  /** Tipo de anomalia detectada */
  type: InsightType

  /** Severidade: 'info' (0-10%), 'warning' (10-100% acima), 'critical' (>100%) */
  severity: 'info' | 'warning' | 'critical'

  /** Título resumido para exibição */
  title: string

  /** Descrição detalhada */
  message: string

  /** Escopo do insight (cliente, carteira, ativo, classe, moeda, país) */
  scope: InsightScope

  /** Métricas numéricas (percentual atual, threshold, excesso) */
  metrics: InsightMetrics

  /** Ativos ou agregações que contribuem para o insight */
  affectedAssets: Array<{
    assetId: string
    assetName: string
    /** Percentual do ativo em relação ao total afetado */
    percentage: number
    /** Valor absoluto do ativo */
    absoluteValue: Decimal
  }>
}

/**
 * Regra efetiva de detecção para cada tipo.
 */
export type EffectiveInsightRule = {
  type: InsightType
  enabled: boolean
  threshold: number
  severity?: InsightSeverity
  sourceScope: InsightProfileScope | 'CATALOG_DEFAULT'
}

/**
 * Configuração efetiva usada pelo motor no cálculo atual.
 */
export type EffectiveInsightsConfig = Record<InsightType, EffectiveInsightRule>

/**
 * Perfil efetivo escolhido pela precedência de escopo.
 */
export type ResolvedInsightProfile = {
  profileId?: string
  scope: InsightProfileScope | 'CATALOG_DEFAULT'
}

/**
 * Thresholds de detecção (DEC-015).
 *
 * Valores padrão para V1; paralelamente os limites podem ser customizáveis em V2+.
 */
export const INSIGHT_THRESHOLDS = {
  concentracaoAtivo: 0.25, // 25%
  concentracaoClasse: 0.50, // 50%
  concentracaoMoedaPais: 0.70, // 70%
  desalinhamentoHorizonte: 0.30, // 30% de discrepância
} as const

/**
 * Mapeamento fallback local para manter comportamento V1 mesmo sem catálogo seeded.
 */
export const INSIGHT_DEFAULT_THRESHOLD_BY_TYPE: Record<InsightType, number> = {
  [InsightType.CONCENTRACAO_ATIVO]: INSIGHT_THRESHOLDS.concentracaoAtivo,
  [InsightType.CONCENTRACAO_CLASSE]: INSIGHT_THRESHOLDS.concentracaoClasse,
  [InsightType.CONCENTRACAO_MOEDA_PAIS]: INSIGHT_THRESHOLDS.concentracaoMoedaPais,
  [InsightType.HORIZONTE_DESALINHADO]: INSIGHT_THRESHOLDS.desalinhamentoHorizonte,
}
