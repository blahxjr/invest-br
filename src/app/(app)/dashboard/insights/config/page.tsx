import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { InsightRulesForm } from '@/components/InsightRulesForm'
import { getMyInsightRulesAction, saveMyInsightRulesAction } from './actions'

export default async function InsightsConfigPage() {
  const result = await getMyInsightRulesAction()

  if (!result.success) {
    if (result.error === 'UNAUTHORIZED') {
      redirect('/login')
    }

    redirect('/dashboard')
  }

  const saveAction = async (formData: FormData) => {
    'use server'

    const saveResult = await saveMyInsightRulesAction(formData)
    if (!saveResult.success) {
      if (saveResult.error === 'UNAUTHORIZED') {
        redirect('/login')
      }

      redirect('/dashboard')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/insights"
          className="rounded-lg p-2 transition-colors hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Regras de Insights</h1>
          <p className="text-sm text-gray-500">
            Ative ou desative tipos de insight e ajuste os limites percentuais no seu escopo.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <InsightRulesForm rules={result.data} action={saveAction} />
      </div>
    </div>
  )
}
