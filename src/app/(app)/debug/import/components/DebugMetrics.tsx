'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DebugMetricsProps = {
  auditLogsToday: number
  newTransactionsLastHour: number
  positionsRecalculated: number
  errorsFound: number
  acceptedRecords: number
  totalRecords: number
}

function formatPercent(acceptedRecords: number, totalRecords: number): string {
  if (totalRecords <= 0) return '0.0%'
  return `${((acceptedRecords / totalRecords) * 100).toFixed(1)}%`
}

export function DebugMetrics({
  auditLogsToday,
  newTransactionsLastHour,
  positionsRecalculated,
  errorsFound,
  acceptedRecords,
  totalRecords,
}: DebugMetricsProps) {
  const successRate = formatPercent(acceptedRecords, totalRecords)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">AuditLog criados hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-gray-900" data-testid="metric-audit-logs">
            {auditLogsToday}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Transactions novas (1h)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-gray-900" data-testid="metric-transactions-hour">
            {newTransactionsLastHour}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Positions recalculadas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-gray-900" data-testid="metric-positions-recalc">
            {positionsRecalculated}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Erros encontrados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-red-700" data-testid="metric-errors-found">
            {errorsFound}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">% de sucesso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-emerald-700" data-testid="metric-success-rate">
            {successRate}
          </p>
          <p className="mt-1 text-xs text-gray-500">{acceptedRecords} aceitos de {totalRecords} totais</p>
        </CardContent>
      </Card>
    </div>
  )
}
