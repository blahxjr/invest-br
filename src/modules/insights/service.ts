/**
 * Serviço do módulo Insights/Rebalanceamento (V1 — on-the-fly, sem persistência)
 *
 * Detecta anomalias em carteiras do cliente:
 * - Concentração excessiva (ativo, classe, moeda/país)
 * - Desalinhamento entre horizonte do ativo e objetivo da carteira
 *
 * Versão: V1 (on-the-fly, sem tabela Insight persistida)
 * Referência: docs/modules/insights.md, DEC-015
 */

import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

import {
  GetInsightsInput,
  ConsolidatedPosition,
  Insight,
  InsightType,
  EffectiveInsightsConfig,
} from './types'
import { resolveEffectiveInsightsConfig } from './config-service'

type Decimal = Prisma.Decimal

/**
 * Obter insights para um cliente (ou carteira específica).
 *
 * Fluxo:
 * 1. Buscar todas as Transactions do cliente/carteira até `date`
 * 2. Consolidar posições virtuais por ativo (agregando quantity, avg cost)
 * 3. Aplicar detectores contra thresholds
 * 4. Retornar array de Insight
 *
 * @param clientId ID do cliente
 * @param portfolioId ID opcional da carteira (se omitido, agrega todas)
 * @param date Data de cálculo (default: today)
 * @returns Array de insights detectados (vazio se nenhuma anomalia)
 */
export async function getInsightsForClient(
  clientId: string,
  portfolioId?: string | null,
  date?: Date | null
): Promise<Insight[]> {
  const calcDate = date || new Date()

  // 1. Validar cliente
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  })

  if (!client) {
    return []
  }

  const effectiveConfig = await resolveEffectiveInsightsConfig(
    client.userId,
    clientId,
    portfolioId
  )

  // 2. Buscar todas as carteiras do cliente (ou apenas a especificada)
  let portfolios
  if (portfolioId) {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
    })
    portfolios = portfolio ? [portfolio] : []
  } else {
    portfolios = await prisma.portfolio.findMany({
      where: { userId: client.userId }, // Usuario que criou o client
    })
  }

  if (portfolios.length === 0) {
    return []
  }

  const portfolioIds = portfolios.map((p) => p.id)

  // 3. Buscar todas as contas vinculadas
  const accounts = await prisma.account.findMany({
    where: {
      clientId: clientId,
      portfolioId: {
        in: portfolioIds,
      },
    },
  })

  if (accounts.length === 0) {
    return []
  }

  const accountIds = accounts.map((a) => a.id)

  // 4. Buscar todas as transações até a data especificada
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: {
        in: accountIds,
      },
      date: {
        lte: calcDate,
      },
    },
    include: {
      asset: {
        include: {
          assetClass: true,
        },
      },
    },
  })

  // 5. Consolidar posições virtuais
  const positions = consolidarPosicoes(transactions, accounts)

  if (positions.length === 0) {
    return []
  }

  // 6. Calcular patrimônio total
  const patrimonioTotal = positions.reduce(
    (sum, pos) => sum.plus(pos.totalCost),
    new Prisma.Decimal(0)
  )

  if (patrimonioTotal.lte(0)) {
    return []
  }

  // 7. Aplicar detectores
  const insights: Insight[] = []

  // Detectar concentração por ativo
  if (effectiveConfig[InsightType.CONCENTRACAO_ATIVO].enabled) {
    insights.push(
      ...detectConcentracaoAtivo(
        positions,
        patrimonioTotal,
        clientId,
        effectiveConfig,
        portfolioId
      )
    )
  }

  // Detectar concentração por classe
  if (effectiveConfig[InsightType.CONCENTRACAO_CLASSE].enabled) {
    insights.push(
      ...detectConcentracaoClasse(
        positions,
        patrimonioTotal,
        clientId,
        effectiveConfig,
        portfolioId
      )
    )
  }

  // Detectar concentração por moeda/país
  if (effectiveConfig[InsightType.CONCENTRACAO_MOEDA_PAIS].enabled) {
    insights.push(
      ...detectConcentracaoMoedaPais(
        positions,
        patrimonioTotal,
        clientId,
        effectiveConfig,
        portfolioId
      )
    )
  }

  // Detectar desalinhamento de horizonte
  if (effectiveConfig[InsightType.HORIZONTE_DESALINHADO].enabled) {
    insights.push(
      ...detectDesalinhamentoHorizonte(
        positions,
        patrimonioTotal,
        clientId,
        effectiveConfig,
        portfolioId
      )
    )
  }

  return insights
}

/**
 * Consolidar posições virtuais a partir de transações.
 *
 * Agrupa por assetId, calcula:
 * - Quantidade total (BUY - SELL)
 * - Preço médio ponderado
 * - Valor total
 * - Breakdown por conta
 */
