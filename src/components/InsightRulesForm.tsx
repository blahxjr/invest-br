'use client'

import { useMemo } from 'react'

type Rule = {
  code: string
  label: string
  description?: string | null
  enabled: boolean
  threshold: number
  defaultThreshold: number
}

type InsightRulesFormProps = {
  rules: Rule[]
  submitLabel?: string
  action: (formData: FormData) => Promise<void>
  profileId?: string
}

export function InsightRulesForm({
  rules,
  action,
  submitLabel = 'Salvar regras',
  profileId,
}: InsightRulesFormProps) {
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [rules]
  )

  return (
    <form action={action} className="space-y-4">
      {profileId ? <input type="hidden" name="profileId" value={profileId} /> : null}

      {sortedRules.map((rule) => (
        <div key={rule.code} className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{rule.label}</p>
              {rule.description ? (
                <p className="mt-1 text-xs text-gray-500">{rule.description}</p>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                name={`enabled_${rule.code}`}
                defaultChecked={rule.enabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Ativo
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              Limite (%)
              <input
                type="number"
                name={`threshold_${rule.code}`}
                min="0"
                max="100"
                step="0.1"
                defaultValue={(rule.threshold * 100).toFixed(1)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-600">Default catálogo</p>
              <p>{(rule.defaultThreshold * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
