'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import {
  getMyInsightRules,
  saveMyInsightRules,
  InsightRuleInput,
} from '@/modules/insights/config-service'

function parseRulesFromFormData(formData: FormData): InsightRuleInput[] {
  const entries = Array.from(formData.entries())
  const thresholdKeys = entries
    .map(([key]) => key)
    .filter((key) => key.startsWith('threshold_'))

  return thresholdKeys.map((key) => {
    const code = key.replace('threshold_', '')
    const thresholdRaw = Number(formData.get(key) || 0)
    const threshold = Number.isFinite(thresholdRaw)
      ? Math.max(0, Math.min(100, thresholdRaw)) / 100
      : 0

    return {
      code,
      enabled: formData.get(`enabled_${code}`) === 'on',
      threshold,
    }
  })
}

export async function getMyInsightRulesAction() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  return getMyInsightRules(session.user.id)
}

export async function saveMyInsightRulesAction(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Não autenticado')
  }

  const rules = parseRulesFromFormData(formData)
  await saveMyInsightRules(session.user.id, rules)

  revalidatePath('/dashboard/insights')
  revalidatePath('/dashboard/insights/config')
}
