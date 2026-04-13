'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import {
  getMyInsightRules,
  saveMyInsightRules,
  InsightRuleInput,
  type InsightRuleView,
} from '@/modules/insights/config-service'
import type { ActionResult } from '@/types/actions'

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

export async function getMyInsightRulesAction(): Promise<ActionResult<InsightRuleView[]>> {
  const session = await auth()
  if (!session?.user?.id) {
    console.warn('[insights/config] getMyInsightRulesAction: sessão ausente')
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const data = await getMyInsightRules(session.user.id)
  return { success: true, data }
}

export async function saveMyInsightRulesAction(formData: FormData): Promise<ActionResult<void>> {
  const session = await auth()
  if (!session?.user?.id) {
    console.warn('[insights/config] saveMyInsightRulesAction: sessão ausente')
    return { success: false, error: 'UNAUTHORIZED' }
  }

  const rules = parseRulesFromFormData(formData)
  await saveMyInsightRules(session.user.id, rules)

  revalidatePath('/dashboard/insights')
  revalidatePath('/dashboard/insights/config')

  return { success: true, data: undefined }
}
