'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getDebugLogs,
  getDebugResultsSnapshot,
  type DebugLogFile,
  type DebugResultsSnapshotResponse,
} from '../actions'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DebugMetrics } from './DebugMetrics'
import { ImportWizard } from './ImportWizard'
import { LogViewer } from './LogViewer'
import { ResultsTable } from './ResultsTable'

type PageTab = 'wizard' | 'metrics' | 'results' | 'logs'

const EMPTY_SNAPSHOT: DebugResultsSnapshotResponse = {
  auditLogs: [],
  transactions: [],
  ledger: [],
  summary: {
    positionsRecalculated: 0,
    errorsFound: 0,
    acceptedRecords: 0,
    totalRecords: 0,
  },
}

export function DebugImportPageTabs() {
  const [activeTab, setActiveTab] = useState<PageTab>('wizard')
  const [isLoading, setIsLoading] = useState(true)
  const [logs, setLogs] = useState<DebugLogFile[]>([])
  const [snapshot, setSnapshot] = useState<DebugResultsSnapshotResponse>(EMPTY_SNAPSHOT)

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const [logsResult, snapshotResult] = await Promise.all([
          getDebugLogs(),
          getDebugResultsSnapshot(),
        ])

        if (!mounted) return

        setLogs(logsResult)
        setSnapshot(snapshotResult)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadData()

    return () => {
      mounted = false
    }
  }, [])

  const auditLogsToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return snapshot.auditLogs.filter((row) => row.timestamp.slice(0, 10) === today).length
  }, [snapshot.auditLogs])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-gray-600">Carregando dados de depuração...</CardContent>
      </Card>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as PageTab)}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="wizard">Importar Planilhas</TabsTrigger>
        <TabsTrigger value="metrics">Métricas</TabsTrigger>
        <TabsTrigger value="results">Resultados</TabsTrigger>
        <TabsTrigger value="logs">Logs .md</TabsTrigger>
      </TabsList>

      <TabsContent value="wizard">
        <ImportWizard />
      </TabsContent>

      <TabsContent value="metrics">
        <DebugMetrics
          auditLogsToday={auditLogsToday}
          newTransactionsLastHour={snapshot.transactions.length}
          positionsRecalculated={snapshot.summary.positionsRecalculated}
          errorsFound={snapshot.summary.errorsFound}
          acceptedRecords={snapshot.summary.acceptedRecords}
          totalRecords={snapshot.summary.totalRecords}
        />
      </TabsContent>

      <TabsContent value="results">
        <ResultsTable
          auditLogs={snapshot.auditLogs}
          transactions={snapshot.transactions}
          ledger={snapshot.ledger}
        />
      </TabsContent>

      <TabsContent value="logs">
        <LogViewer logs={logs} />
      </TabsContent>
    </Tabs>
  )
}
