/**
 * Serviço de configuração de Insights/Rebalanceamento.
 *
 * Responsável por resolver o perfil efetivo de configuração por precedência:
 * Portfolio > Client > User > Global
 */

import { prisma as prismaClient } from '@/lib/prisma'
import {
  EffectiveInsightsConfig,
  EffectiveInsightRule,
  InsightProfileScope,
  InsightType,
  ResolvedInsightProfile,
  INSIGHT_DEFAULT_THRESHOLD_BY_TYPE,
} from './types'

const prismaUnsafe = prismaClient as any

export type InsightRuleInput = {
  code: string
  enabled: boolean
  threshold: number
  severity?: 'info' | 'warning' | 'critical'
}

export type InsightRuleView = {
  code: string
  label: string
  description?: string | null
  enabled: boolean
  threshold: number
  defaultThreshold: number
  severity?: 'info' | 'warning' | 'critical'
}

const TYPE_FROM_CODE: Record<string, InsightType | undefined> = {
  CONCENTRACAO_ATIVO: InsightType.CONCENTRACAO_ATIVO,
  CONCENTRACAO_CLASSE: InsightType.CONCENTRACAO_CLASSE,
  CONCENTRACAO_MOEDA_PAIS: InsightType.CONCENTRACAO_MOEDA_PAIS,
  HORIZONTE_DESALINHADO: InsightType.HORIZONTE_DESALINHADO,
}

function baseRule(type: InsightType): EffectiveInsightRule {
  return {
    type,
    enabled: true,
    threshold: INSIGHT_DEFAULT_THRESHOLD_BY_TYPE[type],
    sourceScope: 'CATALOG_DEFAULT',
  }
}

function baseConfig(): EffectiveInsightsConfig {
  return {
    [InsightType.CONCENTRACAO_ATIVO]: baseRule(InsightType.CONCENTRACAO_ATIVO),
    [InsightType.CONCENTRACAO_CLASSE]: baseRule(InsightType.CONCENTRACAO_CLASSE),
    [InsightType.CONCENTRACAO_MOEDA_PAIS]: baseRule(InsightType.CONCENTRACAO_MOEDA_PAIS),
    [InsightType.HORIZONTE_DESALINHADO]: baseRule(InsightType.HORIZONTE_DESALINHADO),
  }
}

/**
 * Resolve o perfil efetivo a ser usado no cálculo de insights.
 */
export async function resolveInsightProfile(
  userId: string,
  clientId: string,
  portfolioId?: string | null
): Promise<ResolvedInsightProfile> {
  if (portfolioId) {
    const portfolio = await prismaUnsafe.portfolio.findUnique({
      where: { id: portfolioId },
      select: { insightConfigProfileId: true },
    })

    if (portfolio?.insightConfigProfileId) {
      return { profileId: portfolio.insightConfigProfileId, scope: 'PORTFOLIO' }
    }
  }

  const client = await prismaUnsafe.client.findUnique({
    where: { id: clientId },
    select: { insightConfigProfileId: true },
  })

  if (client?.insightConfigProfileId) {
    return { profileId: client.insightConfigProfileId, scope: 'CLIENT' }
  }

  const user = await prismaUnsafe.user.findUnique({
    where: { id: userId },
    select: { insightConfigProfileId: true },
  })

  if (user?.insightConfigProfileId) {
    return { profileId: user.insightConfigProfileId, scope: 'USER' }
  }

  const globalProfile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: {
      scope: 'GLOBAL',
      isSystemDefault: true,
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  if (globalProfile?.id) {
    return { profileId: globalProfile.id, scope: 'GLOBAL' }
  }

  return { scope: 'CATALOG_DEFAULT' }
}

/**
 * Resolve configuração efetiva de insights com fallback total.
 */
export async function resolveEffectiveInsightsConfig(
  userId: string,
  clientId: string,
  portfolioId?: string | null
): Promise<EffectiveInsightsConfig> {
  const config = baseConfig()

  const types = await prismaUnsafe.insightType.findMany({
    where: { isActive: true },
    select: { code: true, defaultThreshold: true },
  })

  for (const insightType of types) {
    const type = TYPE_FROM_CODE[insightType.code]
    if (!type) continue

    config[type] = {
      ...config[type],
      threshold: insightType.defaultThreshold.toNumber(),
      sourceScope: 'CATALOG_DEFAULT',
    }
  }

  const resolvedProfile = await resolveInsightProfile(userId, clientId, portfolioId)

  if (!resolvedProfile.profileId) {
    return config
  }

  const rules = await prismaUnsafe.insightConfigRule.findMany({
    where: {
      profileId: resolvedProfile.profileId,
      profile: { isActive: true },
      insightType: { isActive: true },
    },
    include: {
      insightType: {
        select: { code: true, defaultThreshold: true },
      },
    },
  })

  for (const rule of rules) {
    const type = TYPE_FROM_CODE[rule.insightType.code]
    if (!type) continue

    config[type] = {
      ...config[type],
      enabled: rule.enabled,
      threshold: (rule.thresholdOverride ?? rule.insightType.defaultThreshold).toNumber(),
      sourceScope: resolvedProfile.scope as InsightProfileScope,
      severity: rule.severityOverride
        ? rule.severityOverride.toLowerCase() as 'info' | 'warning' | 'critical'
        : undefined,
    }
  }

  return config
}

/**
 * Lista catálogo ativo de tipos de insight.
 */
export async function listInsightTypeCatalog() {
  return prismaUnsafe.insightType.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      label: true,
      description: true,
      defaultThreshold: true,
    },
  })
}

