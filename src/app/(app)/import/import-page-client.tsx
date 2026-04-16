'use client'

import { useState, useTransition } from 'react'
import {
  analyzeNegociacaoFile,
  confirmAndImportNegociacao,
  importMovimentacao,
  importPosicao,
  type AnalyzeNegociacaoResponse,
  type ConfirmImportPayload,
  type ConfirmImportResponse,
  type SerializableUnresolvedAsset,
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

type WizardStep = 1 | 2 | 3 | 4

function AnalysisSkeleton() {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-full rounded bg-gray-100" />
      <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
    </div>
  )
}

function NegociacaoWizardCard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [analysis, setAnalysis] = useState<AnalyzeNegociacaoResponse | null>(null)
  const [unresolvedAssets, setUnresolvedAssets] = useState<SerializableUnresolvedAsset[]>([])
  const [result, setResult] = useState<ConfirmImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const unresolvedOnlyFii = unresolvedAssets.filter((asset) => asset.inferredClass === 'FII')
  const allResolved =
    unresolvedAssets.length === 0 ||
    unresolvedAssets.every((asset) => {
      const resolution = asset.resolution
      if (!resolution) return false
      if (resolution.action === 'create') {
        return Boolean(resolution.assetClassId && (resolution.name?.trim() ?? asset.ticker))
      }
      return Boolean(resolution.existingAssetId)
    })

  const updateResolution = (
    ticker: string,
    patch: NonNullable<SerializableUnresolvedAsset['resolution']>,
  ) => {
    setUnresolvedAssets((current) =>
      current.map((asset) =>
        asset.ticker === ticker
          ? {
              ...asset,
              resolution: {
                ...asset.resolution,
                ...patch,
              },
            }
          : asset,
      ),
    )
  }

  const handleAnalyze = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const response = await analyzeNegociacaoFile(formData)
      if (response.error) {
        setError(response.error)
        setAnalysis(null)
        setUnresolvedAssets([])
        setStep(1)
        return
      }

      setAnalysis(response)
      setUnresolvedAssets(response.unresolvedAssets)
      setStep(response.unresolvedAssets.length > 0 ? 2 : 3)
    })
  }

  const handleConfirmAllFii = () => {
    setUnresolvedAssets((current) =>
      current.map((asset) => {
        if (asset.inferredClass !== 'FII') return asset
        return {
          ...asset,
          resolution: {
            action: 'create',
            assetClassId: 'FII',
            name: asset.ticker,
          },
        }
      }),
    )
  }

  const handleConfirmImport = () => {
    if (!analysis) return

    const payload: ConfirmImportPayload = {
      readyRows: analysis.ready,
      resolutions: unresolvedAssets,
    }

    setError(null)
    startTransition(async () => {
      const response = await confirmAndImportNegociacao(payload)
      if (response.error) {
        setError(response.error)
        return
      }
      setResult(response)
      setStep(4)
    })
  }

  const unresolvedTransactionCount = unresolvedAssets.reduce((acc, asset) => acc + asset.rows.length, 0)

  const createList = unresolvedAssets.filter((asset) => asset.resolution?.action === 'create')
  const associateList = unresolvedAssets.filter((asset) => asset.resolution?.action === 'associate')

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-lg font-semibold text-gray-900">Negociação</h2>
      <p className="text-sm text-gray-500 mt-1">Importação com análise prévia e resolução de ativos novos.</p>

      {step === 1 && (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            handleAnalyze(new FormData(event.currentTarget))
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
            {isPending ? 'Analisando...' : 'Analisar planilha'}
          </button>
          {isPending && <AnalysisSkeleton />}
        </form>
      )}

      {step === 2 && analysis && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            <p className="font-semibold">📋 {unresolvedAssets.length} ativo(s) novo(s) encontrado(s)</p>
            <p>Configure cada ativo antes de importar as transações.</p>
          </div>

          {unresolvedOnlyFii.length > 0 && (
            <button
              type="button"
              onClick={handleConfirmAllFii}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Confirmar todos como FII
            </button>
          )}

          {unresolvedAssets.map((asset) => {
            const resolution = asset.resolution
            const selectedAction = resolution?.action ?? 'create'
            return (
              <div key={asset.ticker} className="rounded-xl border border-gray-200 p-4">
                <p className="text-base font-semibold text-gray-900">🏷️ {asset.ticker}</p>
                <p className="text-sm text-gray-600">
                  Detectado automaticamente: {asset.inferredClass ?? 'Desconhecido'}
                </p>

                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name={`action-${asset.ticker}`}
                      checked={selectedAction === 'create'}
                      onChange={() =>
                        updateResolution(asset.ticker, {
                          action: 'create',
                          assetClassId: toAssetClassCode(asset.inferredClass),
                          name: resolution?.name ?? asset.ticker,
                        })
                      }
                    />
                    Criar novo ativo
                  </label>

                  {selectedAction === 'create' && (
                    <div className="ml-6 grid gap-2 md:grid-cols-2">
                      <input
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Nome do ativo"
                        value={resolution?.name ?? asset.ticker}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'create',
                            assetClassId: resolution?.assetClassId ?? toAssetClassCode(asset.inferredClass),
                            name: event.target.value,
                          })
                        }
                      />
                      <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={resolution?.assetClassId ?? toAssetClassCode(asset.inferredClass) ?? ''}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'create',
                            assetClassId: event.target.value,
                            name: resolution?.name ?? asset.ticker,
                          })
                        }
                      >
                        <option value="">Selecione a classe</option>
                        {asset.availableClasses.map((classCode) => (
                          <option key={`${asset.ticker}-${classCode}`} value={classCode}>
                            {classCode}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name={`action-${asset.ticker}`}
                      checked={selectedAction === 'associate'}
                      onChange={() =>
                        updateResolution(asset.ticker, {
                          action: 'associate',
                          existingAssetId: resolution?.existingAssetId ?? '',
                        })
                      }
                    />
                    Associar a ativo existente
                  </label>

                  {selectedAction === 'associate' && (
                    <div className="ml-6">
                      <input
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Buscar (informe o ID do ativo existente)"
                        value={resolution?.existingAssetId ?? ''}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'associate',
                            existingAssetId: event.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <p className="mt-3 text-sm text-gray-600">
                  Transações: {asset.rows.length} linha(s) (R$ {asset.rows.reduce((sum, row) => sum + row.total, 0).toFixed(2)})
                </p>
              </div>
            )
          })}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!allResolved}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Avançar →
            </button>
          </div>
        </div>
      )}

      {step === 3 && analysis && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700 space-y-1">
            <p>✅ {analysis.ready.length} transações prontas para importar</p>
            <p>🆕 {createList.length} ativos serão cadastrados</p>
            {createList.map((asset) => (
              <p key={`create-${asset.ticker}`}>• {asset.ticker} → {asset.resolution?.assetClassId ?? 'N/A'} (criar novo)</p>
            ))}
            <p>🔗 {associateList.length} ativos serão associados a cadastros existentes</p>
            {associateList.map((asset) => (
              <p key={`associate-${asset.ticker}`}>• {asset.ticker} → {asset.resolution?.existingAssetId}</p>
            ))}
            <p className="pt-1 text-gray-500">
              Total de linhas analisadas: {analysis.summary.totalRows} ({analysis.summary.readyCount} prontas + {unresolvedTransactionCount} pendentes)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(unresolvedAssets.length > 0 ? 2 : 1)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              ← Voltar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isPending ? 'Importando...' : '✅ Confirmar e Importar'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <p className="text-lg font-semibold">🎉 Importação concluída!</p>
          <div className="mt-2 text-sm space-y-1">
            <p>• {result.assetsCreated} ativos cadastrados</p>
            <p>• {result.transactionsImported} transações importadas</p>
            <p>• {result.transactionsSkipped} transações ignoradas (duplicatas)</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setAnalysis(null)
                setUnresolvedAssets([])
                setResult(null)
              }}
              className="rounded-lg border border-emerald-400 bg-white px-3 py-2 text-sm font-medium text-emerald-700"
            >
              Importar outra planilha
            </button>
            <a href="/transactions" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
              Ver transações →
            </a>
            <a href="/positions" className="rounded-lg border border-emerald-400 bg-white px-3 py-2 text-sm font-medium text-emerald-700">
              Ver posições →
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  )
}

function toAssetClassCode(inferred: SerializableUnresolvedAsset['inferredClass']): string | undefined {
  if (!inferred) return undefined
  if (inferred === 'ACAO') return 'ACOES'
  return inferred
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

      <NegociacaoWizardCard />

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
