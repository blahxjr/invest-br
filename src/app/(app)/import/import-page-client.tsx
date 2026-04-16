'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  analyzeNegociacaoFile,
  confirmAndImportNegociacao,
  importMovimentacao,
  importPosicao,
  type AnalyzeNegociacaoResponse,
  type ConfirmImportPayload,
  type ConfirmImportResponse,
  type SerializableAssetClassOption,
  type SerializableMissingClass,
  type SerializableUnresolvedAsset,
} from './actions'
import type { ImportResult } from '@/modules/b3/service'
import { AssetSearchCombobox } from '@/components/ui/AssetSearchCombobox'

type ImportAction = (formData: FormData) => Promise<ImportResult>

type ImportCardProps = {
  title: string
  description: string
  submitLabel: string
  action: ImportAction
  onFinished: (result: ImportResult) => void
}

type WizardStep = 1 | 2 | 3 | 4

type MissingClassDraft = SerializableMissingClass & {
  confirmAutoCreate: boolean
}

const ASSET_CATEGORY_OPTIONS = [
  { value: 'STOCK', label: 'Ação' },
  { value: 'FII', label: 'Fundo Imobiliário (FII)' },
  { value: 'ETF', label: 'ETF' },
  { value: 'FIXED_INCOME', label: 'Renda Fixa' },
  { value: 'FUND', label: 'Fundo de Investimento' },
  { value: 'CRYPTO', label: 'Criptoativo' },
  { value: 'METAL', label: 'Metal Precioso' },
  { value: 'REAL_ESTATE', label: 'Imóvel' },
  { value: 'CASH', label: 'Caixa / Liquidez' },
  { value: 'BDR', label: 'BDR' },
] as const

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

function AnalysisSkeleton() {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-full rounded bg-gray-100" />
      <div className="mt-2 h-3 w-2/3 rounded bg-gray-100" />
    </div>
  )
}

function formatAffectedTickers(tickers: string[]) {
  if (tickers.length <= 4) return tickers.join(', ')
  const visible = tickers.slice(0, 4)
  return `${visible.join(', ')}... (+${tickers.length - visible.length})`
}

function inferCodeFromClass(inferredClass: SerializableUnresolvedAsset['inferredClass']): string | null {
  if (!inferredClass) return null
  if (inferredClass === 'ACAO') return 'ACAO'
  return inferredClass
}

function pickClassForAsset(
  inferredClass: SerializableUnresolvedAsset['inferredClass'],
  availableClasses: SerializableAssetClassOption[],
  missingClasses: MissingClassDraft[],
): string | undefined {
  const inferredCode = inferCodeFromClass(inferredClass)
  if (!inferredCode) return undefined

  const existingByCode = availableClasses.find((assetClass) => assetClass.code?.toUpperCase() === normalizeClassCode(inferredCode))
  if (existingByCode) return existingByCode.id

  const missingByCode = missingClasses.find(
    (missingClass) => missingClass.inferredCode === inferredCode && missingClass.confirmAutoCreate,
  )

  if (missingByCode) return missingByCode.code
  return undefined
}

function normalizeClassCode(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'ACAO') return 'ACOES'
  return normalized
}

function findMissingDraftForAsset(
  asset: SerializableUnresolvedAsset,
  missingClasses: MissingClassDraft[],
): MissingClassDraft | undefined {
  const inferredCode = inferCodeFromClass(asset.inferredClass)
  if (!inferredCode) return undefined
  return missingClasses.find((missingClass) => missingClass.inferredCode === inferredCode)
}

function classLabel(option: SerializableAssetClassOption) {
  if (!option.code) return option.name
  return `${option.name} (${option.code})`
}

