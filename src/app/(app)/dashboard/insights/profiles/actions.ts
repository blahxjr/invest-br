'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  assignProfileToClient,
  assignProfileToPortfolio,
  createInsightProfile,
  deleteInsightProfile,
  listInsightTypeCatalog,
  listOwnedInsightProfiles,
  updateInsightProfileName,
  upsertProfileRules,
  InsightRuleInput,
} from '@/modules/insights/config-service'

function parseRules(formData: FormData): InsightRuleInput[] {
  const thresholdKeys = Array.from(formData.keys()).filter((k) => k.startsWith('threshold_'))

  return thresholdKeys.map((key) => {
    const code = key.replace('threshold_', '')
    const raw = Number(formData.get(key) || 0)
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) / 100 : 0

    return {
      code,
      enabled: formData.get(`enabled_${code}`) === 'on',
      threshold: normalized,
    }
  })
}

export async function getProfilesPageDataAction() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const [profiles, clients, portfolios, catalog] = await Promise.all([
    listOwnedInsightProfiles(session.user.id),
    prisma.client.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, insightConfigProfileId: true },
    }),
    prisma.portfolio.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, insightConfigProfileId: true },
    }),
    listInsightTypeCatalog(),
  ])

  return { profiles, clients, portfolios, catalog }
}

export async function createProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const name = String(formData.get('name') || '')
  await createInsightProfile(session.user.id, name)

  revalidatePath('/dashboard/insights/profiles')
}

export async function saveProfileRulesAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const profileId = String(formData.get('profileId') || '')
  if (!profileId) {
    throw new Error('Perfil não informado')
  }

  await upsertProfileRules(session.user.id, profileId, parseRules(formData))

  revalidatePath('/dashboard/insights')
  revalidatePath('/dashboard/insights/profiles')
}

export async function renameProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const profileId = String(formData.get('profileId') || '')
  const name = String(formData.get('name') || '')
  if (!profileId) {
    throw new Error('Perfil não informado')
  }

  await updateInsightProfileName(session.user.id, profileId, name)
  revalidatePath('/dashboard/insights/profiles')
}

export async function assignClientProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const clientId = String(formData.get('clientId') || '')
  const profileId = String(formData.get('profileId') || '')

  if (!clientId || !profileId) {
    throw new Error('Cliente e perfil são obrigatórios')
  }

  await assignProfileToClient(session.user.id, clientId, profileId)
  revalidatePath('/dashboard/insights/profiles')
}

export async function assignPortfolioProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const portfolioId = String(formData.get('portfolioId') || '')
  const profileId = String(formData.get('profileId') || '')

  if (!portfolioId || !profileId) {
    throw new Error('Carteira e perfil são obrigatórios')
  }

  await assignProfileToPortfolio(session.user.id, portfolioId, profileId)
  revalidatePath('/dashboard/insights/profiles')
}

export async function deleteProfileAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const profileId = String(formData.get('profileId') || '')
  if (!profileId) {
    throw new Error('Perfil não informado')
  }

  await deleteInsightProfile(session.user.id, profileId)
  revalidatePath('/dashboard/insights/profiles')
}