function consolidarPosicoes(
  transactions: any[],
  accounts: any[]
): ConsolidatedPosition[] {
  const positionsMap = new Map<string, ConsolidatedPosition>()
  const accountsMap = new Map(accounts.map((a) => [a.id, a]))

  for (const tx of transactions) {
    // Ignorar transações sem ativo (DEPOSIT, WITHDRAWAL sem ativo)
    if (!tx.assetId || !tx.asset) {
      continue
    }

    // Ignorar tipos de transação que não afetam quantidade (DIVIDEND, INTEREST)
    if (!['BUY', 'SELL'].includes(tx.type)) {
      continue
    }

    const key = tx.assetId
    let position = positionsMap.get(key)

    if (!position) {
      position = {
        assetId: tx.assetId,
        assetName: tx.asset.name,
        ticker: tx.asset.ticker,
        assetClassId: tx.asset.assetClassId,
        assetClassName: tx.asset.assetClass.name,
        quantity: new Prisma.Decimal(0),
        avgCost: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        currency: tx.asset.currency || 'BRL',
        country: tx.asset.country,
        recommendedHorizon: tx.asset.recommendedHorizon,
        classRecommendedHorizonBase: tx.asset.assetClass?.recommendedHorizonBase,
        accounts: [],
      }
      positionsMap.set(key, position)
    }

    // Atualizar quantidade e preço médio
    const currentQty = new Prisma.Decimal(position.quantity)
    const currentValue = new Prisma.Decimal(position.totalCost)
    const txQty = new Prisma.Decimal(tx.quantity)
    const txPrice = tx.price ? new Prisma.Decimal(tx.price) : new Prisma.Decimal(0)

    if (tx.type === 'BUY') {
      const newQty = currentQty.plus(txQty)
      const newValue = currentValue.plus(txQty.times(txPrice))
      position.quantity = newQty
      position.totalCost = newValue
      position.avgCost = newQty.isZero() ? new Prisma.Decimal(0) : newValue.dividedBy(newQty)
    } else if (tx.type === 'SELL') {
      const newQty = currentQty.minus(txQty)
      // No SELL, mantém o avg cost anterior (custo médio não muda)
      position.quantity = newQty.isNegative() ? new Prisma.Decimal(0) : newQty
      position.totalCost = position.quantity.times(position.avgCost)
    }

    // Breakdown por conta
    let accountPosition = position.accounts.find((a) => a.accountId === tx.accountId)
    if (!accountPosition) {
      const account = accountsMap.get(tx.accountId)
      accountPosition = {
        accountId: tx.accountId,
        accountName: account?.name || 'Unknown',
        quantity: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
      }
      position.accounts.push(accountPosition)
    }

    if (tx.type === 'BUY') {
      accountPosition.quantity = accountPosition.quantity.plus(txQty)
      accountPosition.totalCost = accountPosition.totalCost.plus(
        txQty.times(txPrice)
      )
    } else if (tx.type === 'SELL') {
      accountPosition.quantity = accountPosition.quantity.minus(txQty)
      if (accountPosition.quantity.isNegative()) {
        accountPosition.quantity = new Prisma.Decimal(0)
      }
      accountPosition.totalCost = accountPosition.quantity.times(position.avgCost)
    }
  }

  // Filtrar posições com quantidade > 0
  return Array.from(positionsMap.values()).filter(
    (pos) => pos.quantity.gt(0)
  )
}

/**
 * Detectar concentração por ativo (threshold: 25%).
 */
function detectConcentracaoAtivo(
  positions: ConsolidatedPosition[],
  patrimonioTotal: Decimal,
  clientId: string,
  effectiveConfig: EffectiveInsightsConfig,
  portfolioId?: string | null
): Insight[] {
  const insights: Insight[] = []
  const threshold = effectiveConfig[InsightType.CONCENTRACAO_ATIVO].threshold

  for (const pos of positions) {
    const percentage = pos.totalCost.dividedBy(patrimonioTotal).toNumber()

    if (percentage > threshold) {
      const excessPercentage = percentage - threshold
      const severity =
        excessPercentage <= 0.1
          ? 'info'
          : excessPercentage <= 1
            ? 'warning'
            : 'critical'

      insights.push({
        id: uuidv4(),
        type: InsightType.CONCENTRACAO_ATIVO,
        severity: severity as 'info' | 'warning' | 'critical',
        title: `${pos.assetName} (${pos.ticker || 'N/A'}) representa ${(percentage * 100).toFixed(1)}% da carteira`,
        message: `Concentração elevada em um único ativo pode aumentar o risco de volatilidade. Considere diversificar ou rebalancear.`,
        scope: {
          clientId,
          portfolioId: portfolioId || undefined,
          assetId: pos.assetId,
        },
        metrics: {
          currentPercentage: percentage,
          threshold,
          excessPercentage,
        },
        affectedAssets: [
          {
            assetId: pos.assetId,
            assetName: pos.assetName,
            percentage,
            absoluteValue: pos.totalCost,
          },
        ],
      })
    }
  }

  return insights
}

