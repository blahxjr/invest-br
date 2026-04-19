'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  importMovimentacaoDebug,
  importNegociacaoDebug,
  importPosicaoDebug,
  type DebugImportResponse,
} from '../actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type WizardStep = 1 | 2 | 3

type StepConfig = {
  key: 'NEGOCIACAO' | 'MOVIMENTACAO' | 'POSICAO'
  title: string
  description: string
}

const STEPS: StepConfig[] = [
  {
    key: 'NEGOCIACAO',
    title: '1. Negociação',
    description: 'Envie o arquivo de negociação para iniciar o fluxo.',
  },
  {
    key: 'MOVIMENTACAO',
    title: '2. Movimentação',
    description: 'Importe eventos e movimentações após concluir negociação.',
  },
  {
    key: 'POSICAO',
    title: '3. Posição',
    description: 'Sincronize ativos e feche o processo de depuração.',
  },
]

type ImportResults = Partial<Record<StepConfig['key'], DebugImportResponse>>

function statusVariant(result?: DebugImportResponse): 'secondary' | 'success' | 'destructive' {
  if (!result) return 'secondary'
  return result.ok ? 'success' : 'destructive'
}

function statusText(result?: DebugImportResponse) {
  if (!result) return 'Pendente'
  return result.ok ? 'Concluído' : 'Falhou'
}

export function ImportWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [tab, setTab] = useState('wizard')
  const [isPending, startTransition] = useTransition()
  const [files, setFiles] = useState<Partial<Record<StepConfig['key'], File | null>>>({
    NEGOCIACAO: null,
    MOVIMENTACAO: null,
    POSICAO: null,
  })
  const [results, setResults] = useState<ImportResults>({})

  const progressValue = useMemo(() => Math.round((currentStep / 3) * 100), [currentStep])

  function runImport(step: StepConfig['key']) {
    const selected = files[step]
    if (!selected) {
      setResults((prev) => ({
        ...prev,
        [step]: {
          ok: false,
          step,
          summary: {
            parsedRows: 0,
            imported: 0,
            skipped: 0,
            upserted: 0,
            errorsCount: 1,
          },
          preview: { columns: [], rows: [] },
          logsMd: `# Debug Import ${step}\n\n- status: failed\n- error: Arquivo nao selecionado`,
          errors: ['Arquivo nao selecionado'],
        },
      }))
      return
    }

    const formData = new FormData()
    formData.set('file', selected)

    startTransition(async () => {
      const response =
        step === 'NEGOCIACAO'
          ? await importNegociacaoDebug(formData)
          : step === 'MOVIMENTACAO'
            ? await importMovimentacaoDebug(formData)
            : await importPosicaoDebug(formData)

      setResults((prev) => ({ ...prev, [step]: response }))

      if (response.ok) {
        setCurrentStep((prev) => {
          if (step === 'NEGOCIACAO') return prev < 2 ? 2 : prev
          if (step === 'MOVIMENTACAO') return prev < 3 ? 3 : prev
          return prev
        })
        setTab('resultados')
      }
    })
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-auto w-full flex-wrap">
        <TabsTrigger value="wizard">Importar Planilhas</TabsTrigger>
        <TabsTrigger value="resultados">Resultados</TabsTrigger>
        <TabsTrigger value="logs">Logs .md</TabsTrigger>
        <TabsTrigger value="issues">Issues Abertos</TabsTrigger>
      </TabsList>

      <TabsContent value="wizard">
        <Card>
          <CardHeader>
            <CardTitle>ImportWizard</CardTitle>
            <CardDescription>Fluxo sequencial: Negociação → Movimentação → Posição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso do wizard</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {STEPS.map((step, index) => {
                const stepNumber = (index + 1) as WizardStep
                const enabled = stepNumber <= currentStep
                const stepResult = results[step.key]

                return (
                  <Card key={step.key} className={!enabled ? 'opacity-70' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle>{step.title}</CardTitle>
                        <Badge variant={statusVariant(stepResult)}>{statusText(stepResult)}</Badge>
                      </div>
                      <CardDescription>{step.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        data-testid={`file-input-${step.key}`}
                        disabled={!enabled || isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setFiles((prev) => ({ ...prev, [step.key]: file }))
                        }}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <Button
                        className="w-full"
                        disabled={!enabled || !files[step.key] || isPending}
                        onClick={() => runImport(step.key)}
                      >
                        {isPending ? 'Processando...' : 'Importar e Analisar'}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="resultados">
        <div className="space-y-4">
          {STEPS.map((step) => {
            const result = results[step.key]
            if (!result) {
              return (
                <Card key={step.key}>
                  <CardHeader>
                    <CardTitle>{step.title}</CardTitle>
                    <CardDescription>Nenhum resultado disponível.</CardDescription>
                  </CardHeader>
                </Card>
              )
            }

            return (
              <Card key={step.key}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{step.title}</CardTitle>
                    <Badge variant={statusVariant(result)}>{statusText(result)}</Badge>
                  </div>
                  <CardDescription>
                    Parseadas: {result.summary.parsedRows} | Importadas: {result.summary.imported} | Puladas: {result.summary.skipped} | Upserts: {result.summary.upserted}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {result.preview.rows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {result.preview.columns.map((column) => (
                              <TableHead key={column}>{column}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.preview.rows.map((row, rowIndex) => (
                            <TableRow key={`${step.key}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={`${step.key}-${rowIndex}-${cellIndex}`}>{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Sem preview para este step.</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </TabsContent>

      <TabsContent value="logs">
        <Card>
          <CardHeader>
            <CardTitle>Logs .md</CardTitle>
            <CardDescription>Log técnico em Markdown gerado após cada importação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-800">{step.title}</p>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-700">
                  {results[step.key]?.logsMd ?? 'Sem logs para este step.'}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="issues">
        <Card>
          <CardHeader>
            <CardTitle>Issues Abertos</CardTitle>
            <CardDescription>Erros e alertas acumulados durante a depuração.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {STEPS.map((step) => {
              const errors = results[step.key]?.errors ?? []
              return (
                <div key={step.key} className="rounded-lg border border-gray-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-gray-800">{step.title}</p>
                  {errors.length === 0 ? (
                    <Badge variant="success">Sem issues</Badge>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
                      {errors.map((item, index) => (
                        <li key={`${step.key}-error-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