/**
 * Obtém ou cria perfil USER padrão para o usuário autenticado.
 */
export async function getOrCreateUserInsightProfile(userId: string) {
  const user = await prismaUnsafe.user.findUnique({
    where: { id: userId },
    select: { id: true, insightConfigProfileId: true },
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  if (user.insightConfigProfileId) {
    const existing = await prismaUnsafe.insightConfigProfile.findUnique({
      where: { id: user.insightConfigProfileId },
    })
    if (existing) {
      return existing
    }
  }

  const profile = await prismaUnsafe.insightConfigProfile.create({
    data: {
      name: 'Minhas Regras de Insights',
      description: 'Perfil padrão de configuração do usuário.',
      scope: 'USER',
      ownerUserId: userId,
      isActive: true,
    },
  })

  await prismaUnsafe.user.update({
    where: { id: userId },
    data: { insightConfigProfileId: profile.id },
  })

  return profile
}

/**
 * Carrega regras para a tela PF com fallback no catálogo.
 */
export async function getMyInsightRules(userId: string): Promise<InsightRuleView[]> {
  const profile = await getOrCreateUserInsightProfile(userId)

  const [catalog, rules] = await Promise.all([
    listInsightTypeCatalog(),
    prismaUnsafe.insightConfigRule.findMany({
      where: { profileId: profile.id },
      include: { insightType: true },
    }),
  ])

  return catalog.map((item: any) => {
    const rule = rules.find((r: any) => r.insightType.code === item.code)
    return {
      code: item.code,
      label: item.label,
      description: item.description,
      enabled: rule?.enabled ?? true,
      threshold: (rule?.thresholdOverride ?? item.defaultThreshold).toNumber(),
      defaultThreshold: item.defaultThreshold.toNumber(),
      severity: rule?.severityOverride
        ? rule.severityOverride.toLowerCase() as 'info' | 'warning' | 'critical'
        : undefined,
    }
  })
}

/**
 * Salva regras do perfil USER.
 */
export async function saveMyInsightRules(userId: string, rules: InsightRuleInput[]) {
  const profile = await getOrCreateUserInsightProfile(userId)
  await upsertProfileRules(userId, profile.id, rules)
}

/**
 * Cria perfil de configuração para uso em clientes/carteiras.
 */
export async function createInsightProfile(userId: string, name: string) {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error('Nome do perfil é obrigatório')
  }

  return prismaUnsafe.insightConfigProfile.create({
    data: {
      name: normalized,
      scope: 'CLIENT',
      ownerUserId: userId,
      isActive: true,
    },
  })
}

/**
 * Atualiza o nome de um perfil de propriedade do usuário.
 */
export async function updateInsightProfileName(userId: string, profileId: string, name: string) {
  const normalized = name.trim()
  if (!normalized) {
    throw new Error('Nome do perfil é obrigatório')
  }

  const profile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  })

  if (!profile) {
    throw new Error('Perfil não encontrado para atualização')
  }

  await prismaUnsafe.insightConfigProfile.update({
    where: { id: profileId },
    data: { name: normalized },
  })
}