/**
 * Detectar concentração por classe (threshold: 50%).
 */
function detectConcentracaoClasse(
  positions: ConsolidatedPosition[],
  patrimonioTotal: Decimal,
  clientId: string,
  effectiveConfig: EffectiveInsightsConfig,
  portfolioId?: string | null
): Insight[] {
  const insights: Insight[] = []
  const threshold = effectiveConfig[InsightType.CONCENTRACAO_CLASSE].threshold

  // Agregar por classe
  const classeMap = new Map<string, { name: string; total: Decimal; assets: ConsolidatedPosition[] }>()

  for (const pos of positions) {
    const classKey = pos.assetClassId
    let classData = classeMap.get(classKey)

    if (!classData) {
      classData = {
        name: pos.assetClassName,
        total: new Prisma.Decimal(0),
        assets: [],
      }
      classeMap.set(classKey, classData)
    }

    classData.total = classData.total.plus(pos.totalCost)
    classData.assets.push(pos)
  }

  // Verificar threshold por classe
  for (const [classId, classData] of classeMap) {
    const percentage = classData.total.dividedBy(patrimonioTotal).toNumber()

    if (percentage > threshold) {
      const excessPercentage = percentage - threshold
      const severity =
        excessPercentage <= 0.1
          ? 'info'
          : excessPercentage <= 1
            ? 'warning'
            : 'critical'

      insights.push({
        id: uuidv4(),
        type: InsightType.CONCENTRACAO_CLASSE,
        severity: severity as 'info' | 'warning' | 'critical',
        title: `${classData.name} representa ${(percentage * 100).toFixed(1)}% da carteira`,
        message: `Concentração elevada em uma classe de ativo pode reduzir a diversificação. Considere realocação entre classes.`,
        scope: {
          clientId,
          portfolioId: portfolioId || undefined,
          assetClassId: classId,
        },
        metrics: {
          currentPercentage: percentage,
          threshold,
          excessPercentage,
        },
        affectedAssets: classData.assets.map((asset) => ({
          assetId: asset.assetId,
          assetName: asset.assetName,
          percentage: asset.totalCost.dividedBy(patrimonioTotal).toNumber(),
          absoluteValue: asset.totalCost,
        })),
      })
    }
  }

  return insights
}

/**
 * Detectar concentração por moeda/país (threshold: 70%).
 */
