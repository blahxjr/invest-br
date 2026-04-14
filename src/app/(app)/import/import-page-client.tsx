'use client'

import { useState, useTransition } from 'react'
import {
  importMovimentacao,
  importNegociacao,
  importPosicao,
} from './actions'
import type { ImportResult } from '@/modules/b3/service'

type ImportAction = (formData: FormData) => Promise<ImportResult>

type ImportCardProps = {
  title: string
  description: string
  submitLabel: string
  action: ImportAction
  onFinished: (result: ImportResult) => void
}

function ResultBox({ result }: { result: ImportResult | null }) {
  if (!result) return null

  const hasErrors = result.errors.length > 0

  return (
    <div
      className={[
        'mt-3 rounded-lg border p-3 text-sm',
        hasErrors ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700',
      ].join(' ')}
    >
      {typeof result.upserted === 'number' ? (
        <p>{result.upserted} ativos sincronizados.</p>
      ) : (
        <p>
          {result.imported ?? 0} transacoes importadas, {result.skipped ?? 0} ignoradas.
        </p>
      )}
      {hasErrors && (
        <ul className="mt-2 list-disc pl-5">
          {result.errors.slice(0, 5).map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ImportCard({ title, description, submitLabel, action, onFinished }: ImportCardProps) {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{description}</p>

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          startTransition(async () => {
            const response = await action(formData)
            setResult(response)
            onFinished(response)
          })
        }}
      >
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isPending ? 'Importando...' : submitLabel}
        </button>
      </form>

      <ResultBox result={result} />
    </div>
  )
}

export default function ImportPageClient() {
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleFinished = (result: ImportResult) => {
    const message =
      typeof result.upserted === 'number'
        ? `${result.upserted} ativos sincronizados.`
        : `${result.imported ?? 0} transacoes importadas, ${result.skipped ?? 0} ignoradas.`

    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <div className="space-y-4 relative">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-md">
          {toastMessage}
        </div>
      )}

      <ImportCard
        title="Negociação"
        description="Importa compras e vendas da planilha de negociação da B3."
        submitLabel="Importar negociação"
        action={importNegociacao}
        onFinished={handleFinished}
      />

      <ImportCard
        title="Movimentação"
        description="Importa liquidações e proventos elegíveis da planilha de movimentação."
        submitLabel="Importar movimentação"
        action={importMovimentacao}
        onFinished={handleFinished}
      />

      <ImportCard
        title="Posição"
        description="Sincroniza o catálogo de ativos a partir das planilhas de posição."
        submitLabel="Importar posição"
        action={importPosicao}
        onFinished={handleFinished}
      />
    </div>
  )
}