/**
 * Lista perfis do usuário para a tela de consultor.
 */
export async function listOwnedInsightProfiles(userId: string) {
  return prismaUnsafe.insightConfigProfile.findMany({
    where: {
      ownerUserId: userId,
      scope: { in: ['USER', 'CLIENT', 'PORTFOLIO'] },
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      rules: { include: { insightType: true } },
      assignedClients: { select: { id: true, name: true } },
      assignedPortfolios: { select: { id: true, name: true } },
    },
  })
}

/**
 * Atualiza/insere regras de um perfil de propriedade do usuário.
 */
export async function upsertProfileRules(
  userId: string,
  profileId: string,
  rules: InsightRuleInput[]
) {
  const profile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  })

  if (!profile) {
    throw new Error('Perfil não encontrado para o usuário')
  }

  const catalog = await listInsightTypeCatalog()
  const byCode = new Map<string, any>(catalog.map((item: any) => [item.code, item]))

  for (const rule of rules) {
    const type = byCode.get(rule.code)
    if (!type) continue

    await prismaUnsafe.insightConfigRule.upsert({
      where: {
        profileId_insightTypeId: {
          profileId,
          insightTypeId: type.id,
        },
      },
      update: {
        enabled: rule.enabled,
        thresholdOverride: rule.threshold,
        severityOverride: rule.severity?.toUpperCase() as 'INFO' | 'WARNING' | 'CRITICAL' | undefined,
      },
      create: {
        profileId,
        insightTypeId: type.id,
        enabled: rule.enabled,
        thresholdOverride: rule.threshold,
        severityOverride: rule.severity?.toUpperCase() as 'INFO' | 'WARNING' | 'CRITICAL' | undefined,
      },
    })
  }
}

/**
 * Atribui perfil a um cliente do usuário.
 */
export async function assignProfileToClient(userId: string, clientId: string, profileId: string) {
  const client = await prismaUnsafe.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  })
  if (!client) {
    throw new Error('Cliente não encontrado para o usuário')
  }

  const profile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  })
  if (!profile) {
    throw new Error('Perfil inválido para atribuição')
  }

  await prismaUnsafe.client.update({
    where: { id: clientId },
    data: { insightConfigProfileId: profileId },
  })
}

/**
 * Atribui perfil a uma carteira do usuário.
 */
export async function assignProfileToPortfolio(userId: string, portfolioId: string, profileId: string) {
  const portfolio = await prismaUnsafe.portfolio.findFirst({
    where: { id: portfolioId, userId },
    select: { id: true },
  })
  if (!portfolio) {
    throw new Error('Carteira não encontrada para o usuário')
  }

  const profile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  })
  if (!profile) {
    throw new Error('Perfil inválido para atribuição')
  }

  await prismaUnsafe.portfolio.update({
    where: { id: portfolioId },
    data: { insightConfigProfileId: profileId },
  })
}

/**
 * Remove perfil do usuário (sem remover o catálogo).
 */
export async function deleteInsightProfile(userId: string, profileId: string) {
  const profile = await prismaUnsafe.insightConfigProfile.findFirst({
    where: { id: profileId, ownerUserId: userId },
    select: { id: true },
  })
  if (!profile) {
    throw new Error('Perfil não encontrado para exclusão')
  }

  await prismaUnsafe.$transaction([
    prismaUnsafe.user.updateMany({
      where: { insightConfigProfileId: profileId, id: userId },
      data: { insightConfigProfileId: null },
    }),
    prismaUnsafe.client.updateMany({
      where: { insightConfigProfileId: profileId, userId },
      data: { insightConfigProfileId: null },
    }),
    prismaUnsafe.portfolio.updateMany({
      where: { insightConfigProfileId: profileId, userId },
      data: { insightConfigProfileId: null },
    }),
    prismaUnsafe.insightConfigRule.deleteMany({ where: { profileId } }),
    prismaUnsafe.insightConfigProfile.delete({ where: { id: profileId } }),
  ])
}