function detectConcentracaoMoedaPais(
  positions: ConsolidatedPosition[],
  patrimonioTotal: Decimal,
  clientId: string,
  effectiveConfig: EffectiveInsightsConfig,
  portfolioId?: string | null
): Insight[] {
  const insights: Insight[] = []
  const threshold = effectiveConfig[InsightType.CONCENTRACAO_MOEDA_PAIS].threshold

  // Agregar por moeda
  const moedaMap = new Map<string, { assets: ConsolidatedPosition[]; total: Decimal }>()
  // Agregar por país
  const paisMap = new Map<string, { assets: ConsolidatedPosition[]; total: Decimal }>()

  for (const pos of positions) {
    // Agregar por moeda (nunca null, default BRL)
    const currency = pos.currency || 'BRL'
    let moedaData = moedaMap.get(currency)
    if (!moedaData) {
      moedaData = { assets: [], total: new Prisma.Decimal(0) }
      moedaMap.set(currency, moedaData)
    }
    moedaData.total = moedaData.total.plus(pos.totalCost)
    moedaData.assets.push(pos)

    // Agregar por país (pode ser null)
    if (pos.country) {
      let paisData = paisMap.get(pos.country)
      if (!paisData) {
        paisData = { assets: [], total: new Prisma.Decimal(0) }
        paisMap.set(pos.country, paisData)
      }
      paisData.total = paisData.total.plus(pos.totalCost)
      paisData.assets.push(pos)
    }
  }

  // Verificar threshold por moeda
  for (const [currency, moedaData] of moedaMap) {
    const percentage = moedaData.total.dividedBy(patrimonioTotal).toNumber()

    if (percentage > threshold) {
      const excessPercentage = percentage - threshold
      const severity =
        excessPercentage <= 0.1
          ? 'info'
          : excessPercentage <= 1
            ? 'warning'
            : 'critical'

      insights.push({
        id: uuidv4(),
        type: InsightType.CONCENTRACAO_MOEDA_PAIS,
        severity: severity as 'info' | 'warning' | 'critical',
        title: `${(percentage * 100).toFixed(1)}% do patrimônio em ${currency}`,
        message: `Alta concentração em uma moeda pode expor a riscos cambiais. Considere diversificar em outras moedas ou países.`,
        scope: {
          clientId,
          portfolioId: portfolioId || undefined,
          currency,
        },
        metrics: {
          currentPercentage: percentage,
          threshold,
          excessPercentage,
        },
        affectedAssets: moedaData.assets.map((asset) => ({
          assetId: asset.assetId,
          assetName: asset.assetName,
          percentage: asset.totalCost.dividedBy(patrimonioTotal).toNumber(),
          absoluteValue: asset.totalCost,
        })),
      })
    }
  }

  // Verificar threshold por país
  for (const [country, paisData] of paisMap) {
    const percentage = paisData.total.dividedBy(patrimonioTotal).toNumber()

    if (percentage > threshold) {
      const excessPercentage = percentage - threshold
      const severity =
        excessPercentage <= 0.1
          ? 'info'
          : excessPercentage <= 1
            ? 'warning'
            : 'critical'

      insights.push({
        id: uuidv4(),
        type: InsightType.CONCENTRACAO_MOEDA_PAIS,
        severity: severity as 'info' | 'warning' | 'critical',
        title: `${(percentage * 100).toFixed(1)}% do patrimônio em ${country}`,
        message: `Alta concentração em um país pode expor a riscos geopolíticos. Considere diversificar internacionalmente.`,
        scope: {
          clientId,
          portfolioId: portfolioId || undefined,
          country,
        },
        metrics: {
          currentPercentage: percentage,
          threshold,
          excessPercentage,
        },
        affectedAssets: paisData.assets.map((asset) => ({
          assetId: asset.assetId,
          assetName: asset.assetName,
          percentage: asset.totalCost.dividedBy(patrimonioTotal).toNumber(),
          absoluteValue: asset.totalCost,
        })),
      })
    }
  }

  return insights
}

/**
 * Detectar desalinhamento de horizonte (threshold: 30%).
 *
 * Um ativo com horizonte recomendado SHORT/MEDIUM em carteira com objetivo LONG é discrepância.
 * Edge case: se Asset.recommendedHorizon for null, usar AssetClass.recommendedHorizonBase.
 * Se ambos forem null, ignorar esse ativo no detector.
 */
function detectDesalinhamentoHorizonte(
  positions: ConsolidatedPosition[],
  patrimonioTotal: Decimal,
  clientId: string,
  effectiveConfig: EffectiveInsightsConfig,
  portfolioId?: string | null
): Insight[] {
  const insights: Insight[] = []
  const threshold = effectiveConfig[InsightType.HORIZONTE_DESALINHADO].threshold

  // Para V1, assumimos horizonte de carteira = LONG (default conservador)
  // Em V2+, isso viria de Portfolio.recommendedHorizon
  const carthoorizonObject = 'LONG'

  for (const pos of positions) {
    // Resolver horizonte recomendado: Asset > AssetClass > ignorar
    const horizon =
      pos.recommendedHorizon || pos.classRecommendedHorizonBase || null

    if (!horizon) {
      // Sem horizonte definido — ignorar
      continue
    }

    // Verificar discrepância
    const isDiscrepant =
      (horizon === 'SHORT' && carthoorizonObject === 'LONG') ||
      (horizon === 'MEDIUM' && carthoorizonObject === 'LONG')

    if (isDiscrepant) {
      const percentage = pos.totalCost.dividedBy(patrimonioTotal).toNumber()

      // Severidade: quanto mais % do patrimônio, mais grave
      const severity =
        percentage <= 0.1
          ? 'info'
          : percentage <= 0.3
            ? 'warning'
            : 'critical'

      const excessPercentage = percentage - threshold

      insights.push({
        id: uuidv4(),
        type: InsightType.HORIZONTE_DESALINHADO,
        severity: severity as 'info' | 'warning' | 'critical',
        title: `${pos.assetName} com horizonte ${horizon} em carteira LONG`,
        message: `Este ativo com horizonte de curto prazo pode não ser apropriado para uma carteira com objetivo de longo prazo. Considere revisão.`,
        scope: {
          clientId,
          portfolioId: portfolioId || undefined,
          assetId: pos.assetId,
        },
        metrics: {
          currentPercentage: percentage,
          threshold,
          excessPercentage,
        },
        affectedAssets: [
          {
            assetId: pos.assetId,
            assetName: pos.assetName,
            percentage,
            absoluteValue: pos.totalCost,
          },
        ],
      })
    }
  }

  return insights
}