function NegociacaoWizardCard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [analysis, setAnalysis] = useState<AnalyzeNegociacaoResponse | null>(null)
  const [unresolvedAssets, setUnresolvedAssets] = useState<SerializableUnresolvedAsset[]>([])
  const [missingClasses, setMissingClasses] = useState<MissingClassDraft[]>([])
  const [result, setResult] = useState<ConfirmImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isImporting, setIsImporting] = useState(false)
  const [showSlowHint, setShowSlowHint] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const availableClasses = analysis?.availableClasses ?? []
  const existingAssets = analysis?.existingAssets ?? []

  const unresolvedOnlyFii = unresolvedAssets.filter((asset) => asset.inferredClass === 'FII')

  const existingClassCodes = useMemo(
    () =>
      new Set(
        availableClasses
          .map((assetClass) => assetClass.code?.toUpperCase() ?? null)
          .filter((code): code is string => Boolean(code)),
      ),
    [availableClasses],
  )

  const duplicateMissingCodes = useMemo(() => {
    const counters = new Map<string, number>()
    for (const missingClass of missingClasses.filter((draft) => draft.confirmAutoCreate)) {
      const code = normalizeClassCode(missingClass.code)
      counters.set(code, (counters.get(code) ?? 0) + 1)
    }

    const duplicates = new Set<string>()
    for (const [code, count] of counters.entries()) {
      if (count > 1 || existingClassCodes.has(code)) {
        duplicates.add(code)
      }
    }
    return duplicates
  }, [missingClasses, existingClassCodes])

  const missingClassHasErrors = missingClasses.some((missingClass) => {
    if (!missingClass.confirmAutoCreate) return false
    const normalizedCode = normalizeClassCode(missingClass.code)
    return !missingClass.name.trim() || !normalizedCode || duplicateMissingCodes.has(normalizedCode)
  })

  const confirmedMissingClassCodes = new Set(
    missingClasses
      .filter((missingClass) => missingClass.confirmAutoCreate)
      .map((missingClass) => normalizeClassCode(missingClass.code)),
  )

  const classSelectionAllowed = (value: string | undefined, asset: SerializableUnresolvedAsset) => {
    if (!value) return false

    if (availableClasses.some((assetClass) => assetClass.id === value)) return true

    const missingDraft = findMissingDraftForAsset(asset, missingClasses)
    if (!missingDraft || !missingDraft.confirmAutoCreate) return false

    const normalized = normalizeClassCode(value)
    return confirmedMissingClassCodes.has(normalized)
  }

  const allResolved =
    unresolvedAssets.length === 0 ||
    (!missingClassHasErrors &&
      unresolvedAssets.every((asset) => {
        const resolution = asset.resolution
        if (!resolution) return false
        if (resolution.action === 'create') {
          return Boolean(
            resolution.name?.trim() &&
              resolution.category &&
              classSelectionAllowed(resolution.assetClassId, asset),
          )
        }
        return Boolean(resolution.existingAssetId)
      }))

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

  const initializeAssetResolutions = (
    response: AnalyzeNegociacaoResponse,
    initialMissingClasses: MissingClassDraft[],
  ) => {
    const initialized = response.unresolvedAssets.map((asset) => ({
      ...asset,
      resolution: {
        action: 'create' as const,
        name: asset.ticker,
        assetClassId: pickClassForAsset(asset.inferredClass, response.availableClasses, initialMissingClasses),
        category: asset.inferredCategory ?? undefined,
      },
    }))
    setUnresolvedAssets(initialized)
  }

  const handleAnalyze = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      const response = await analyzeNegociacaoFile(formData)
      if (response.error) {
        setError(response.error)
        setAnalysis(null)
        setUnresolvedAssets([])
        setMissingClasses([])
        setStep(1)
        return
      }

      const initialMissingClasses = response.missingClasses.map((missingClass) => ({
        ...missingClass,
        confirmAutoCreate: true,
      }))

      setAnalysis(response)
      setMissingClasses(initialMissingClasses)
      initializeAssetResolutions(response, initialMissingClasses)
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
            assetClassId: pickClassForAsset('FII', availableClasses, missingClasses),
            name: asset.ticker,
            category: 'FII',
          },
        }
      }),
    )
  }

  const handleUpdateMissingClass = (
    inferredCode: string,
    patch: Partial<Pick<MissingClassDraft, 'name' | 'code' | 'description' | 'confirmAutoCreate'>>,
  ) => {
    setMissingClasses((current) =>
      current.map((missingClass) =>
        missingClass.inferredCode === inferredCode
          ? {
              ...missingClass,
              ...patch,
            }
          : missingClass,
      ),
    )

    if ('confirmAutoCreate' in patch || 'code' in patch) {
      setUnresolvedAssets((current) =>
        current.map((asset) => {
          const missingDraft = findMissingDraftForAsset(asset, missingClasses)
          if (!missingDraft || missingDraft.inferredCode !== inferredCode) {
            return asset
          }

          const mergedDraft = { ...missingDraft, ...patch }
          const nextClassId = mergedDraft.confirmAutoCreate
            ? normalizeClassCode(mergedDraft.code)
            : availableClasses.find((assetClass) => assetClass.code?.toUpperCase() === normalizeClassCode(inferredCode))?.id

          if (asset.resolution?.action !== 'create') return asset
          return {
            ...asset,
            resolution: {
              ...asset.resolution,
              assetClassId: nextClassId,
            },
          }
        }),
      )
    }
  }

  const handleConfirmImport = () => {
    if (!analysis) return

    const payload: ConfirmImportPayload = {
      readyRows: analysis.ready,
      classesToCreate: missingClasses
        .filter((missingClass) => missingClass.confirmAutoCreate)
        .map((missingClass) => ({
          inferredCode: missingClass.inferredCode,
          name: missingClass.name.trim(),
          code: normalizeClassCode(missingClass.code),
          description: missingClass.description?.trim() || undefined,
        })),
      resolutions: unresolvedAssets,
    }

    setError(null)
    setIsImporting(true)
    setShowSlowHint(false)
    setImportProgress(5)
    startTransition(async () => {
      const response = await confirmAndImportNegociacao(payload)
      if (response.error) {
        setError('Erro na importação. Tente novamente ou reduza o número de linhas.')
        setIsImporting(false)
        setImportProgress(0)
        return
      }
      setImportProgress(100)
      setResult(response)
      setStep(4)
      setIsImporting(false)
    })
  }

  useEffect(() => {
    if (!isImporting) return

    const slowTimer = setTimeout(() => {
      setShowSlowHint(true)
    }, 3000)

    const progressTimer = setInterval(() => {
      setImportProgress((current) => {
        if (current >= 90) return current
        return current + 5
      })
    }, 400)

    return () => {
      clearTimeout(slowTimer)
      clearInterval(progressTimer)
    }
  }, [isImporting])

  const unresolvedTransactionCount = unresolvedAssets.reduce((acc, asset) => acc + asset.rows.length, 0)

  const createList = unresolvedAssets.filter((asset) => asset.resolution?.action === 'create')
  const associateList = unresolvedAssets.filter((asset) => asset.resolution?.action === 'associate')
  const classesToCreateList = missingClasses.filter((missingClass) => missingClass.confirmAutoCreate)

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

          {missingClasses.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-900">⚠️ Novas classes de ativos serão criadas</p>
              <p className="text-sm text-amber-800">
                As classes abaixo não existem no sistema e podem ser criadas automaticamente antes dos ativos.
              </p>

              {missingClasses.map((missingClass) => {
                const normalizedCode = normalizeClassCode(missingClass.code)
                const hasDuplicateCode = duplicateMissingCodes.has(normalizedCode)
                return (
                  <div key={missingClass.inferredCode} className="rounded-lg border border-amber-200 bg-white p-3 space-y-2">
                    <p className="text-sm font-semibold text-gray-900">🏷️ {missingClass.name}</p>
                    <p className="text-sm text-gray-600">"{missingClass.description || missingClass.suggestedDescription}"</p>
                    <p className="text-sm text-gray-600">Afeta: {formatAffectedTickers(missingClass.affectedTickers)}</p>

                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={missingClass.name}
                        onChange={(event) =>
                          handleUpdateMissingClass(missingClass.inferredCode, { name: event.target.value })
                        }
                        placeholder="Nome"
                      />
                      <input
                        className={[
                          'rounded-md border px-3 py-2 text-sm',
                          hasDuplicateCode ? 'border-red-300 bg-red-50' : 'border-gray-300',
                        ].join(' ')}
                        value={missingClass.code}
                        onChange={(event) =>
                          handleUpdateMissingClass(missingClass.inferredCode, { code: event.target.value })
                        }
                        placeholder="Código"
                      />
                      <input
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={missingClass.description ?? ''}
                        onChange={(event) =>
                          handleUpdateMissingClass(missingClass.inferredCode, { description: event.target.value })
                        }
                        placeholder="Descrição"
                      />
                    </div>

                    {hasDuplicateCode && (
                      <p className="text-xs text-red-700">Código duplicado ou já existente no sistema.</p>
                    )}
                  </div>
                )
              })}

              <label className="flex items-center gap-2 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={missingClasses.every((missingClass) => missingClass.confirmAutoCreate)}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setMissingClasses((current) =>
                      current.map((missingClass) => ({ ...missingClass, confirmAutoCreate: checked })),
                    )
                  }}
                />
                ✅ Confirmar criação automática das classes acima
              </label>
            </div>
          )}

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
                          assetClassId:
                            resolution?.assetClassId ?? pickClassForAsset(asset.inferredClass, availableClasses, missingClasses),
                          name: resolution?.name ?? asset.ticker,
                          category: resolution?.category ?? asset.inferredCategory ?? undefined,
                        })
                      }
                    />
                    Criar novo ativo
                  </label>

                  {selectedAction === 'create' && (
                    <div className="ml-6 grid gap-2 md:grid-cols-3">
                      <input
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Nome do ativo"
                        value={resolution?.name ?? asset.ticker}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'create',
                            assetClassId:
                              resolution?.assetClassId ?? pickClassForAsset(asset.inferredClass, availableClasses, missingClasses),
                            name: event.target.value,
                            category: resolution?.category ?? asset.inferredCategory ?? undefined,
                          })
                        }
                      />
                      <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={resolution?.assetClassId ?? pickClassForAsset(asset.inferredClass, availableClasses, missingClasses) ?? ''}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'create',
                            assetClassId: event.target.value,
                            name: resolution?.name ?? asset.ticker,
                            category: resolution?.category ?? asset.inferredCategory ?? undefined,
                          })
                        }
                      >
                        <option value="">Selecione a classe</option>
                        {availableClasses.map((assetClass) => (
                          <option key={assetClass.id} value={assetClass.id}>
                            {classLabel(assetClass)}
                          </option>
                        ))}
                        {missingClasses
                          .filter((missingClass) => missingClass.confirmAutoCreate)
                          .map((missingClass) => (
                            <option key={`missing-${missingClass.inferredCode}`} value={normalizeClassCode(missingClass.code)}>
                              {missingClass.name} ({normalizeClassCode(missingClass.code)})
                            </option>
                          ))}
                      </select>
                      <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                        value={resolution?.category ?? ''}
                        onChange={(event) =>
                          updateResolution(asset.ticker, {
                            action: 'create',
                            assetClassId:
                              resolution?.assetClassId ?? pickClassForAsset(asset.inferredClass, availableClasses, missingClasses),
                            name: resolution?.name ?? asset.ticker,
                            category: event.target.value as NonNullable<SerializableUnresolvedAsset['resolution']>['category'],
                          })
                        }
                      >
                        <option value="">Selecione a categoria</option>
                        {ASSET_CATEGORY_OPTIONS.map((category) => (
                          <option key={`${asset.ticker}-${category.value}`} value={category.value}>
                            {category.label}
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
                      <AssetSearchCombobox
                        assets={existingAssets}
                        value={resolution?.existingAssetId ?? null}
                        onChange={(assetId) =>
                          updateResolution(asset.ticker, {
                            action: 'associate',
                            existingAssetId: assetId,
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
            <p>🏷️ {classesToCreateList.length} classe(s) de ativo serão criadas:</p>
            {classesToCreateList.map((missingClass) => (
              <p key={`class-${missingClass.inferredCode}`}>• {missingClass.name} (código: {normalizeClassCode(missingClass.code)})</p>
            ))}
            <p>🆕 {createList.length} ativos serão cadastrados</p>
            {createList.map((asset) => (
              <p key={`create-${asset.ticker}`}>
                • {asset.ticker} → {asset.resolution?.assetClassId ?? 'N/A'} ({asset.resolution?.category ?? 'sem categoria'})
              </p>
            ))}
            <p>🔗 {associateList.length} ativos serão associados a cadastros existentes</p>
            {associateList.map((asset) => (
              <p key={`associate-${asset.ticker}`}>• {asset.ticker} → {asset.resolution?.existingAssetId}</p>
            ))}
            <p>✅ {analysis.ready.length} transações prontas para importar</p>
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
              disabled={isPending || isImporting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isImporting ? '⏳ Importando...' : '✅ Confirmar e Importar'}
            </button>
          </div>

          {isImporting && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              <div className="flex items-center justify-between">
                <span>Processando importação...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              {showSlowHint && (
                <p className="mt-2">Aguarde - cadastrando ativos e transações...</p>
              )}
            </div>
          )}
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
                setMissingClasses([])
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
